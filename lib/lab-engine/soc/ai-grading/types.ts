/**
 * Types for AI-assisted grading of the communication criteria of SOC reports.
 * The deterministic grader stays authoritative; nothing here touches its results.
 */

export const AI_GRADING_MODES = ["off", "shadow", "preview", "live"] as const;
export type AiGradingMode = (typeof AI_GRADING_MODES)[number];

export const AI_CRITERION_IDS = [
  "narrative_quality",
  "reasoning_evidence_linkage",
  "coherence",
  "recommendation_quality",
  "handoff_usefulness",
  "tone_concision",
] as const;
export type AiCriterionId = (typeof AI_CRITERION_IDS)[number];

/** Report sections the AI layer may read, by name. Ground truth has no entry here on purpose. */
export const AI_REPORT_FIELDS = [
  "executiveSummary",
  "attackNarrative",
  "verdictJustification",
  "timelineDescriptions",
  "iocNotes",
  "lessonsLearned",
  "actions",
  "escalationTeam",
  "escalationUrgency",
  "handoffSummary",
] as const;
export type AiReportField = (typeof AI_REPORT_FIELDS)[number];

export type Band = 0 | 1 | 2 | 3;

export interface AiRubricBand {
  band: Band;
  label: string;
  descriptor: string;
  anchors: [string, string];
}

export interface AiRubricCriterion {
  id: AiCriterionId;
  title: string;
  weight: number;
  fields: AiReportField[];
  question: string;
  bands: [AiRubricBand, AiRubricBand, AiRubricBand, AiRubricBand];
}

export interface AiRubric {
  rubricId: string;
  version: string;
  appliesTo: { rubricId: string; rubricVersion: string };
  criteria: AiRubricCriterion[];
}

/** Everything the model is allowed to see, already sanitized. Built only by buildAiGradingInput. */
export interface AiGradingInput {
  /** Sanitized learner text per field (bidi/zero-width removed, PII replaced). */
  fields: Partial<Record<AiReportField, string>>;
  /** Learner-visible scenario facts (title + briefing from the client view). */
  scenarioFacts: string;
  /** Template guidance per field, as shown to the learner. */
  templateGuidance: Partial<Record<AiReportField, string>>;
}

export type NotGradedReason =
  | "mode_off"
  | "kill_switch"
  | "empty"
  | "template_only"
  | "copy_paste_dominated"
  | "over_length"
  | "user_quota"
  | "submission_token_cap"
  | "global_ceiling"
  | "provider_unavailable"
  | "invalid_output"
  | "insufficient_valid_samples";

export type AiGradeStatus = "graded" | "not_graded" | "needs_review";
export type AiConfidence = "low" | "medium" | "high";
export type AiGradeSource = "ai" | "human_accept" | "human_override";

export interface VerifiedSpan {
  text: string;
  field: AiReportField;
  start: number;
  end: number;
}

export interface AiLearnerFeedback {
  /** Built from the rubric band label/descriptor, never from model prose. */
  summary: string;
  strengths: string[];
  improvements: string[];
}

export type AiGradeFlag =
  | "injection_signals"
  | "canary_leak"
  | "disagreement"
  | "sanity_high_band_short_text"
  | "spans_in_instruction_region"
  | "insufficient_information";

export interface AiCriterionGradeRecord {
  id: string;
  submissionId: string;
  attemptId: string;
  userId: string;
  criterionId: AiCriterionId;
  status: AiGradeStatus;
  notGradedReason?: NotGradedReason;
  band?: Band;
  confidence?: AiConfidence;
  /** True when this grade may count toward the total in live mode (graded, not low-confidence). */
  eligibleToCount: boolean;
  feedback: AiLearnerFeedback;
  verifiedSpans: VerifiedSpan[];
  flags: AiGradeFlag[];
  aiRubricId: string;
  aiRubricVersion: string;
  promptVersion: string;
  graderVersion: string;
  modelId: string;
  params: { temperature: number; samples: number; maxOutputTokens: number };
  inputHash: string;
  cacheKey: string;
  inputTokens: number;
  outputTokens: number;
  source: AiGradeSource;
  supersedesId?: string;
  reviewerPseudonym?: string;
  createdAt: string;
}

export interface AiRawOutputRecord {
  id: string;
  gradeId: string;
  userId: string;
  sampleIndex: number;
  attempt: number;
  rawText: string;
  promptHash: string;
  createdAt: string;
}

export type AiJobStatus = "pending" | "running" | "succeeded" | "dead";

export interface AiGradingJobRecord {
  id: string;
  submissionId: string;
  attemptId: string;
  userId: string;
  criterionId: AiCriterionId;
  idempotencyKey: string;
  status: AiJobStatus;
  attempts: number;
  nextRunAt: string;
  leaseUntil?: string;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type AiReviewReason =
  | "low_confidence"
  | "needs_review"
  | "injection_flagged"
  | "random_sample"
  | "learner_request";

export interface AiReviewItemRecord {
  id: string;
  gradeId: string;
  submissionId: string;
  userId: string;
  criterionId: AiCriterionId;
  reason: AiReviewReason;
  status: "open" | "resolved";
  resolution?: "accepted" | "overridden";
  resolvedGradeId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AiHumanReviewRequestRecord {
  id: string;
  submissionId: string;
  userId: string;
  createdAt: string;
  status: "open" | "resolved";
}

export interface AiCalibrationConsentRecord {
  userId: string;
  granted: boolean;
  consentVersion: string;
  updatedAt: string;
}

export interface AiUsageRecord {
  key: string; // `${userId}:${date}` or `__global__:${date}`
  submissionsGraded: number;
  inputTokens: number;
  outputTokens: number;
}
