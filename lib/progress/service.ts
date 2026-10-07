import { gradeCheck, type CheckSet } from "@/lib/content/checks";
import type { Lesson } from "@/lib/content/schema";
import type { Generator } from "@/lib/generators";
import { newSeed } from "@/lib/generators/rng";
import { checkObjective, generateLab } from "@/lib/lab-engine/checks";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import type { LabEnv } from "@/lib/lab-engine/env";
import type { OperatorStore } from "@/lib/identity/operator-store";
import type { ProgressRepo } from "./repo";
import type { LabAttempt } from "./types";

/** Where lessons, checks and labs come from (repo files in the app, fixtures in tests). */
export type ContentSource = {
  getLesson(id: string): Promise<Lesson | null>;
  getLessons(filter?: { rank?: number }): Promise<Lesson[]>;
  loadChecks(lessonId: string): Promise<CheckSet>;
  loadLab(id: string): Promise<LoadedLab>;
  listLabs(): Promise<LoadedLab[]>;
  generators?: Record<string, Generator>;
};

export type Ctx = { repo: ProgressRepo; operators: OperatorStore; content: ContentSource; now: () => Date };

export type PublicObjective = { id: string; prompt: string; solved: boolean };
export type LabSession = { attemptId: string; env: LabEnv; objectives: PublicObjective[]; completed: boolean };

async function requireLesson(ctx: Ctx, lessonId: string): Promise<Lesson> {
  const lesson = await ctx.content.getLesson(lessonId);
  if (!lesson) throw new Error("not found");
  return lesson;
}

export async function answerCheck(
  ctx: Ctx,
  userId: string,
  lessonId: string,
  questionId: string,
  optionIndex: number,
): Promise<{ correct: boolean; explanations: string[]; lessonCompleted: boolean }> {
  await requireLesson(ctx, lessonId);
  const { correct, explanations } = gradeCheck(await ctx.content.loadChecks(lessonId), questionId, optionIndex, userId);
  if (correct) await ctx.repo.addCheckPassed(userId, lessonId, questionId);
  else await ctx.repo.touchLesson(userId, lessonId);
  return { correct, explanations, lessonCompleted: await tryCompleteLesson(ctx, userId, lessonId) };
}

/** Completes the lesson when every check passed and its lab (if any) is solved. Awards XP once. */
export async function tryCompleteLesson(ctx: Ctx, userId: string, lessonId: string): Promise<boolean> {
  const lesson = await requireLesson(ctx, lessonId);
  const progress = await ctx.repo.getLessonProgress(userId, lessonId);
  if (progress?.status === "completed") return true;
  const checks = await ctx.content.loadChecks(lessonId);
  const passed = new Set(progress?.checksPassed ?? []);
  if (!checks.questions.every((q) => passed.has(q.id))) return false;
  if (lesson.lab && !(await ctx.repo.hasCompletedAttempt(userId, lesson.lab, "practice"))) return false;
  await ctx.repo.markLessonCompleted(userId, lessonId, ctx.now().toISOString());
  await ctx.repo.awardXp(userId, `lesson:${lessonId}`, lesson.xp);
  return true;
}

export function toSession(lab: LoadedLab, attempt: LabAttempt, env: LabEnv): LabSession {
  return {
    attemptId: attempt.id,
    env,
    objectives: lab.objectives.map((o) => ({ id: o.id, prompt: o.prompt, solved: attempt.objectivesSolved.includes(o.id) })),
    completed: attempt.completedAt !== null,
  };
}

/** Opens (or reopens) the learner's practice attempt. Returns the env only — never the seed or answers. */
export async function startLab(ctx: Ctx, userId: string, labId: string): Promise<LabSession> {
  const lab = await ctx.content.loadLab(labId);
  const attempt = await ctx.repo.findOrCreateAttempt(userId, labId, "practice", () => ({
      userId,
      labId,
      seed: newSeed(),
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: ctx.now().toISOString(),
      expiresAt: null,
      completedAt: null,
      failedAt: null,
  }));
  return toSession(lab, attempt, generateLab(lab, attempt.seed, ctx.content.generators).env);
}

/** Checks one answer for an attempt the learner owns; returns the solved list after this submission. */
export async function checkAttemptAnswer(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  objectiveId: string,
  answer: string,
  mode: LabAttempt["mode"],
): Promise<{ lab: LoadedLab; attempt: LabAttempt; correct: boolean; allSolved: boolean }> {
  const found = await ctx.repo.getAttempt(attemptId);
  if (!found || found.userId !== userId || found.mode !== mode) throw new Error("not found");
  const lab = await ctx.content.loadLab(found.labId);
  const { answers } = generateLab(lab, found.seed, ctx.content.generators);
  const correct = checkObjective(lab, answers, objectiveId, answer);
  const attempt = correct ? await ctx.repo.addSolvedObjective(attemptId, objectiveId) : found;
  const allSolved = lab.objectives.every((o) => attempt.objectivesSolved.includes(o.id));
  return { lab, attempt, correct, allSolved };
}

export async function submitObjective(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  objectiveId: string,
  answer: string,
): Promise<{ correct: boolean; labCompleted: boolean; solved: string[] }> {
  const { lab, attempt, correct, allSolved } = await checkAttemptAnswer(ctx, userId, attemptId, objectiveId, answer, "practice");
  if (allSolved) {
    if (!attempt.completedAt) await ctx.repo.updateAttempt(attempt.id, { completedAt: ctx.now().toISOString() });
    await ctx.repo.awardXp(userId, `lab:${lab.id}`, lab.xp);
    for (const lesson of await ctx.content.getLessons()) {
      if (lesson.lab === lab.id) await tryCompleteLesson(ctx, userId, lesson.id);
    }
  }
  return { correct, labCompleted: allSolved, solved: [...attempt.objectivesSolved] };
}
