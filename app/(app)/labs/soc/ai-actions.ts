"use server";

/**
 * Phase 3 Prompt 7: AI-assisted report feedback (communication criteria).
 * Inputs are schema-validated, rate-limited and ownership-checked; unexpected failures return a
 * generic message with a request id (details stay in server logs, never learner text).
 */
import { assertSocWorkspaceEnabled } from "@/lib/config/env";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit-logger";
import type { AiResultView } from "@/lib/lab-engine/soc/ai-grading/compose";
import { CALIBRATION_CONSENT_VERSION } from "@/lib/lab-engine/soc/ai-grading/calibration/packets";
import { requestHumanReview } from "@/lib/lab-engine/soc/ai-grading/review";
import { getAiGradingStore, getAiResultForLearner } from "@/lib/lab-engine/soc/ai-grading/runtime";
import { scheduleAiWorker } from "./ai-schedule";

const submissionIdSchema = z.string().uuid();

/** Messages safe to show as-is; anything else becomes a generic error with a request id. */
const LEARNER_SAFE = /^(Rate limit exceeded|There is no AI feedback|Report not yet)/;

async function guarded<T>(label: string, fn: (requestId: string) => Promise<T>): Promise<T> {
  const requestId = randomUUID().slice(0, 8);
  try {
    return await fn(requestId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (LEARNER_SAFE.test(msg)) throw err;
    console.error(`[soc-ai] ${label} failed ref=${requestId}: ${msg.slice(0, 200)}`);
    throw new Error(`Something went wrong. Reference: ${requestId}`);
  }
}

async function limit(key: string, max: number, windowMs: number): Promise<void> {
  const rate = await rateLimit(key, max, windowMs);
  if (!rate.allowed) throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
}

export async function getSocAiResultAction(submissionId: string): Promise<AiResultView> {
  const id = submissionIdSchema.parse(submissionId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  await limit(`soc_ai_result:${operator.id}`, 60, 60_000);
  return guarded("result", async () => {
    const view = await getAiResultForLearner(getCtx(), operator.id, id);
    if (view.criteria.some((c) => c.displayStatus === "pending")) scheduleAiWorker();
    return view;
  });
}

export async function requestSocAiHumanReviewAction(submissionId: string): Promise<{ status: "created" | "already_requested" }> {
  const id = submissionIdSchema.parse(submissionId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  await limit(`soc_ai_review_request:${operator.id}`, 3, 60 * 60_000);
  return guarded("review-request", async () => {
    const ctx = getCtx();
    const submission = await ctx.repo.getSocReportSubmission(id);
    if (!submission) throw new Error("Forbidden: submission does not belong to operator");
    const r = await requestHumanReview(getAiGradingStore(), {
      userId: operator.id,
      submissionId: id,
      submissionOwnerId: submission.userId,
      now: ctx.now(),
    });
    await logSecurityEvent({ userId: operator.id, eventType: "soc_ai.human_review_requested", metadata: { submissionId: id, status: r.status } });
    return { status: r.status };
  });
}

export async function getSocAiConsentAction(): Promise<{ granted: boolean; consentVersion: string }> {
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const c = await getAiGradingStore().getConsent(operator.id);
  return { granted: Boolean(c?.granted && c.consentVersion === CALIBRATION_CONSENT_VERSION), consentVersion: CALIBRATION_CONSENT_VERSION };
}

export async function setSocAiConsentAction(granted: boolean): Promise<{ granted: boolean }> {
  assertSocWorkspaceEnabled();
  const value = z.boolean().parse(granted);
  const operator = await requireOperator();
  await limit(`soc_ai_consent:${operator.id}`, 10, 60 * 60_000);
  return guarded("consent", async () => {
    await getAiGradingStore().setConsent({ userId: operator.id, granted: value, consentVersion: CALIBRATION_CONSENT_VERSION, updatedAt: new Date().toISOString() });
    await logSecurityEvent({ userId: operator.id, eventType: value ? "soc_ai.calibration_consent_granted" : "soc_ai.calibration_consent_revoked", metadata: { consentVersion: CALIBRATION_CONSENT_VERSION } });
    return { granted: value };
  });
}
