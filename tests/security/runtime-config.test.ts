/** Beta hardening: production refuses to start with missing, placeholder, debug or unsafe config. */
import { afterEach, describe, expect, it } from "vitest";
import { assertRuntimeConfig, isProductionDeployment, RUNTIME_VARS, runtimeConfigIssues } from "@/lib/config/runtime-config";
import { assertSafeStorageMode } from "@/lib/supabase/config";

const GOOD = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon.public.key.value.0123456789",
  SUPABASE_SERVICE_ROLE_KEY: "service.role.key.value.9876543210",
  NEXT_PUBLIC_SITE_URL: "https://beta.cyberblade.example",
  CRON_SECRET: "c".repeat(40),
  BETA_INVITE_ONLY: "true",
};

describe("runtime config (production)", () => {
  it("accepts a complete production config", () => {
    expect(runtimeConfigIssues(GOOD)).toEqual([]);
    expect(() => assertRuntimeConfig(GOOD)).not.toThrow();
  });

  it.each([
    ["missing service-role key", { SUPABASE_SERVICE_ROLE_KEY: undefined }, /SUPABASE_SERVICE_ROLE_KEY is required/],
    ["missing cron secret", { CRON_SECRET: undefined }, /CRON_SECRET is required/],
    ["short cron secret", { CRON_SECRET: "short" }, /CRON_SECRET must be at least 32/],
    ["beta flag not set explicitly", { BETA_INVITE_ONLY: undefined }, /BETA_INVITE_ONLY is required/],
    ["placeholder Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co" }, /placeholder/],
    ["placeholder key", { SUPABASE_SERVICE_ROLE_KEY: "your-supabase-service-role-key" }, /placeholder/],
    ["http site URL", { NEXT_PUBLIC_SITE_URL: "http://beta.cyberblade.example" }, /https/],
    ["in-memory rate limits", { RATE_LIMIT_BACKEND: "memory" }, /RATE_LIMIT_BACKEND must be postgres/],
    ["debug logs", { HANDLER_DEBUG_LOGS: "true" }, /HANDLER_DEBUG_LOGS must be off/],
    ["dev UI", { CYBERBLADE_SHOW_DEV_UI: "1" }, /CYBERBLADE_SHOW_DEV_UI must be off/],
    ["mock AI provider", { SOC_AI_PROVIDER: "mock-e2e" }, /mock provider/],
    ["anon key equals service key", { NEXT_PUBLIC_SUPABASE_ANON_KEY: GOOD.SUPABASE_SERVICE_ROLE_KEY }, /must not be the service-role key/],
    ["service key in a public var", { NEXT_PUBLIC_DEBUG_KEY: GOOD.SUPABASE_SERVICE_ROLE_KEY }, /NEXT_PUBLIC_DEBUG_KEY exposes the service-role key/],
    ["bad flag value", { SOC_EXAMS_ENABLED: "yes" }, /SOC_EXAMS_ENABLED must be true\/false/],
    ["bad AI mode", { SOC_AI_GRADING_MODE: "on" }, /SOC_AI_GRADING_MODE must be one of/],
  ] as const)("refuses: %s", (_name, patch, re) => {
    const env = { ...GOOD, ...patch } as Record<string, string | undefined>;
    expect(runtimeConfigIssues(env).join("\n")).toMatch(re);
    expect(() => assertRuntimeConfig(env)).toThrow(/refuses to start/);
  });

  it("never prints a value in its messages", () => {
    const env = { ...GOOD, SUPABASE_SERVICE_ROLE_KEY: "your-secret-placeholder-value-123", CRON_SECRET: "tiny" };
    const text = runtimeConfigIssues(env).join("\n");
    expect(text).not.toContain("your-secret-placeholder-value-123");
    expect(text).not.toContain("tiny");
  });

  it("documents every variable the app reads", () => {
    const names = RUNTIME_VARS.map((v) => v.name);
    for (const required of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "BETA_INVITE_ONLY", "MAINTENANCE_MODE", "RATE_LIMIT_BACKEND"]) expect(names).toContain(required);
    expect(RUNTIME_VARS.filter((v) => v.name.startsWith("NEXT_PUBLIC_")).every((v) => v.visibility === "public")).toBe(true);
    expect(RUNTIME_VARS.filter((v) => !v.name.startsWith("NEXT_PUBLIC_")).every((v) => v.visibility === "server")).toBe(true);
  });
});

describe("what counts as a production deployment", () => {
  it("Vercel always; local next start only outside the E2E harness", () => {
    expect(isProductionDeployment({ VERCEL: "1", NODE_ENV: "development" })).toBe(true);
    expect(isProductionDeployment({ VERCEL: "1", NODE_ENV: "production", CYBERBLADE_ALLOW_LOCAL_E2E: "true" })).toBe(true);
    expect(isProductionDeployment({ NODE_ENV: "production", CYBERBLADE_ALLOW_LOCAL_E2E: "true" })).toBe(false);
    expect(isProductionDeployment({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionDeployment({ NODE_ENV: "development" })).toBe(false);
  });

  it("refuses the E2E harness flag on Vercel", () => {
    expect(runtimeConfigIssues({ ...GOOD, VERCEL: "1", CYBERBLADE_ALLOW_LOCAL_E2E: "true" }).join("\n")).toMatch(/must not be set on Vercel/);
  });
});

describe("hosted-only storage", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ["VERCEL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "CYBERBLADE_ALLOW_LOCAL_E2E"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("refuses the local JSON store on Vercel even with the E2E flag", () => {
    process.env.VERCEL = "1";
    process.env.CYBERBLADE_ALLOW_LOCAL_E2E = "true";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => assertSafeStorageMode()).toThrow(/Local-first JSON file storage cannot be active/);
  });
});
