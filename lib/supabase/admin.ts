import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "./config";
import type { Database } from "./types";

/**
 * Creates an administrative Supabase client using the service role key.
 * Bypasses Row Level Security (RLS) for background synchronization.
 * Returns null if Supabase is not configured.
 */
export function createAdminClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const env = getSupabaseEnv();
  if (!env.serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client operations.");
  }
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
