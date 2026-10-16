import "server-only";
/** Beta settings and store selection. */
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { FileBetaStore, type BetaStore } from "./store";
import { SupabaseBetaStore } from "./supabase-store";

/** Bump when the beta notice wording changes: every learner sees and acknowledges it again. */
export const BETA_NOTICE_VERSION = "beta-notice-v1";

const on = (v: string | undefined) => v === "true" || v === "1";
export const isBetaInviteOnly = (env: Record<string, string | undefined> = process.env) => on(env.BETA_INVITE_ONLY);
/** noindex while in beta unless explicitly turned off. */
export const isBetaNoindex = (env: Record<string, string | undefined> = process.env) => (env.BETA_NOINDEX !== undefined ? on(env.BETA_NOINDEX) : isBetaInviteOnly(env));

let override: BetaStore | null = null;
let cached: BetaStore | null = null;
export function setBetaStore(store: BetaStore | null): void {
  override = store;
}
export function getBetaStore(): BetaStore {
  if (override) return override;
  cached ??= isSupabaseConfigured() ? new SupabaseBetaStore() : new FileBetaStore();
  return cached;
}
