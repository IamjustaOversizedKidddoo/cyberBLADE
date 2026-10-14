/**
 * Drains due AI grading jobs (same code path as the after() hook on submit).
 *   npm run soc:ai:worker              # one pass
 *   npm run soc:ai:worker -- --loop    # keep polling every 10s
 */
import { getCtx } from "../lib/progress/context";
import { buildAiPipelineDeps } from "../lib/lab-engine/soc/ai-grading/runtime";
import { processAiGradingJobs } from "../lib/lab-engine/soc/ai-grading/pipeline";
import { resolveEffectiveMode } from "../lib/lab-engine/soc/ai-grading/gate";

const loop = process.argv.includes("--loop");

async function once() {
  const mode = resolveEffectiveMode();
  const s = await processAiGradingJobs(buildAiPipelineDeps(getCtx()), { limit: 50 });
  console.log(`[${new Date().toISOString()}] mode=${mode.mode}${mode.liveRefusedReasons ? " (live refused)" : ""} claimed=${s.claimed} graded=${s.graded} notGraded=${s.notGraded} cache=${s.cacheHits} retried=${s.retried} dead=${s.dead}`);
}

await once();
while (loop) {
  await new Promise((r) => setTimeout(r, 10_000));
  await once();
}
