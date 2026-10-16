import "server-only";
/**
 * Background scheduling for AI grading. Deliberately NOT a "use server" module: nothing here may
 * be callable from the browser (enqueueing does no ownership check of its own; the caller has
 * already verified the operator owns the submission).
 */
import { after } from "next/server";
import { getCtx } from "@/lib/progress/context";
import { enqueueAiGrading, processAiGradingJobs } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { buildAiPipelineDeps } from "@/lib/lab-engine/soc/ai-grading/runtime";
import { log } from "@/lib/observability/logger";

/** Runs due jobs after the response is sent (also re-kicks stalled jobs on later reads). */
export function scheduleAiWorker(): void {
  after(async () => {
    try {
      await processAiGradingJobs(buildAiPipelineDeps(getCtx()), { limit: 12 });
    } catch (err) {
      log.error("soc-ai background grading failed", { error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
    }
  });
}

/** Called right after the operator's own report is submitted. Never fails the submission. */
export async function enqueueAiGradingAfterSubmit(submissionId: string): Promise<void> {
  try {
    const r = await enqueueAiGrading(buildAiPipelineDeps(getCtx()), submissionId);
    if (r.enqueued > 0) scheduleAiWorker();
  } catch (err) {
    log.error("soc-ai enqueue failed", { error: err instanceof Error ? err.message.slice(0, 200) : "unknown" });
  }
}
