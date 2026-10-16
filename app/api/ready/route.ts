/**
 * Readiness: configuration valid and the database reachable. Minimal output (ok / fail per check,
 * never which variable or why) and rate limited per client.
 */
import { NextResponse, type NextRequest } from "next/server";
import { runtimeConfigIssues } from "@/lib/config/runtime-config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/rate-limit";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

async function databaseOk(): Promise<"ok" | "fail" | "local"> {
  if (!isSupabaseConfigured()) return "local";
  try {
    const admin = createAdminClient();
    const { error } = await (admin as unknown as { from: (t: string) => { select: (c: string, o: object) => { limit: (n: number) => PromiseLike<{ error: unknown }> } } })
      .from("operators")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await rateLimit(`ready:${ip}`, 30, 60_000);
  // A limiter that is down means the database is down: report not-ready rather than "rate limited".
  if (rate.unavailable) return NextResponse.json({ ready: false, checks: { config: "ok", database: "fail" } }, { status: 503, headers: { "cache-control": "no-store" } });
  if (!rate.allowed) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  const config = runtimeConfigIssues().length === 0 ? "ok" : "fail";
  const database = await databaseOk();
  const ready = config === "ok" && database !== "fail";
  if (!ready) log.warn("readiness failed", { requestId: request.headers.get("x-request-id") ?? undefined, config, database });
  return NextResponse.json({ ready, checks: { config, database } }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
