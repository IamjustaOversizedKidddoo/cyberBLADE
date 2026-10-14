import "server-only";
/**
 * Server-side investigation questions (S7). Reference answers are rebuilt from the
 * attempt-pinned seed on every call and never leave this module; attempts are persisted, so
 * counts and lockouts survive reloads and cannot be reset from the browser.
 */
import type { Ctx } from "@/lib/progress/service";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { resolveScenarioForAttempt } from "../engine";
import type { SocAttemptRecord, SocQuestionAttemptRecord } from "../types";
import { investigationDataset } from "./investigation-dataset";
import { datasetEndMs } from "./pipeline";
import {
  MAX_QUESTION_ATTEMPTS,
  type AnswerValue,
  type LearnerQuestion,
  type QueryWorkspaceView,
  type QuestionSubmissionResult,
} from "./question-model";
import { generateScenarioQuestions, verifyAnswer } from "./questions";

/** Every answer response takes at least this long, right or wrong (no timing oracle). */
export const ANSWER_RESPONSE_FLOOR_MS = 250;

async function ownedAttempt(ctx: Ctx, userId: string, attemptId: string): Promise<SocAttemptRecord> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found or not owned by user.");
  return attempt;
}

async function questionSet(attempt: SocAttemptRecord) {
  const scenario = await resolveScenarioForAttempt(attempt);
  return { scenario, ...generateScenarioQuestions(scenario, attempt.seed, attempt.familyId ?? attempt.scenarioId) };
}

function stateFor(records: SocQuestionAttemptRecord[]) {
  const used = records.length;
  const solved = records.some((r) => r.isCorrect);
  const status: LearnerQuestion["status"] = solved ? "correct" : used >= MAX_QUESTION_ATTEMPTS ? "locked" : used > 0 ? "incorrect" : "unanswered";
  return { used, status, attemptsLeft: Math.max(0, MAX_QUESTION_ATTEMPTS - used) };
}

export async function getQueryWorkspace(ctx: Ctx, userId: string, attemptId: string): Promise<QueryWorkspaceView> {
  const attempt = await ownedAttempt(ctx, userId, attemptId);
  const { scenario, learnerQuestions, serverTruths } = await questionSet(attempt);
  const dataset = investigationDataset(scenario, attempt.seed);
  const history = await ctx.repo.listSocQuestionAttempts(attempt.id);

  const questions = learnerQuestions.map((q) => {
    const s = stateFor(history.filter((h) => h.questionId === q.id));
    const reveal = s.status === "correct" || s.status === "locked";
    const truth = serverTruths.find((t) => t.id === q.id);
    return {
      ...q,
      status: s.status,
      attemptsLeft: s.attemptsLeft,
      debrief: reveal ? (truth?.debrief ?? null) : null,
      referenceQuery: reveal ? (truth?.referenceQuery ?? null) : null,
    };
  });
  const last = new Date(datasetEndMs(dataset.events)).toISOString();
  return { questions, fields: [...dataset.fields], sources: [...dataset.sources], eventCount: dataset.eventCount, scenarioNowIso: last };
}

// One submission at a time per (attempt, question) in this process, so the attempt cap cannot be
// raced. shortcut: in-process only; with several server instances use a DB unique/serializable check.
const inFlight = new Map<string, Promise<unknown>>();

export async function submitInvestigationAnswer(
  ctx: Ctx,
  userId: string,
  input: { attemptId: string; questionId: string; answer: AnswerValue },
): Promise<QuestionSubmissionResult> {
  const started = Date.now();
  const key = `${input.attemptId}:${input.questionId}`;
  const prev = inFlight.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => evaluate(ctx, userId, input));
  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    if (inFlight.get(key) === run) inFlight.delete(key);
    const elapsed = Date.now() - started;
    if (elapsed < ANSWER_RESPONSE_FLOOR_MS) await new Promise((r) => setTimeout(r, ANSWER_RESPONSE_FLOOR_MS - elapsed));
  }
}

async function evaluate(
  ctx: Ctx,
  userId: string,
  input: { attemptId: string; questionId: string; answer: AnswerValue },
): Promise<QuestionSubmissionResult> {
  const attempt = await ownedAttempt(ctx, userId, input.attemptId);
  if (attempt.status !== "in_progress") throw new Error("This attempt is closed.");

  const perQuestion = checkRateLimit(`soc_q_answer:${userId}:${key(input)}`, 1, 1500);
  const perUser = checkRateLimit(`soc_q_answer_user:${userId}`, 30, 60_000);
  if (!perQuestion.allowed || !perUser.allowed) throw new Error("Rate limit exceeded: Please wait before submitting another answer.");

  const { serverTruths } = await questionSet(attempt);
  const truth = serverTruths.find((t) => t.id === input.questionId);
  if (!truth) throw new Error("Unknown question.");

  const history = (await ctx.repo.listSocQuestionAttempts(attempt.id)).filter((h) => h.questionId === input.questionId);
  const before = stateFor(history);
  if (before.status === "correct" || before.status === "locked") {
    // Settled questions are not re-evaluated; the response shape is the same as any other.
    return {
      questionId: input.questionId,
      isCorrect: before.status === "correct",
      attemptsLeft: before.attemptsLeft,
      status: before.status,
      pointsAwarded: 0,
      debrief: truth.debrief,
      referenceQuery: truth.referenceQuery,
    };
  }

  const isCorrect = verifyAnswer(input.answer, truth).isCorrect;
  await ctx.repo.saveSocQuestionAttempt({
    attemptId: attempt.id,
    userId,
    questionId: input.questionId,
    submittedAnswer: JSON.stringify(input.answer).slice(0, 500),
    isCorrect,
    attemptsUsed: before.used + 1,
    hintsUsed: 0,
  });
  const after = stateFor([...history, { isCorrect } as SocQuestionAttemptRecord]);
  const reveal = after.status === "correct" || after.status === "locked";
  return {
    questionId: input.questionId,
    isCorrect,
    attemptsLeft: after.attemptsLeft,
    status: after.status === "correct" ? "correct" : after.status === "locked" ? "locked" : "incorrect",
    pointsAwarded: isCorrect ? 10 : 0,
    debrief: reveal ? truth.debrief : null,
    referenceQuery: reveal ? truth.referenceQuery : null,
  };
}

function key(input: { attemptId: string; questionId: string }): string {
  return `${input.attemptId}:${input.questionId}`;
}
