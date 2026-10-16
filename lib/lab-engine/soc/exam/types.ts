/**
 * SOC exam mode records. Seeds and answer keys stay server-side: `SocExamAttemptRecord.seed` is
 * never sent to the browser and its column is not granted to learners in Postgres.
 */

export const SOC_EXAM_FORMATS = [
  "alert-queue",
  "investigation",
  "knowledge",
  "mini-queue",
  "investigation-l2",
  "detection-rule",
  "knowledge-l2",
] as const;
export type SocExamFormat = (typeof SOC_EXAM_FORMATS)[number];
export type SocExamBudgetKind = "queries" | "lookups" | "questionAnswers";

export type SocExamStatus = "active" | "submitted";
export type SocExamSubmitReason = "learner" | "deadline";

export type SocExamAttemptRecord = {
  id: string;
  userId: string;
  format: SocExamFormat;
  configVersion: number;
  /** Shift or family id for scenario formats; "bank" for knowledge. */
  variantId: string;
  /** The SOC attempt holding decisions, cases, queries, lookups and the report (scenario formats). */
  socAttemptId: string | null;
  /** Knowledge-form seed. Never sent to the browser. */
  seed: string;
  /** Knowledge item ids drawn for this attempt, in order (not secret: the items are shown). */
  itemIds: string[];
  status: SocExamStatus;
  submitReason: SocExamSubmitReason | null;
  startedAt: string;
  deadlineAt: string;
  /** Extended-time accommodation applied at start (1 = none). */
  timeMultiplier: number;
  submittedAt: string | null;
  result: SocExamResult | null;
};

export type SocExamAnswerRecord = {
  id: string;
  examAttemptId: string;
  userId: string;
  /** Knowledge item id, or "handoff" for the alert-queue handoff note. */
  itemId: string;
  /** JSON-encoded answer value. */
  answer: string;
  answeredAt: string;
};

export type SocExamOutcomeReport = {
  id: string;
  userId: string;
  certFamily: string;
  examDate: string;
  passed: boolean;
  consentVersion: string;
  createdAt: string;
};

export type SocExamAccommodation = {
  userId: string;
  multiplier: number;
  reason: string;
  setBy: string;
  setAt: string;
};

export type SkillScore = { skill: string; earned: number; possible: number; percent: number };

export type IntegrityFlag = {
  code: "rapid_decisions" | "budget_exhausted" | "auto_submitted" | "idle_majority";
  detail: string;
};

export type SocExamResult = {
  format: SocExamFormat;
  variantId: string;
  scorePercent: number;
  /** Parts that make up the score, each 0-100 with its weight. */
  components: Array<{ id: string; label: string; percent: number; weight: number; graded: boolean; note?: string }>;
  perSkill: SkillScore[];
  decisionQuality: {
    alertsTotal: number;
    alertsDecided: number;
    correctDispositions: number;
    overEscalations: number;
    underEscalations: number;
    falsePositivesHandled: number;
    falsePositivesTotal: number;
  } | null;
  timeAnalysis: {
    durationSeconds: number;
    budgetSeconds: number;
    withinBudget: boolean;
    medianSecondsPerAlert: number | null;
    longestIdleGapSeconds: number;
    timeToFirstContainmentSeconds: number | null;
  };
  thoroughness: { queries: number; lookups: number; distinctEntitiesLookedUp: number; questionsAnswered: number; questionsTotal: number } | null;
  report: { totalPercent: number; criteria: Array<{ id: string; label: string; status: "graded" | "not_graded"; percent: number | null; note?: string }> } | null;
  knowledge: { correct: number; total: number; byType: Record<string, { correct: number; total: number }> } | null;
  ruleChallenge?: {
    title: string;
    technique: string;
    tactic: string;
    query: string;
    holdOutDetected: number;
    holdOutTotal: number;
    benignTriggered: number;
    benignTotal: number;
    recallPercent: number;
    precisionPercent: number;
    falsePositiveRatePercent: number;
    passed: boolean;
    scorePercent: number;
    feedback: string[];
  } | null;
  integrityFlags: IntegrityFlag[];
  budgetsUsed: Record<string, { used: number; limit: number }>;
  submitReason: SocExamSubmitReason;
};

export type SocRuleTestResult = {
  holdOutTotal: number;
  holdOutDetected: number;
  benignTotal: number;
  benignTriggered: number;
  recallPercent: number;
  precisionPercent: number;
  falsePositiveRatePercent: number;
  passed: boolean;
  scorePercent: number;
  feedback: string[];
};

export type SocDetectionRuleRecord = {
  id: string;
  examAttemptId: string | null;
  userId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  tactic: string;
  technique: string;
  query: string;
  testResults: SocRuleTestResult | null;
  submittedAt: string;
};
