// Record shapes mirror spec §11.2 so a Supabase repo can map them 1:1 to tables later.

export type LessonProgress = {
  userId: string;
  lessonId: string;
  status: "in_progress" | "completed";
  checksPassed: string[];
  completedAt: string | null;
};

export type AttemptMode = "practice" | "challenge";

export type LabAttempt = {
  id: string;
  userId: string;
  labId: string;
  /** Never sent to the browser: seed + public generator code would reveal the answers. */
  seed: string;
  mode: AttemptMode;
  objectivesSolved: string[];
  hintsUsed: number;
  startedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export type XpEvent = { userId: string; source: string; amount: number; createdAt: string };

export type RankChallenge = {
  id: string;
  userId: string;
  rank: number;
  labAttemptId: string;
  status: "active" | "passed" | "failed";
  finishedAt: string | null;
};

export type ProgressData = {
  lessons: Record<string, LessonProgress>;
  attempts: Record<string, LabAttempt>;
  xp: Record<string, XpEvent>;
  challenges: Record<string, RankChallenge>;
};

export const emptyProgress = (): ProgressData => ({ lessons: {}, attempts: {}, xp: {}, challenges: {} });
