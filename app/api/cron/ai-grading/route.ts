/**
 * Drains due AI-grading jobs (same code path as the after() hook on submit and `npm run
 * soc:ai:worker`). Idempotent: jobs are claimed with a lease, so a duplicate cron delivery cannot
 * grade one job twice. AI grading is off by default; then this run does nothing.
 */
import { cronHandler } from "@/lib/ops/cron-route";
import { getCtx } from "@/lib/progress/context";
import { processAiGradingJobs } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { buildAiPipelineDeps } from "@/lib/lab-engine/soc/ai-grading/runtime";
import { resolveEffectiveMode } from "@/lib/lab-engine/soc/ai-grading/gate";

// Below the Hobby maximum of 300 s (vercel.com/docs/functions/limitations); the job batch is capped too.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const handler = cronHandler(
  "ai-grading",
  async () => {
    const mode = resolveEffectiveMode();
    if (mode.mode === "off") return { skipped: true, reason: "ai grading off" };
    const s = await processAiGradingJobs(buildAiPipelineDeps(getCtx()), { limit: 20 });
    return { mode: mode.mode, claimed: s.claimed, graded: s.graded, notGraded: s.notGraded, retried: s.retried, dead: s.dead };
  },
  100_000,
);

export const GET = handler;
export const POST = handler;
