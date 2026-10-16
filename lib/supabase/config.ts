/**
 * Supabase configuration and runtime environment detection.
 * Determines whether the platform runs in hosted (Supabase) or local-first (file store) mode.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

export function assertSafeStorageMode(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // If any Supabase variable is set, require full client configuration
  const anySet = Boolean(url || anonKey || serviceKey);
  if (anySet && (!url || !anonKey)) {
    throw new Error(
      "CONFIGURATION ERROR: Partial Supabase configuration detected. Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be provided.",
    );
  }

  // Refuse local-first file storage in production (fail loudly)
  // Only explicitly designated test harnesses (e.g. Playwright local runner) may bypass
  // Never on Vercel: a deployment there is always hosted-only, whatever the harness flag says.
  const onVercel = process.env.VERCEL === "1";
  const isTestHarness = !onVercel && (process.env.NODE_ENV === "test" || process.env.CYBERBLADE_ALLOW_LOCAL_E2E === "true");
  if ((process.env.NODE_ENV === "production" || onVercel) && !isSupabaseConfigured() && !isTestHarness) {
    throw new Error(
      "PRODUCTION SECURITY VIOLATION: Local-first JSON file storage cannot be active in production (NODE_ENV=production). Valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && anonKey);
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  return { url, anonKey, serviceRoleKey };
}
