import type {
  SocDisposition,
  SocSeverity,
  SocEscalationTier,
  SocScenarioClient,
} from "./schema";
import type { SocReportData, GradingResult, PreSubmitLintResult } from "./reports/types";

export type SocAttemptStatus = "in_progress" | "submitted" | "abandoned" | "expired";

export type SocAttemptRecord = {
  id: string;
  userId: string;
  scenarioId: string;
  seed: string;
  status: SocAttemptStatus;
  scoreSummary: SocEvaluationResult | null;
  startedAt: string;
  submittedAt: string | null;
  updatedAt: string;
  familyId?: string;
  familyVersion?: number;
  generatorVersion?: string;
  difficulty?: string;
  scenarioHash?: string;
};

export type SocDecisionRecord = {
  id: string;
  attemptId: string;
  alertId: string;
  disposition: SocDisposition;
  severity: SocSeverity;
  escalate: boolean;
  targetTier: SocEscalationTier | null;
  rationale: string;
  evidenceRefs: string[];
  createdAt: string;
};

export type SocCaseStatus = "open" | "investigating" | "escalated" | "closed";

export type SocCaseRecord = {
  id: string;
  attemptId: string;
  title: string;
  severity: SocSeverity;
  status: SocCaseStatus;
  notes: string;
  alertIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AlertEvaluation = {
  alertId: string;
  isCorrect: boolean;
  learnerDisposition: SocDisposition | null;
  correctDisposition: SocDisposition;
  learnerSeverity: SocSeverity | null;
  correctSeverity: SocSeverity;
  learnerEscalate: boolean | null;
  correctEscalate: boolean;
  acceptableAlternativeMatched?: boolean;
  alternativeReason?: string;
  pointsEarned: number;
  maxPoints: number;
  debrief?: string; // Only populated for alerts the learner decided on!
};

export type IncidentEvaluation = {
  incidentId: string;
  title: string;
  detected: boolean;
  foundAlertCount: number;
  totalAlertCount: number;
};

export type SkillEvaluation = {
  skillId: string;
  skillTitle: string;
  pointsEarned: number;
  maxPoints: number;
  percentage: number;
};

export type SocEvaluationResult = {
  attemptId: string;
  scenarioId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  alertsTotal: number;
  alertsDecided: number;
  truePositivesFound: number;
  truePositivesTotal: number;
  falsePositivesHandled: number;
  falsePositivesTotal: number;
  overEscalatedCount: number;
  underEscalatedCount: number;
  incidents: IncidentEvaluation[];
  skills: SkillEvaluation[];
  alertResults: AlertEvaluation[];
  overallDebrief: string;
  submittedAt: string;
};

export type SocSessionClient = {
  attempt: {
    id: string;
    scenarioId: string;
    status: SocAttemptStatus;
    startedAt: string;
    submittedAt: string | null;
  };
  scenario: SocScenarioClient;
  decisions: Record<string, SocDecisionRecord>; // Keyed by alertId (latest active decision)
  cases: SocCaseRecord[];
  results: SocEvaluationResult | null;
};

export type SocQueryLogRecord = {
  id: string;
  attemptId: string;
  userId: string;
  languageVersion: string;
  queryText: string;
  resultRowCount: number;
  executionSteps: number;
  durationMs: number;
  budgetFlags: Record<string, boolean>;
  createdAt: string;
};

export type SocQuestionAttemptRecord = {
  id: string;
  attemptId: string;
  userId: string;
  questionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  attemptsUsed: number;
  hintsUsed: number;
  createdAt: string;
};

/**
 * Persisted draft or submitted report document.
 * status='draft' rows are upserted in-place; status='submitted' rows are immutable.
 */
export type SocReportSubmissionRecord = {
  id: string;
  attemptId: string;
  userId: string;
  templateId: string;
  templateVersion: string;
  status: "draft" | "submitted";
  reportData: SocReportData;
  lintResults: PreSubmitLintResult | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Persisted grading result. One-to-one with a submitted SocReportSubmissionRecord.
 * model_report_reveal is NOT stored here — returned only by the server action
 * that confirms submission (ground-truth containment).
 */
export type SocReportEvaluationRecord = {
  id: string;
  submissionId: string;
  attemptId: string;
  userId: string;
  rubricId: string;
  rubricVersion: string;
  graderVersion: string;
  scoringVersion: string;
  totalScore: number;
  maxScore: number;
  isFullyGraded: boolean;
  criterionResults: GradingResult["criterionResults"];
  flags: GradingResult["flags"];
  versionLabel: string;
  computedAt: string;
};
