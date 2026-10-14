/**
 * Seams for future SOC report grading extensions.
 *
 * All interfaces defined here are typed hooks for later prompts.
 * Default implementations return "not_available" or no-ops.
 * DO NOT implement real logic here — this is the contract only.
 */

import type {
  SocReportData,
  SocReportGroundTruth,
  CriterionResult,
  ReportRubric,
  ScoringConfig,
  GradingResult,
} from "./types";

// ============================================================================
// 1. AI Criterion Grader Seam
// ============================================================================

/**
 * Interface for AI-assisted grading of a single rubric criterion.
 * The default implementation returns { status: "not_available" }.
 * Future prompts will provide an LLM-backed implementation that evaluates
 * narrative quality, coherence, and technical writing against the rubric.
 */
export interface AiCriterionGrader {
  /**
   * Grade a single criterion using AI analysis.
   * @param criterionId - The rubric criterion to grade (e.g., "narrative_quality")
   * @param report - The sanitized learner report (treated as passive data, never as instructions)
   * @param groundTruth - The scenario ground truth for comparison
   * @param rubric - The full rubric for context
   * @returns A CriterionResult with status "graded" or "not_available"
   */
  gradeCriterion(
    criterionId: string,
    report: SocReportData,
    groundTruth: SocReportGroundTruth,
    rubric: ReportRubric,
  ): Promise<CriterionResult>;
}

/** Default no-op AI grader — returns not_available for all criteria */
export const defaultAiCriterionGrader: AiCriterionGrader = {
  async gradeCriterion(criterionId: string): Promise<CriterionResult> {
    return {
      criterionId,
      score: 0,
      maxScore: 0,
      weight: 0,
      status: "not_available",
      feedback: "AI-assisted narrative grading is not yet available in this version.",
      teachingPointers: [],
      annotations: [],
      missedItems: [],
      flags: [],
    };
  },
};

// ============================================================================
// 2. Calibration Seam
// ============================================================================

/**
 * A paired calibration sample: a learner report scored by both the engine
 * and a human practitioner. Used to compute correlation metrics.
 */
export interface CalibrationSample {
  sampleId: string;
  reportData: SocReportData;
  groundTruth: SocReportGroundTruth;
  engineResult: GradingResult;
  humanScores: Record<string, number>; // criterionId → human score
  humanNotes?: string;
  practitionerId: string;
  calibratedAt: string;
}

/**
 * Calibration metrics computed from a set of paired samples.
 */
export interface CalibrationMetrics {
  setId: string;
  sampleCount: number;
  pearsonCorrelation: number;
  meanAbsoluteError: number;
  bandAgreement: number; // fraction of criteria where engine and human agree within 1 band
  criterionBreakdown: Record<
    string,
    {
      pearson: number;
      mae: number;
      bandAgreement: number;
    }
  >;
  computedAt: string;
}

/**
 * Calibration harness interface. Default returns empty metrics.
 */
export interface CalibrationHarness {
  loadCalibrationSet(setId: string): Promise<CalibrationSample[]>;
  computeMetrics(samples: CalibrationSample[]): CalibrationMetrics;
}

export const defaultCalibrationHarness: CalibrationHarness = {
  async loadCalibrationSet(): Promise<CalibrationSample[]> {
    return [];
  },
  computeMetrics(): CalibrationMetrics {
    return {
      setId: "none",
      sampleCount: 0,
      pearsonCorrelation: 0,
      meanAbsoluteError: 0,
      bandAgreement: 0,
      criterionBreakdown: {},
      computedAt: new Date().toISOString(),
    };
  },
};

// ============================================================================
// 3. Mock Exam Seam
// ============================================================================

export interface ExamSubmissionResult {
  submissionId: string;
  attemptId: string;
  accepted: boolean;
  reason?: string; // e.g. "already_submitted", "time_expired"
  gradingResult?: GradingResult;
}

/**
 * Strict 1-shot time-boxed exam submission.
 * Future prompt implements time enforcement and single-submission policy.
 */
export async function submitExamReport(
  _submission: SocReportData,
  _attemptId: string,
  _scoringConfig?: ScoringConfig,
): Promise<ExamSubmissionResult> {
  void _submission;
  void _scoringConfig;
  return {
    submissionId: "",
    attemptId: _attemptId,
    accepted: false,
    reason: "exam_mode_not_implemented",
  };
}

// ============================================================================
// 4. Handler SOC Mode Seam
// ============================================================================

/**
 * Summary of a learner's report draft exposed to the Handler for
 * pedagogical Socratic dialogue — WITHOUT revealing ground truth.
 */
export interface LearnerReportSummary {
  attemptId: string;
  templateId: string;
  sectionsCompleted: string[];
  sectionsIncomplete: string[];
  iocCount: number;
  timelineRowCount: number;
  actionsSelected: string[];
  hasEscalation: boolean;
  draftWordCount: number;
  lastUpdatedAt: string;
}

/**
 * Returns a ground-truth-free summary of the learner's draft state.
 * The Handler can use this to guide the learner with Socratic questions
 * without ever seeing the correct answers.
 */
export function getLearnerReportSummary(
  _attemptId: string,
): LearnerReportSummary | null {
  void _attemptId;
  // Future implementation will query the draft storage adapter
  return null;
}

// ============================================================================
// 5. Portfolio & Export Seam
// ============================================================================

export interface ExportOptions {
  format: "markdown" | "html_print";
  includeScorecard: boolean;
  includeModelReport: boolean;
  redactGroundTruth: boolean;
}

/**
 * Client-side export to Markdown or print-optimized HTML.
 * Implemented in a future prompt; certificates and sharing in Phase 4.
 */
export async function exportReport(
  _report: SocReportData,
  _gradingResult: GradingResult | null,
  _options: ExportOptions,
): Promise<string> {
  void _report;
  void _gradingResult;
  void _options;
  return "<!-- Export not yet implemented -->";
}
