"use server";

/**
 * In-app feedback and "report a problem". The browser sends a kind, the route and an optional
 * reference; the server derives the content id from records it owns (exam item keys map to bank
 * ids, attempts to their scenario), so the client never names a bank item or scenario family.
 * Text is length-limited and stripped of control characters; it is stored as data and escaped on
 * output. Every submission gets a request id the learner can quote.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { getBetaStore } from "@/lib/beta";
import { rateLimit } from "@/lib/security/rate-limit";
import { log } from "@/lib/observability/logger";
import { examItemKey } from "@/lib/lab-engine/soc/exam/knowledge";

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const inputSchema = z.object({
  kind: z.enum(["general", "lesson_check", "exam_question", "scenario"]),
  route: z.string().max(200).regex(/^\/[A-Za-z0-9\-_/.~%]*$/),
  message: z.string().min(1).max(2000),
  ref: z
    .union([
      z.object({ lessonId: slug, questionId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/) }),
      z.object({ examId: z.string().uuid(), itemKey: z.string().regex(/^q[0-9a-f]{12}$/) }),
      z.object({ attemptId: z.string().uuid() }),
    ])
    .optional(),
});

export type FeedbackResult = { ok: true; requestId: string } | { ok: false; error: string; requestId: string };

async function contentIdFor(userId: string, input: z.infer<typeof inputSchema>): Promise<string> {
  const ctx = getCtx();
  const ref = input.ref;
  if (input.kind === "lesson_check" && ref && "lessonId" in ref) return `${ref.lessonId}:${ref.questionId}`;
  if (input.kind === "exam_question" && ref && "examId" in ref) {
    const exam = await ctx.repo.getSocExamAttempt(ref.examId);
    if (!exam || exam.userId !== userId) return "exam:unknown";
    return exam.itemIds.find((id) => examItemKey(exam.seed, id) === ref.itemKey) ?? "exam:unknown";
  }
  if (input.kind === "scenario" && ref && "attemptId" in ref) {
    const attempt = await ctx.repo.getSocAttempt(ref.attemptId);
    if (!attempt || attempt.userId !== userId) return "scenario:unknown";
    if (attempt.scenarioId.startsWith("exam-")) {
      const exam = await ctx.repo.getSocExamAttempt(attempt.scenarioId.slice(5));
      return exam ? `exam:${exam.format}:${exam.variantId}` : "exam:unknown";
    }
    return attempt.familyId ?? attempt.scenarioId;
  }
  return "";
}

export async function submitFeedbackAction(raw: unknown): Promise<FeedbackResult> {
  const requestId = randomUUID();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please write a message of up to 2,000 characters.", requestId };
  const operator = await requireOperator();
  if (!(await rateLimit(`feedback:${operator.id}`, 10, 60 * 60_000)).allowed) {
    return { ok: false, error: "You've sent a lot of feedback in the last hour. Please try again later.", requestId };
  }
  const message = parsed.data.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 2000);
  if (!message) return { ok: false, error: "Please write a message.", requestId };
  const contentId = await contentIdFor(operator.id, parsed.data);
  await getBetaStore().saveFeedback({ userId: operator.id, kind: parsed.data.kind, contentId, route: parsed.data.route.split("?")[0], message, requestId }, new Date().toISOString());
  log.info("feedback received", { requestId, kind: parsed.data.kind, contentId });
  return { ok: true, requestId };
}
