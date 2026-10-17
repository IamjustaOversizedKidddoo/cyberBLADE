/**
 * Typed runtime configuration check (beta hardening). One table of every environment variable the
 * app reads: who may see it (public = shipped to the browser, server = never), whether production
 * requires it, and how it is validated. `assertRuntimeConfig()` runs once at server start
 * (instrumentation.ts) and refuses to start with a list of problems. Messages name variables, never
 * values. No `server-only` import so scripts and tests can use it.
 */

export type Visibility = "public" | "server";
export type VarSpec = {
  name: string;
  visibility: Visibility;
  requiredInProduction: boolean;
  description: string;
  check?: (value: string, env: Env) => string | null;
};
export type Env = Record<string, string | undefined>;

const BOOL = /^(true|false|1|0)$/;
const PLACEHOLDER = /(your[-_]|placeholder|changeme|change-me|replace[-_]?me|example-key|xxxx|<[^>]+>|^todo$|^test$|^dummy)/i;

const bool = (v: string) => (BOOL.test(v) ? null : "must be true/false/1/0");
const positiveInt = (v: string) => (/^\d+$/.test(v) && Number(v) > 0 ? null : "must be a positive integer");
const positiveNumber = (v: string) => (Number.isFinite(Number(v)) && Number(v) > 0 ? null : "must be a positive number");
const httpsUrl = (v: string, env: Env) => {
  try {
    const u = new URL(v);
    if (isProductionDeployment(env) && u.protocol !== "https:") return "must use https in production";
    return null;
  } catch {
    return "must be a URL";
  }
};
const oneOf = (...values: string[]) => (v: string) => (values.includes(v) ? null : `must be one of ${values.join(", ")}`);
const minLength = (n: number) => (v: string) => (v.length >= n ? null : `must be at least ${n} characters`);

export const RUNTIME_VARS: VarSpec[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", visibility: "public", requiredInProduction: true, description: "Supabase project URL", check: httpsUrl },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", visibility: "public", requiredInProduction: true, description: "Supabase anon (public) key; RLS applies", check: minLength(20) },
  { name: "SUPABASE_SERVICE_ROLE_KEY", visibility: "server", requiredInProduction: true, description: "Supabase service-role key (bypasses RLS); server env only", check: minLength(20) },
  { name: "NEXT_PUBLIC_SITE_URL", visibility: "public", requiredInProduction: true, description: "Canonical site URL (auth redirects, metadata)", check: httpsUrl },
  { name: "CRON_SECRET", visibility: "server", requiredInProduction: true, description: "Shared secret for /api/cron/* (Vercel sends it as a Bearer token)", check: minLength(32) },
  { name: "RATE_LIMIT_BACKEND", visibility: "server", requiredInProduction: false, description: "postgres (default in production) or memory (local only)", check: oneOf("postgres", "memory") },
  { name: "BETA_INVITE_ONLY", visibility: "server", requiredInProduction: true, description: "true = sign-up needs an invite code", check: bool },
  { name: "BETA_NOINDEX", visibility: "server", requiredInProduction: false, description: "true (default while BETA_INVITE_ONLY) = robots and X-Robots-Tag noindex", check: bool },
  { name: "MAINTENANCE_MODE", visibility: "server", requiredInProduction: false, description: "true = every route except /api/health answers 503 with Retry-After", check: bool },
  { name: "MAINTENANCE_RETRY_AFTER_SECONDS", visibility: "server", requiredInProduction: false, description: "Retry-After for maintenance mode (default 600)", check: positiveInt },
  { name: "NEON_DATA_DIR", visibility: "server", requiredInProduction: false, description: "Local JSON store directory (local only; refused in production)" },
  { name: "NEON_SHOW_DRAFTS", visibility: "server", requiredInProduction: false, description: "Show draft lessons (owner decision for the beta)", check: bool },
  { name: "GEMINI_API_KEY", visibility: "server", requiredInProduction: false, description: "Handler provider (optional; offline fallback without it)" },
  { name: "GEMINI_MODEL", visibility: "server", requiredInProduction: false, description: "Handler model id" },
  { name: "GROQ_API_KEY", visibility: "server", requiredInProduction: false, description: "Handler provider (optional)" },
  { name: "GROQ_MODEL", visibility: "server", requiredInProduction: false, description: "Handler model id" },
  { name: "HANDLER_DAILY_REQUEST_LIMIT", visibility: "server", requiredInProduction: false, description: "Per-learner Handler requests per day", check: positiveInt },
  { name: "HANDLER_DAILY_TOKEN_LIMIT", visibility: "server", requiredInProduction: false, description: "Per-learner Handler tokens per day", check: positiveInt },
  { name: "HANDLER_GLOBAL_DAILY_TOKEN_LIMIT", visibility: "server", requiredInProduction: false, description: "All learners, tokens per day", check: positiveInt },
  { name: "HANDLER_MAX_GLOBAL_DAILY_BUDGET_USD", visibility: "server", requiredInProduction: false, description: "Daily AI spend ceiling (USD)", check: positiveNumber },
  { name: "HANDLER_DEBUG_LOGS", visibility: "server", requiredInProduction: false, description: "Debug logging (refused in production)", check: bool },
  { name: "SOC_WORKSPACE_ENABLED", visibility: "server", requiredInProduction: false, description: "SOC workspace", check: bool },
  { name: "SOC_ENRICHMENT_ENABLED", visibility: "server", requiredInProduction: false, description: "Enrichment tools", check: bool },
  { name: "SOC_QUERY_ENABLED", visibility: "server", requiredInProduction: false, description: "BladeQL search, questions and drills", check: bool },
  { name: "SOC_REPORTS_ENABLED", visibility: "server", requiredInProduction: false, description: "Incident report editor and grading", check: bool },
  { name: "SOC_EXAMS_ENABLED", visibility: "server", requiredInProduction: false, description: "Practice exams", check: bool },
  { name: "SOC_HANDLER_ENABLED", visibility: "server", requiredInProduction: false, description: "Handler in the SOC workspace", check: bool },
  { name: "SOC_L2_ENABLED", visibility: "server", requiredInProduction: false, description: "L2 track (built & audited in Entry 16/17; default false for staged rollout)", check: bool },
  { name: "SOC_RULES_ENABLED", visibility: "server", requiredInProduction: false, description: "Detection-rule tool (built & audited in Entry 16/17; default false for staged rollout)", check: bool },
  { name: "PENTEST_ENABLED", visibility: "server", requiredInProduction: false, description: "Penetration Testing track L1 (default false for staged rollout)", check: bool },
  { name: "SOC_AI_GRADING_MODE", visibility: "server", requiredInProduction: false, description: "off | shadow | preview | live (live needs a signed gate)", check: oneOf("off", "shadow", "preview", "live") },
  { name: "SOC_AI_GRADING_KILL_SWITCH", visibility: "server", requiredInProduction: false, description: "1 = stop all AI grading", check: bool },
  { name: "SOC_AI_GRADING_MODEL_ID", visibility: "server", requiredInProduction: false, description: "Provider-qualified model id for the AI-grading gate" },
  { name: "SOC_AI_PROVIDER", visibility: "server", requiredInProduction: false, description: "AI-grading provider override (mock providers refused in production)" },
  { name: "CAPTCHA_SECRET_KEY", visibility: "server", requiredInProduction: false, description: "Bot check on sign-up (optional)" },
  { name: "ERROR_REPORTER_DSN", visibility: "server", requiredInProduction: false, description: "Optional Sentry-compatible DSN; events are scrubbed of learner content", check: httpsUrl },
  { name: "CYBERBLADE_ALLOW_LOCAL_E2E", visibility: "server", requiredInProduction: false, description: "Playwright harness only; refused on Vercel", check: bool },
  { name: "CYBERBLADE_SHOW_DEV_UI", visibility: "server", requiredInProduction: false, description: "Developer pages (refused in production)", check: bool },
];

