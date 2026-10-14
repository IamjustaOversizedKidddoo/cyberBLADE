import { newSeed } from "@/lib/generators/rng";
import { generateLab } from "@/lib/lab-engine/checks";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import { checkAttemptAnswer, toSession, type Ctx, type LabSession } from "./service";

export type ChallengeState =
  | { kind: "locked" }
  | { kind: "ready" }
  | { kind: "active"; attemptId: string; expiresAt: string }
  | { kind: "cooldown"; retryAt: string }
  | { kind: "passed" };

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/** Pure: what the learner can do with a rank challenge right now. */
export function challengeState(input: {
  allLessonsDone: boolean;
  passed: boolean;
  active?: { attemptId: string; expiresAt: Date };
  lastFailedAt?: Date;
  cooldownMinutes: number;
  now: Date;
}): ChallengeState {
  const { allLessonsDone, passed, active, lastFailedAt, cooldownMinutes, now } = input;
  if (passed) return { kind: "passed" };
  if (active && now <= active.expiresAt) return { kind: "active", attemptId: active.attemptId, expiresAt: active.expiresAt.toISOString() };
  // An attempt that ran out of time counts as failed at its deadline.
  const failedAt = active ? active.expiresAt : lastFailedAt;
  if (failedAt) {
    const retryAt = addMinutes(failedAt, cooldownMinutes);
    if (now < retryAt) return { kind: "cooldown", retryAt: retryAt.toISOString() };
  }
  if (!allLessonsDone) return { kind: "locked" };
  return { kind: "ready" };
}

export async function findChallengeLab(ctx: Ctx, rank: number): Promise<LoadedLab> {
  const lab = (await ctx.content.listLabs()).find((l) => l.challenge?.rank === rank);
  if (!lab?.challenge) throw new Error(`no challenge for rank ${rank}`);
  return lab;
}

/** Marks an active challenge whose time ran out as failed at its deadline. */
async function expireIfNeeded(ctx: Ctx, userId: string, rank: number): Promise<void> {
  const active = await ctx.repo.getActiveChallenge(userId, rank);
  if (!active) return;
  const attempt = await ctx.repo.getAttempt(active.labAttemptId);
  if (!attempt?.expiresAt || ctx.now() <= new Date(attempt.expiresAt)) return;
  await ctx.repo.updateAttempt(attempt.id, { failedAt: attempt.expiresAt });
  await ctx.repo.updateChallenge(active.id, { status: "failed", finishedAt: attempt.expiresAt });
}

export type RankSummary = {
  lessons: { id: string; title: string; status: "not_started" | "in_progress" | "completed" }[];
  allLessonsDone: boolean;
  challenge: ChallengeState;
  timeLimitMinutes: number;
};

export async function getRankSummary(ctx: Ctx, userId: string, rank: number): Promise<RankSummary> {
  await expireIfNeeded(ctx, userId, rank);
  const lab = await findChallengeLab(ctx, rank);
  const [lessons, progress, passed, active, lastFailed] = await Promise.all([
    ctx.content.getLessons({ rank }),
    ctx.repo.listLessonProgress(userId),
    ctx.repo.hasPassedChallenge(userId, rank),
    ctx.repo.getActiveChallenge(userId, rank),
    ctx.repo.getLastFailedChallenge(userId, rank),
  ]);
  const statusOf = (id: string): RankSummary["lessons"][number]["status"] =>
    progress.find((p) => p.lessonId === id)?.status ?? "not_started";
  // Rank promotion is about the shared core only; track lessons (e.g. SOC L1) gate by their own config.
  const list = lessons.filter((l) => l.track === "core").map((l) => ({ id: l.id, title: l.title, status: statusOf(l.id) }));
  // With no visible lessons there is nothing to have completed: keep the challenge locked.
  const allLessonsDone = list.length > 0 && list.every((l) => l.status === "completed");
  const activeAttempt = active ? await ctx.repo.getAttempt(active.labAttemptId) : null;
  const challenge = challengeState({
    allLessonsDone,
    passed,
    active: active && activeAttempt?.expiresAt ? { attemptId: activeAttempt.id, expiresAt: new Date(activeAttempt.expiresAt) } : undefined,
    lastFailedAt: lastFailed?.finishedAt ? new Date(lastFailed.finishedAt) : undefined,
    cooldownMinutes: lab.challenge!.cooldown_minutes,
    now: ctx.now(),
  });
  return { lessons: list, allLessonsDone, challenge, timeLimitMinutes: lab.challenge!.time_limit_minutes };
}

