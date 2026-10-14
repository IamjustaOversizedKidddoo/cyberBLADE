/**
 * Client-safe shapes for BladeQL investigation questions. Nothing here can compute or hold an
 * answer: reference answers live only in the server-only question service.
 */

export type QuestionType = "numeric" | "entity" | "timestamp" | "single_choice" | "multi_select" | "ordering";

export type AnswerValue = string | number | string[];

export const MAX_QUESTION_ATTEMPTS = 5;

export interface LearnerQuestion {
  id: string;
  stem: string;
  type: QuestionType;
  options?: string[];
  skillTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  points: number;
  hintCount: number;
  maxAttempts: number;
  attemptsLeft: number;
  status: "unanswered" | "correct" | "incorrect" | "locked";
  /** Revealed only once the question is solved or locked. */
  debrief: string | null;
  referenceQuery: string | null;
}

/** Same keys for right, wrong and locked answers; reveals only after solve or lockout. */
export interface QuestionSubmissionResult {
  questionId: string;
  isCorrect: boolean;
  attemptsLeft: number;
  status: "correct" | "incorrect" | "locked";
  pointsAwarded: number;
  debrief: string | null;
  referenceQuery: string | null;
}

/** What the search workspace needs to render: never the dataset, seed or truths. */
export interface QueryWorkspaceView {
  questions: LearnerQuestion[];
  fields: string[];
  sources: string[];
  eventCount: number;
  scenarioNowIso: string;
}
