/**
 * Drift check: re-grade the frozen synthetic canary set and compare with a recorded baseline.
 *   npm run soc:ai:drift -- record --provider mock|real [--i-understand-this-calls-a-real-provider]
 *   npm run soc:ai:drift -- check  --provider mock|real [--i-understand-this-calls-a-real-provider]
 * Baselines: .data/soc-ai-calibration/drift/<model>.json. Exit code 1 on alert.
 */
import fs from "node:fs";
import path from "node:path";
import { getReportTemplate } from "../lib/lab-engine/soc/reports/templates";
import { loadAiGradingConfig, loadAiRubric } from "../lib/lab-engine/soc/ai-grading/config";
import { configuredModelId } from "../lib/lab-engine/soc/ai-grading/pipeline";
import { getAiGradingProvider } from "../lib/lab-engine/soc/ai-grading/provider";
import { createContentHeuristicMock } from "../lib/lab-engine/soc/ai-grading/mock-providers";
import { hashPackets } from "../lib/lab-engine/soc/ai-grading/calibration/packets";
import { gradePackets } from "../lib/lab-engine/soc/ai-grading/calibration/gate-eval";
import { syntheticPackets, syntheticReports } from "../lib/lab-engine/soc/ai-grading/calibration/synthetic";
import { baselineFrom, compareDrift, driftBaselineSchema } from "../lib/lab-engine/soc/ai-grading/calibration/drift";
import { realProviderRefusal } from "../lib/lab-engine/soc/ai-grading/calibration/real-provider-guard";

const argv = process.argv.slice(2);
const cmd = argv[0];
const kind = argv[argv.indexOf("--provider") + 1];
const config = loadAiGradingConfig();
const rubric = loadAiRubric();

async function main() {
  let provider;
  let modelId: string;
  if (kind === "real") {
    const refusal = realProviderRefusal(argv, process.env);
    if (refusal) throw new Error(refusal);
    provider = getAiGradingProvider({ ...process.env, SOC_AI_PROVIDER: "" });
    modelId = configuredModelId({ ...process.env, SOC_AI_PROVIDER: "" });
  } else if (kind === "mock") {
    provider = createContentHeuristicMock();
    modelId = "mock:content-heuristic";
  } else throw new Error("--provider mock|real required");

  const template = await getReportTemplate("incident-report-l1");
  // Frozen canaries: fixed seeds and salt, so the set (and its hash) never changes silently.
  const packets = syntheticPackets(syntheticReports(12, "drift-canary-v1"), rubric, template, "drift-canary-v1");
  const scores = await gradePackets({ packets, rubric, config, template, provider, runs: 1 });
  const meta = { modelId, promptVersion: config.promptVersion, aiRubricVersion: rubric.version, canarySetHash: hashPackets(packets) };
  const file = path.resolve(process.env.NEON_DATA_DIR ?? ".data", "soc-ai-calibration", "drift", `${modelId.replace(/[^a-zA-Z0-9.-]/g, "_")}.json`);

  if (cmd === "record") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(baselineFrom(scores, { ...meta, recordedAt: new Date().toISOString() }), null, 2));
    console.log(`Recorded drift baseline for ${modelId} (${packets.length} canary packets).`);
  } else if (cmd === "check") {
    if (!fs.existsSync(file)) throw new Error(`no baseline for ${modelId}; run record first`);
    const baseline = driftBaselineSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    const r = compareDrift(baseline, { scores, ...meta }, config.drift);
    console.log(`compared=${r.compared} changed=${r.changed} (${(r.changedRate * 100).toFixed(1)}%) meanShift=${r.meanShift.toFixed(2)} notGradedNow=${r.newlyNotGraded}`);
    console.log(r.alert ? `DRIFT ALERT:\n - ${r.reasons.join("\n - ")}` : "No drift beyond limits.");
    process.exitCode = r.alert ? 1 : 0;
  } else {
    console.log("usage: soc:ai:drift <record|check> --provider mock|real");
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