export type ChallengeSession = LabSession & { expiresAt: string; labTitle: string; briefingText: string };

async function sessionFor(ctx: Ctx, lab: LoadedLab, attemptId: string): Promise<ChallengeSession> {
  const attempt = await ctx.repo.getAttempt(attemptId);
  if (!attempt?.expiresAt) throw new Error("not found");
  return {
    ...toSession(lab, attempt, generateLab(lab, attempt.seed, ctx.content.generators).env),
    expiresAt: attempt.expiresAt,
    labTitle: lab.title,
    briefingText: lab.briefingText,
  };
}

/** The running challenge (e.g. after a refresh), or null. */
export async function getChallengeSession(ctx: Ctx, userId: string, rank: number): Promise<ChallengeSession | null> {
  const summary = await getRankSummary(ctx, userId, rank);
  if (summary.challenge.kind !== "active") return null;
  return sessionFor(ctx, await findChallengeLab(ctx, rank), summary.challenge.attemptId);
}

export async function startChallenge(ctx: Ctx, userId: string, rank: number): Promise<ChallengeSession> {
  const summary = await getRankSummary(ctx, userId, rank);
  if (summary.challenge.kind !== "ready") throw new Error(`challenge is ${summary.challenge.kind}`);
  const lab = await findChallengeLab(ctx, rank);
  const now = ctx.now();
  // The summary check above gives a friendly error; this atomic step is what actually guarantees
  // one attempt at a time and the cooldown, even with several tabs pressing Start together.
  const attempt = await ctx.repo.startChallengeAtomic({
    userId,
    rank,
    cooldownMinutes: lab.challenge!.cooldown_minutes,
    now,
    attempt: {
      userId,
      labId: lab.id,
      seed: newSeed(),
      mode: "challenge",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: now.toISOString(),
      expiresAt: addMinutes(now, lab.challenge!.time_limit_minutes).toISOString(),
      completedAt: null,
      failedAt: null,
    },
  });
  return sessionFor(ctx, lab, attempt.id);
}

async function challengeFor(ctx: Ctx, userId: string, attemptId: string) {
  const attempt = await ctx.repo.getAttempt(attemptId);
  if (!attempt || attempt.userId !== userId || attempt.mode !== "challenge") throw new Error("not found");
  const lab = await ctx.content.loadLab(attempt.labId);
  if (!lab.challenge) throw new Error("not found");
  const rank = lab.challenge.rank;
  const active = await ctx.repo.getActiveChallenge(userId, rank);
  return { attempt, lab, rank, active: active?.labAttemptId === attemptId ? active : null };
}

/** Deadline is enforced here, on the server; the browser timer is display only. */
export async function submitChallengeObjective(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  objectiveId: string,
  answer: string,
): Promise<{ correct: boolean; passed?: boolean; expired?: boolean }> {
  const { attempt, lab, rank, active } = await challengeFor(ctx, userId, attemptId);
  if (await ctx.repo.hasPassedChallenge(userId, rank)) return { correct: true, passed: true };
  if (!active) return { correct: false, expired: true };
  if (ctx.now() > new Date(attempt.expiresAt!)) {
    await expireIfNeeded(ctx, userId, rank);
    return { correct: false, expired: true };
  }

  const { correct, allSolved } = await checkAttemptAnswer(ctx, userId, attemptId, objectiveId, answer, "challenge");
  if (!allSolved) return { correct, passed: false };

  const now = ctx.now().toISOString();
  await ctx.repo.updateAttempt(attemptId, { completedAt: now });
  await ctx.repo.updateChallenge(active.id, { status: "passed", finishedAt: now });
  const operator = await ctx.operators.get(userId);
  if (operator && operator.rank <= rank) await ctx.operators.setRank(userId, rank + 1);
  await ctx.repo.awardXp(userId, `challenge:${lab.track}-r${rank}`, lab.xp);
  return { correct, passed: true };
}

/** Gives up the running attempt now; the cooldown starts immediately. */
export async function abandonChallenge(ctx: Ctx, userId: string, attemptId: string): Promise<void> {
  const { active } = await challengeFor(ctx, userId, attemptId);
  if (!active) return;
  const now = ctx.now().toISOString();
  await ctx.repo.updateAttempt(attemptId, { failedAt: now });
  await ctx.repo.updateChallenge(active.id, { status: "failed", finishedAt: now });
}
