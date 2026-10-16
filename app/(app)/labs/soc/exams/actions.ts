"use server";

/**
 * SOC exam actions (Stage 1). Every export here is browser-callable, so each one checks the flag,
 * the signed-in learner and its input; the service enforces ownership, deadline and budgets.
 */
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { isSocExamsEnabled, isSocWorkspaceEnabled } from "@/lib/config/env";
import { SOC_EXAM_FORMATS } from "@/lib/lab-engine/soc/exam/types";
import {
  getExamLobby,
  getExamState,
  saveHandoffNote,
  saveKnowledgeAnswer,
  startExam,
  submitExam,
  type ExamLobbyView,
  type ExamStateView,
} from "@/lib/lab-engine/soc/exam/service";
import { getExamInsights, submitExamOutcomeReport, type ExamInsightsView } from "@/lib/lab-engine/soc/exam/insights";
import { rateLimit } from "@/lib/security/rate-limit";

const examIdSchema = z.string().uuid();
const formatSchema = z.enum(SOC_EXAM_FORMATS);

function assertEnabled(): void {
  if (!isSocExamsEnabled()) throw new Error("Practice exams are not enabled.");
}

/** Shared limiter (Postgres in production): per learner and action, across all instances. */
async function throttle(userId: string, action: string, max: number, windowMs: number): Promise<void> {
  const r = await rateLimit(`soc_exam:${action}:${userId}`, max, windowMs);
  if (!r.allowed) throw new Error(`Too many requests. Please wait ${Math.ceil(r.retryAfterMs / 1000)}s.`);
}

export async function getSocExamLobbyAction(): Promise<ExamLobbyView> {
  assertEnabled();
  const operator = await requireOperator();
  return getExamLobby(getCtx(), operator.id);
}

export async function startSocExamAction(format: string): Promise<ExamStateView> {
  assertEnabled();
  const f = formatSchema.parse(format);
  if (f !== "knowledge" && !isSocWorkspaceEnabled()) throw new Error("The SOC workspace is not enabled.");
  const operator = await requireOperator();
  await throttle(operator.id, "start", 5, 60_000);
  return startExam(getCtx(), operator.id, f);
}

export async function getSocExamStateAction(examId: string): Promise<ExamStateView> {
  assertEnabled();
  const operator = await requireOperator();
  await throttle(operator.id, "state", 120, 60_000);
  return getExamState(getCtx(), operator.id, examIdSchema.parse(examId));
}

export async function saveSocExamAnswerAction(examId: string, itemId: string, answer: string[]): Promise<{ saved: true }> {
  assertEnabled();
  const operator = await requireOperator();
  await throttle(operator.id, "answer", 90, 60_000);
  return saveKnowledgeAnswer(getCtx(), operator.id, examIdSchema.parse(examId), z.string().regex(/^q[0-9a-f]{12}$/).parse(itemId), z.array(z.string().max(24)).max(8).parse(answer));
}

export async function saveSocExamHandoffAction(examId: string, text: string): Promise<{ saved: true }> {
  assertEnabled();
  const operator = await requireOperator();
  await throttle(operator.id, "handoff", 30, 60_000);
  return saveHandoffNote(getCtx(), operator.id, examIdSchema.parse(examId), z.string().max(6000).parse(text));
}

export async function submitSocExamAction(examId: string): Promise<ExamStateView> {
  assertEnabled();
  const operator = await requireOperator();
  await throttle(operator.id, "submit", 10, 60_000);
  return submitExam(getCtx(), operator.id, examIdSchema.parse(examId));
}

export async function getSocExamInsightsAction(): Promise<ExamInsightsView> {
  assertEnabled();
  const operator = await requireOperator();
  return getExamInsights(getCtx(), operator.id);
}

/** Optional, consented self-report of a real exam outcome. Stored owner-only; never changes scores. */
export async function submitSocExamOutcomeAction(input: unknown): Promise<{ saved: true }> {
  assertEnabled();
  const operator = await requireOperator();
  return submitExamOutcomeReport(getCtx(), operator.id, input);
}
