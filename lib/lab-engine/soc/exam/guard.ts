import "server-only";
/**
 * Exam guards for the existing SOC entry points. Every function here is a no-op for practice
 * attempts, so the practice engines keep their behaviour; for exam attempts (scenarioId
 * "exam-<examId>") they enforce the server-stored deadline and the per-exam budgets.
 */
import type { Ctx } from "@/lib/progress/service";
import type { SocAttemptRecord } from "../types";
import type { SocExamAttemptRecord, SocExamBudgetKind } from "./types";
import { loadExamConfig } from "./config";

export const EXAM_SCENARIO_PREFIX = "exam-";

export function isExamSocAttempt(attempt: Pick<SocAttemptRecord, "scenarioId">): boolean {
  return attempt.scenarioId.startsWith(EXAM_SCENARIO_PREFIX);
}

/** The exam that owns this SOC attempt, or null for practice attempts. */
export async function examForSocAttempt(ctx: Ctx, attempt: SocAttemptRecord): Promise<SocExamAttemptRecord | null> {
  if (!isExamSocAttempt(attempt)) return null;
  const exam = await ctx.repo.getSocExamAttempt(attempt.scenarioId.slice(EXAM_SCENARIO_PREFIX.length));
  if (!exam || exam.userId !== attempt.userId || exam.socAttemptId !== attempt.id) throw new Error("Exam attempt not found");
  return exam;
}

export function examTimeIsOver(exam: SocExamAttemptRecord, now: Date): boolean {
  return exam.status !== "active" || now.getTime() >= Date.parse(exam.deadlineAt);
}

/** Throws once the exam is submitted or its server deadline has passed. */
export async function assertExamWritable(ctx: Ctx, attempt: SocAttemptRecord): Promise<SocExamAttemptRecord | null> {
  const exam = await examForSocAttempt(ctx, attempt);
  if (exam && examTimeIsOver(exam, ctx.now())) throw new Error("Exam time is over. Your work has been saved for submission.");
  return exam;
}

/**
 * Practice is paused while the learner has a running exam (L1-A-10): starting a practice attempt
 * or getting any practice evaluation (scorecard, question marks, report grade, model report) would
 * hand out verdicts for the same families and shifts the exam uses. Server-side, so every tab and
 * direct action call is covered.
 */
export async function assertNoRunningExam(ctx: Ctx, userId: string): Promise<void> {
  const exam = await ctx.repo.findActiveSocExam(userId);
  if (exam && !examTimeIsOver(exam, ctx.now())) throw new Error("Finish your exam first: practice feedback is paused while an exam is in progress.");
}

export async function examBudgetUsed(ctx: Ctx, socAttemptId: string, kind: SocExamBudgetKind): Promise<number> {
  if (kind === "queries") return (await ctx.repo.listSocQueryLogs(socAttemptId)).length;
  if (kind === "lookups") return (await ctx.repo.listSocEnrichmentLookups(socAttemptId)).length;
  return (await ctx.repo.listSocQuestionAttempts(socAttemptId)).length;
}

export function examBudgetLimit(exam: SocExamAttemptRecord, kind: SocExamBudgetKind): number {
  // A budget the format does not list is zero: that tool is not part of the format.
  return loadExamConfig().formats[exam.format].budgets[kind] ?? 0;
}

// In-flight reservations per (attempt, kind), so parallel requests cannot overrun a budget.
// shortcut: in-process only, like the question-answer lock; with several server instances the
// overrun is bounded by the instance count.
const pending = new Map<string, number>();
const NOOP = () => undefined;

/**
 * Reserves one unit of an exam budget (deadline checked first). Returns a release function the
 * caller runs once the work is logged (or failed). Practice attempts get a no-op release.
 */
export async function reserveExamBudget(ctx: Ctx, attempt: SocAttemptRecord, kind: SocExamBudgetKind): Promise<() => void> {
  const exam = await assertExamWritable(ctx, attempt);
  if (!exam) return NOOP;
  const key = `${attempt.id}:${kind}`;
  const inFlight = pending.get(key) ?? 0;
  pending.set(key, inFlight + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const n = (pending.get(key) ?? 1) - 1;
    if (n <= 0) pending.delete(key);
    else pending.set(key, n);
  };
  const limit = examBudgetLimit(exam, kind);
  const used = await examBudgetUsed(ctx, attempt.id, kind);
  if (used + inFlight >= limit) {
    release();
    throw new Error(`Exam budget used up: ${limit} ${BUDGET_LABEL[kind]} allowed in this exam.`);
  }
  return release;
}

export const BUDGET_LABEL: Record<SocExamBudgetKind, string> = {
  queries: "searches",
  lookups: "enrichment lookups",
  questionAnswers: "question answers",
};
