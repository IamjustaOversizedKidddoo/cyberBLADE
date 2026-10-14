"use server";

/**
 * BladeQL search and investigation questions (S7). Queries run on the server over the
 * attempt-pinned dataset; answers are checked here. The browser never holds the dataset,
 * the seed or any reference answer.
 */
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { isSocQueryEnabled } from "@/lib/config/env";
import { executeInvestigationQuery } from "@/lib/lab-engine/soc/query/pipeline";
import { getQueryWorkspace, submitInvestigationAnswer } from "@/lib/lab-engine/soc/query/question-service";
import type { QueryExecutionResult } from "@/lib/lab-engine/soc/query/types";
import type { QueryWorkspaceView, QuestionSubmissionResult } from "@/lib/lab-engine/soc/query/question-model";

const attemptIdSchema = z.string().uuid();
const answerSchema = z.union([z.string().max(300), z.number().finite(), z.array(z.string().max(200)).max(20)]);

function assertEnabled(): void {
  if (!isSocQueryEnabled()) throw new Error("Log search is not enabled.");
}

export async function getSocQueryWorkspaceAction(attemptId: string): Promise<QueryWorkspaceView> {
  assertEnabled();
  const id = attemptIdSchema.parse(attemptId);
  const operator = await requireOperator();
  return getQueryWorkspace(getCtx(), operator.id, id);
}

export async function runSocQueryAction(
  attemptId: string,
  query: string,
  timeRange?: { earliestEpochMs?: number; latestEpochMs?: number },
): Promise<QueryExecutionResult> {
  assertEnabled();
  const operator = await requireOperator();
  const { result } = await executeInvestigationQuery(getCtx(), operator.id, {
    attemptId: attemptIdSchema.parse(attemptId),
    query,
    timeRange,
  });
  // The engine builds rows with null prototypes (pollution guard); responses must be plain objects.
  return JSON.parse(JSON.stringify(result)) as QueryExecutionResult;
}

export async function submitSocQuestionAnswerAction(
  attemptId: string,
  questionId: string,
  answer: string | number | string[],
): Promise<QuestionSubmissionResult> {
  assertEnabled();
  const operator = await requireOperator();
  return submitInvestigationAnswer(getCtx(), operator.id, {
    attemptId: attemptIdSchema.parse(attemptId),
    questionId: z.string().regex(/^[a-z0-9-]{1,64}$/).parse(questionId),
    answer: answerSchema.parse(answer),
  });
}
