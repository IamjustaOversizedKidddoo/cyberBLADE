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

export type ReviewItemRecord = {
  id: string;
  userId: string;
  cardId: string;
  lessonId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewEventRecord = {
  id: string;
  userId: string;
  cardId: string;
  grade: number;
  reviewedAt: string;
};

export type LearningEventRecord = {
  id: string;
  userId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ExamReportRecord = {
  id: string;
  userId: string;
  examType: string;
  score: number;
  maxScore: number;
  passed: boolean;
  notes?: string | null;
  reportedAt: string;
};

import type {
  SocAttemptRecord,
  SocDecisionRecord,
  SocCaseRecord,
} from "@/lib/lab-engine/soc/types";

export type ProgressData = {
  lessons: Record<string, LessonProgress>;
  attempts: Record<string, LabAttempt>;
  xp: Record<string, XpEvent>;
  challenges: Record<string, RankChallenge>;
  reviewItems?: Record<string, ReviewItemRecord>;
  reviewEvents?: Record<string, ReviewEventRecord>;
  learningEvents?: Record<string, LearningEventRecord>;
  examReports?: Record<string, ExamReportRecord>;
  socAttempts?: Record<string, SocAttemptRecord>;
  socDecisions?: Record<string, SocDecisionRecord>;
  socCases?: Record<string, SocCaseRecord>;
  socUsedSeeds?: Record<string, string[]>;
};

export const emptyProgress = (): ProgressData => ({
  lessons: {},
  attempts: {},
  xp: {},
  challenges: {},
  reviewItems: {},
  reviewEvents: {},
  learningEvents: {},
  examReports: {},
  socAttempts: {},
  socDecisions: {},
  socCases: {},
});

