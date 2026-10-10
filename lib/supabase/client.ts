import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "./config";
import type { Database } from "./types";

/**
 * Creates a client-side Supabase browser client.
 * Returns null if Supabase is not configured (e.g. running in local-first mode).
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const env = getSupabaseEnv();
  return createBrowserClient<Database>(env.url, env.anonKey);
}
