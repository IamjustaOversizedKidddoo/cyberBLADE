/**
 * Pluggable rate limiting (beta hardening). Production uses Postgres (`rate_limit_hit`, one atomic
 * upsert per hit, shared by every serverless instance); local development and tests use the
 * in-memory sliding window. A production deployment with the in-memory backend fails loudly.
 * Keys are hashed before they reach the database, so no IP or user id is stored in clear.
 */
import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit as memoryCheck } from "@/lib/progress/rate-limit";
import { isProductionDeployment } from "@/lib/config/runtime-config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "@/lib/observability/logger";

/** `unavailable` marks a fail-closed refusal (limiter backend down), so health checks can say so. */
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number; unavailable?: true };

export interface RateLimitBackend {
  readonly name: "memory" | "postgres";
  hit(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
}

export const memoryBackend: RateLimitBackend = {
  name: "memory",
  async hit(key, max, windowMs) {
    return memoryCheck(key, max, windowMs);
  },
};

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export const hashRateLimitKey = (key: string) => createHash("sha256").update(`cb-rl:${key}`).digest("hex");

export function postgresBackend(getClient: () => RpcClient | null): RateLimitBackend {
  return {
    name: "postgres",
    async hit(key, max, windowMs) {
      const client = getClient();
      if (!client) throw new Error("Rate limiting is unavailable.");
      const { data, error } = await client.rpc("rate_limit_hit", { p_key: hashRateLimitKey(key), p_max: max, p_window_ms: windowMs });
      const row = Array.isArray(data) ? (data[0] as { allowed: boolean; hits: number; retry_after_ms: number } | undefined) : undefined;
      if (error || !row) {
        // Fail closed: without a working limiter, refuse rather than allow unlimited attempts.
        log.error("rate limit backend failed", { reason: error?.message ?? "no row" });
        return { allowed: false, remaining: 0, retryAfterMs: 5_000, unavailable: true };
      }
      return { allowed: row.allowed, remaining: Math.max(0, max - row.hits), retryAfterMs: row.retry_after_ms };
    },
  };
}

let override: RateLimitBackend | null = null;
/** Tests only. */
export function setRateLimitBackend(backend: RateLimitBackend | null): void {
  override = backend;
}

export function selectRateLimitBackend(env: Record<string, string | undefined> = process.env, makePostgres: () => RateLimitBackend = defaultPostgres): RateLimitBackend {
  const wanted = env.RATE_LIMIT_BACKEND ?? (isProductionDeployment(env) ? "postgres" : "memory");
  if (wanted === "memory") {
    if (isProductionDeployment(env)) throw new Error("PRODUCTION SECURITY VIOLATION: the in-memory rate limiter is per instance; set RATE_LIMIT_BACKEND=postgres.");
    return memoryBackend;
  }
  return makePostgres();
}

function defaultPostgres(): RateLimitBackend {
  return postgresBackend(() => (isSupabaseConfigured() ? (createAdminClient() as unknown as RpcClient) : null));
}

let cached: RateLimitBackend | null = null;
export function activeRateLimitBackend(): RateLimitBackend {
  if (override) return override;
  cached ??= selectRateLimitBackend();
  return cached;
}

/** Counts one hit for `key` and says whether it is within `max` per `windowMs`. */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  return activeRateLimitBackend().hit(key, max, windowMs);
}