/** A real deployment: on Vercel always, otherwise NODE_ENV=production outside the local E2E harness. */
export function isProductionDeployment(env: Env = process.env): boolean {
  if (env.VERCEL === "1") return true;
  return env.NODE_ENV === "production" && env.CYBERBLADE_ALLOW_LOCAL_E2E !== "true";
}

const on = (v: string | undefined) => v === "true" || v === "1";

/** Every configuration problem, by variable name. Empty = OK. Values are never included. */
export function runtimeConfigIssues(env: Env = process.env): string[] {
  const issues: string[] = [];
  const prod = isProductionDeployment(env);

  for (const spec of RUNTIME_VARS) {
    const raw = env[spec.name];
    const value = raw?.trim();
    if (!value) {
      if (prod && spec.requiredInProduction) issues.push(`${spec.name} is required in production (${spec.description})`);
      continue;
    }
    const problem = spec.check?.(value, env);
    if (problem) issues.push(`${spec.name} ${problem}`);
    if (prod && (spec.requiredInProduction || /KEY|SECRET|DSN|URL/.test(spec.name)) && PLACEHOLDER.test(value)) {
      issues.push(`${spec.name} still holds a placeholder value`);
    }
  }

  if (env.VERCEL === "1" && on(env.CYBERBLADE_ALLOW_LOCAL_E2E)) issues.push("CYBERBLADE_ALLOW_LOCAL_E2E must not be set on Vercel");
  if (prod) {
    if (on(env.HANDLER_DEBUG_LOGS)) issues.push("HANDLER_DEBUG_LOGS must be off in production");
    if (on(env.CYBERBLADE_SHOW_DEV_UI)) issues.push("CYBERBLADE_SHOW_DEV_UI must be off in production");
    if ((env.RATE_LIMIT_BACKEND ?? "postgres") !== "postgres") issues.push("RATE_LIMIT_BACKEND must be postgres in production (in-memory limits are per instance)");
    if (/^mock/i.test(env.SOC_AI_PROVIDER ?? "")) issues.push("SOC_AI_PROVIDER must not be a mock provider in production");
    const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (anon && service && anon === service) issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must not be the service-role key");
    if (service) {
      for (const [k, v] of Object.entries(env)) if (k.startsWith("NEXT_PUBLIC_") && v?.trim() === service) issues.push(`${k} exposes the service-role key to the browser`);
    }
  }
  return issues;
}

export function assertRuntimeConfig(env: Env = process.env): void {
  const issues = runtimeConfigIssues(env);
  if (issues.length) {
    throw new Error(`CONFIGURATION ERROR: the server refuses to start.\n${issues.map((i) => ` - ${i}`).join("\n")}\nSee .env.example and docs/ops/deploy-vercel.md.`);
  }
}
