/**
 * Daily housekeeping: deletes expired rate-limit buckets. Idempotent (deleting what is already gone
 * is a no-op). Local store: nothing to clean (the in-memory limiter prunes itself).
 */
import { cronHandler } from "@/lib/ops/cron-route";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const handler = cronHandler(
  "cleanup",
  async () => {
    if (!isSupabaseConfigured()) return { skipped: true, reason: "local store" };
    const admin = createAdminClient();
    const { data, error } = await (admin as unknown as { rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc("rate_limit_cleanup");
    if (error) throw new Error("rate limit cleanup failed");
    return { rateLimitBucketsDeleted: Number(data ?? 0) };
  },
  50_000,
);

export const GET = handler;
export const POST = handler;
