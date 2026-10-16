import "server-only";
/**
 * Shared wrapper for /api/cron/* routes: secret check, rate limit, a time budget below the function
 * limit, minimal JSON output and a request id. Jobs must be idempotent: Vercel Cron delivery is best
 * effort and can invoke the same run twice (vercel.com/docs/cron-jobs/manage-cron-jobs, "Cron job
 * delivery and idempotency").
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "./cron-auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { log } from "@/lib/observability/logger";

export type CronJob = (budget: { deadline: number }) => Promise<Record<string, number | string | boolean | undefined>>;

export function cronHandler(name: string, job: CronJob, budgetMs: number) {
  return async function handle(request: NextRequest): Promise<NextResponse> {
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: "unauthorized", requestId }, { status: 401 });
    }
    const rl = await rateLimit(`cron:${name}`, 12, 60 * 60_000);
    if (!rl.allowed) return NextResponse.json({ error: "rate limited", requestId }, { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } });
    const started = Date.now();
    try {
      const result = await job({ deadline: started + budgetMs });
      log.info("cron run", { requestId, job: name, ms: Date.now() - started, ...result });
      return NextResponse.json({ ok: true, job: name, ms: Date.now() - started, ...result, requestId });
    } catch (e) {
      log.error("cron run failed", { requestId, job: name, error: e instanceof Error ? e.message : String(e) });
      return NextResponse.json({ ok: false, job: name, requestId }, { status: 500 });
    }
  };
}
