import "server-only";
/**
 * Production wiring: the store, pipeline dependencies, and the learner-facing result view.
 * Every learner path checks ownership before returning anything.
 */
import type { Ctx } from "@/lib/progress/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveScenarioForAttempt } from "../engine";
import { getReportTemplate } from "../reports/templates";
import { composeAiResult, type AiResultView } from "./compose";
import { loadAiGradingConfig, loadAiRubric } from "./config";
import { resolveEffectiveMode } from "./gate";
import type { AiPipelineDeps } from "./pipeline";
import { getAiGradingProvider } from "./provider";
import { createFileAiGradingStore } from "./store/local-store";
import { SupabaseAiGradingStore } from "./store/supabase-store";
import type { AiGradingStore } from "./store/types";

let storeOverride: AiGradingStore | null = null;

/** Test seam (e2e and unit tests); never set in production code paths. */
export function setAiGradingStoreForTests(store: AiGradingStore | null): void {
  storeOverride = store;
}

export function getAiGradingStore(): AiGradingStore {
  if (storeOverride) return storeOverride;
  return isSupabaseConfigured() ? new SupabaseAiGradingStore() : createFileAiGradingStore();
}

export function buildAiPipelineDeps(ctx: Ctx): AiPipelineDeps {
  return {
    store: getAiGradingStore(),
    getSubmission: (id) => ctx.repo.getSocReportSubmission(id),
    getAttempt: (id) => ctx.repo.getSocAttempt(id),
    resolveScenario: (attempt) => resolveScenarioForAttempt(attempt),
    loadTemplate: (id) => getReportTemplate(id),
    learnerHandles: async (userId) => {
      const op = await ctx.operators.get(userId);
      return op ? [op.handle] : [];
    },
    provider: getAiGradingProvider(),
    now: () => ctx.now(),
  };
}

/** The learner's view of AI feedback for one of THEIR submissions (throws otherwise). */
export async function getAiResultForLearner(ctx: Ctx, userId: string, submissionId: string): Promise<AiResultView> {
  const submission = await ctx.repo.getSocReportSubmission(submissionId);
  if (!submission || submission.userId !== userId) throw new Error("Forbidden: submission does not belong to operator");
  if (submission.status !== "submitted") throw new Error("Report not yet submitted");
  const evaluation = await ctx.repo.getSocReportEvaluation(submissionId);
  if (!evaluation) throw new Error("Report not yet graded");

  const store = getAiGradingStore();
  const [grades, jobs, reviewItems, request] = await Promise.all([
    store.listGradesForSubmission(submissionId),
    store.listJobsForSubmission(submissionId),
    store.listReviewItems({ submissionId }),
    store.getHumanReviewRequest(submissionId),
  ]);
  return composeAiResult({
    deterministicTotal: evaluation.totalScore,
    rubric: loadAiRubric(),
    config: loadAiGradingConfig(),
    mode: resolveEffectiveMode(),
    grades: grades.filter((g) => g.userId === userId),
    jobs,
    reviewItems,
    humanReviewRequested: request !== null,
  });
}
