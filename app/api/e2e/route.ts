/**
 * Test-only fixture endpoint for the Playwright suite (L1-A-08). E2E helpers used to rewrite the
 * server's live JSON files from the test process; the server's own writes then silently dropped
 * those edits (lost updates), which made rank-gated journeys flaky under load. This endpoint makes
 * the same changes through the server's in-process stores instead.
 *
 * Off unless CYBERBLADE_ALLOW_LOCAL_E2E=true (set only by playwright.config.ts) AND the request
 * comes to a loopback host; it acts only on the signed-in operator. Returns 404 otherwise.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { getLessons } from "@/lib/content/lessons";
import { e2eFixturesAllowed } from "@/lib/e2e/fixtures-guard";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("promote"), rank: z.number().int().min(0).max(5) }),
  z.object({ action: z.literal("complete-rank-lessons"), rank: z.number().int().min(0).max(5) }),
  z.object({ action: z.literal("pass-challenge"), rank: z.number().int().min(0).max(5) }),
  z.object({ action: z.literal("pass-soc-exam") }),
  z.object({ action: z.literal("revoke-certificate"), credentialId: z.string(), reason: z.string().optional() }),
]);

export async function POST(request: NextRequest) {
  if (!e2eFixturesAllowed(process.env, request.headers.get("host"))) return new NextResponse(null, { status: 404 });
  const operator = await getCurrentOperator();
  if (!operator) return NextResponse.json({ error: "no operator" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ctx = getCtx();
  if (parsed.data.action === "promote") {
    await ctx.operators.setRank(operator.id, parsed.data.rank);
    return NextResponse.json({ ok: true, rank: parsed.data.rank });
  }
  if (parsed.data.action === "pass-challenge") {
    await ctx.repo.createChallenge({
      userId: operator.id,
      rank: parsed.data.rank,
      labAttemptId: `e2e-attempt-${parsed.data.rank}`,
      status: "passed",
      finishedAt: ctx.now().toISOString(),
    });
    return NextResponse.json({ ok: true, challengePassed: parsed.data.rank });
  }
  if (parsed.data.action === "pass-soc-exam") {
    await ctx.repo.saveSocExamOutcomeReport({
      userId: operator.id,
      certFamily: "soc-l1",
      examDate: "2026-10-17",
      passed: true,
      consentVersion: "v1",
    });
    return NextResponse.json({ ok: true, socExamPassed: true });
  }
  if (parsed.data.action === "revoke-certificate") {
    const revoked = await ctx.repo.revokeCertificate(parsed.data.credentialId, parsed.data.reason ?? "e2e_test_revocation");
    return NextResponse.json({ ok: true, revoked });
  }
  const lessons = await getLessons({ rank: parsed.data.rank, track: "core" });
  const at = ctx.now().toISOString();
  for (const l of lessons) await ctx.repo.markLessonCompleted(operator.id, l.id, at);
  return NextResponse.json({ ok: true, completed: lessons.length });
}
