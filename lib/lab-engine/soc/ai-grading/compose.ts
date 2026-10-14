/**
 * Builds the learner-facing view of AI criteria and the displayed total.
 *
 * The deterministic GradingResult is never modified. In live mode only, AI criteria that are
 * graded, eligible (not low-confidence, not under review) and produced by a gated model add a
 * capped share:  total = det × (1 − W) + Σ w_c × band_c/3 × 100,  W = Σ counted w_c ≤ cap.
 * A missing or uncounted AI grade returns its weight to the deterministic part.
 */
import type { AiGradingConfig } from "./config";
import type { EffectiveMode } from "./gate";
import type {
  AiConfidence,
  AiCriterionGradeRecord,
  AiCriterionId,
  AiGradingJobRecord,
  AiLearnerFeedback,
  AiReviewItemRecord,
  AiRubric,
  Band,
  NotGradedReason,
  VerifiedSpan,
} from "./types";

export type AiDisplayStatus = "pending" | "graded" | "preview" | "not_graded" | "under_review" | "not_available";

export interface AiCriterionView {
  criterionId: AiCriterionId;
  title: string;
  weight: number;
  displayStatus: AiDisplayStatus;
  reason?: string;
  band?: Band;
  bandLabel?: string;
  confidence?: AiConfidence;
  feedback?: AiLearnerFeedback;
  verifiedSpans: VerifiedSpan[];
  countsInTotal: boolean;
  source?: AiCriterionGradeRecord["source"];
}

export interface AiResultView {
  mode: EffectiveMode["mode"];
  /** True only when live is active through a valid, signed-off gate. */
  calibrated: boolean;
  deterministicTotal: number;
  displayedTotal: number;
  aiWeightCounted: number;
  criteria: AiCriterionView[];
  humanReviewRequested: boolean;
}

export const NOT_GRADED_TEXT: Record<NotGradedReason, string> = {
  mode_off: "AI feedback is off",
  kill_switch: "AI feedback is paused",
  empty: "this section was empty or too short to judge",
  template_only: "this section still contains template text",
  copy_paste_dominated: "this section is mostly pasted log lines",
  over_length: "this section is longer than the grading limit",
  user_quota: "daily AI feedback limit reached",
  submission_token_cap: "this report exceeded the AI feedback budget",
  global_ceiling: "AI feedback is at capacity today",
  provider_unavailable: "the AI service was unavailable",
  invalid_output: "the AI response could not be verified, so no grade was given",
  insufficient_valid_samples: "too few verifiable AI responses, so no grade was given",
};

/** Latest record per criterion (human review records supersede by being newer). */
export function latestGrades(grades: AiCriterionGradeRecord[]): Map<AiCriterionId, AiCriterionGradeRecord> {
  const m = new Map<AiCriterionId, AiCriterionGradeRecord>();
  for (const g of [...grades].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) m.set(g.criterionId, g);
  return m;
}

export function composeAiResult(args: {
  deterministicTotal: number;
  rubric: AiRubric;
  config: AiGradingConfig;
  mode: EffectiveMode;
  grades: AiCriterionGradeRecord[];
  jobs: AiGradingJobRecord[];
  reviewItems: AiReviewItemRecord[];
  humanReviewRequested: boolean;
}): AiResultView {
  const { rubric, config, mode } = args;
  const latest = latestGrades(args.grades);
  const openBlockingReview = new Set(
    args.reviewItems
      .filter((r) => r.status === "open" && (r.reason === "needs_review" || r.reason === "injection_flagged"))
      .map((r) => r.gradeId),
  );

  const criteria: AiCriterionView[] = rubric.criteria.map((c) => {
    const weight = Math.min(c.weight, config.weights.perCriterionCap);
    const base: AiCriterionView = { criterionId: c.id, title: c.title, weight, displayStatus: "not_available", verifiedSpans: [], countsInTotal: false };
    if (mode.mode === "off") return { ...base, displayStatus: "not_graded", reason: NOT_GRADED_TEXT[mode.killSwitch ? "kill_switch" : "mode_off"] };
    if (mode.mode === "shadow") return base;

    const g = latest.get(c.id);
    if (!g) {
      const job = args.jobs.find((j) => j.criterionId === c.id);
      if (job && (job.status === "pending" || job.status === "running")) return { ...base, displayStatus: "pending" };
      if (job?.status === "dead") return { ...base, displayStatus: "not_graded", reason: NOT_GRADED_TEXT.provider_unavailable };
      return { ...base, displayStatus: "not_graded", reason: NOT_GRADED_TEXT.mode_off };
    }
    if (g.status === "not_graded") {
      return { ...base, displayStatus: "not_graded", reason: NOT_GRADED_TEXT[g.notGradedReason ?? "invalid_output"] };
    }
    const shown: AiCriterionView = {
      ...base,
      band: g.band,
      bandLabel: g.band !== undefined ? c.bands[g.band].label : undefined,
      confidence: g.confidence,
      feedback: g.feedback,
      verifiedSpans: g.verifiedSpans,
      source: g.source,
    };
    if (g.status === "needs_review" || openBlockingReview.has(g.id)) {
      // The learner sees that review is pending, not the unreviewed band.
      return { ...base, displayStatus: "under_review", reason: "a reviewer will check this criterion" };
    }
    if (mode.mode === "preview") return { ...shown, displayStatus: "preview" };

    const human = g.source !== "ai";
    const counts = g.band !== undefined && (human || (g.eligibleToCount && mode.liveModels.includes(g.modelId)));
    return {
      ...shown,
      displayStatus: "graded",
      countsInTotal: counts,
      reason: counts ? undefined : g.confidence === "low" ? "low confidence, not counted" : "not from a calibrated model, not counted",
    };
  });

  // Enforce the total cap even if config and rubric drift apart.
  let counted = criteria.filter((v) => v.countsInTotal);
  let W = counted.reduce((s, v) => s + v.weight, 0);
  const scale = W > config.weights.totalCap ? config.weights.totalCap / W : 1;
  counted = counted.map((v) => ({ ...v, weight: v.weight * scale }));
  W = counted.reduce((s, v) => s + v.weight, 0);
  const aiPart = counted.reduce((s, v) => s + v.weight * ((v.band ?? 0) / 3) * 100, 0);
  const displayed = mode.mode === "live" ? args.deterministicTotal * (1 - W) + aiPart : args.deterministicTotal;

  return {
    mode: mode.mode,
    calibrated: mode.mode === "live" && mode.liveModels.length > 0,
    deterministicTotal: args.deterministicTotal,
    displayedTotal: Math.round(displayed * 100) / 100,
    aiWeightCounted: mode.mode === "live" ? Math.round(W * 10000) / 10000 : 0,
    criteria,
    humanReviewRequested: args.humanReviewRequested,
  };
}
