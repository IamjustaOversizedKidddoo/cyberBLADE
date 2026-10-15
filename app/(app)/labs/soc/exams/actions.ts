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

const examIdSchema = z.string().uuid();
const formatSchema = z.enum(SOC_EXAM_FORMATS);

function assertEnabled(): void {
  if (!isSocExamsEnabled()) throw new Error("Practice exams are not enabled.");
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
  return startExam(getCtx(), operator.id, f);
}

export async function getSocExamStateAction(examId: string): Promise<ExamStateView> {
  assertEnabled();
  const operator = await requireOperator();
  return getExamState(getCtx(), operator.id, examIdSchema.parse(examId));
}

export async function saveSocExamAnswerAction(examId: string, itemId: string, answer: string[]): Promise<{ saved: true }> {
  assertEnabled();
  const operator = await requireOperator();
  return saveKnowledgeAnswer(getCtx(), operator.id, examIdSchema.parse(examId), z.string().regex(/^kb-[a-z0-9-]{1,60}$/).parse(itemId), z.array(z.string().max(24)).max(8).parse(answer));
}

export async function saveSocExamHandoffAction(examId: string, text: string): Promise<{ saved: true }> {
  assertEnabled();
  const operator = await requireOperator();
  return saveHandoffNote(getCtx(), operator.id, examIdSchema.parse(examId), z.string().max(6000).parse(text));
}

export async function submitSocExamAction(examId: string): Promise<ExamStateView> {
  assertEnabled();
  const operator = await requireOperator();
  return submitExam(getCtx(), operator.id, examIdSchema.parse(examId));
}
