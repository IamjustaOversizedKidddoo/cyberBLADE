/**
 * The only door to a real model outside learner traffic. Manual, explicit, never in CI or tests.
 */
export const REAL_PROVIDER_FLAG = "--i-understand-this-calls-a-real-provider";

export function realProviderRefusal(argv: string[], env: NodeJS.ProcessEnv): string | null {
  if (env.CI) return "refusing: CI environment detected (real-provider runs are manual only)";
  if (env.VITEST || env.NODE_ENV === "test") return "refusing: test environment detected";
  if (!argv.includes(REAL_PROVIDER_FLAG)) return `refusing: pass ${REAL_PROVIDER_FLAG} to confirm this run sends synthetic text to an external AI provider and spends tokens`;
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return "refusing: no GROQ_API_KEY or GEMINI_API_KEY in the environment (keys come from env only)";
  return null;
}
