/**
 * MANUAL real-provider evaluation. Never run in CI or tests (it refuses).
 *
 *   GROQ_API_KEY=... npm run soc:ai:eval-real -- --i-understand-this-calls-a-real-provider [--n 20]
 *
 * Sends ONLY synthetic reports (fictional data) and the injection corpus to the configured
 * provider, then prints each criterion's verdict with the raw output so the owner can read
 * 20+ outputs by hand. Writes a full log to .data/soc-ai-calibration/eval-real-<time>.json.
 * It does not change any mode, gate or learner data.
 */
import fs from "node:fs";
import path from "node:path";
import { getReportTemplate } from "../lib/lab-engine/soc/reports/templates";
import { createEmptyReportData } from "../lib/lab-engine/soc/reports/defaults";
import { loadAiGradingConfig, loadAiRubric } from "../lib/lab-engine/soc/ai-grading/config";
import { configuredModelId } from "../lib/lab-engine/soc/ai-grading/pipeline";
import { getAiGradingProvider } from "../lib/lab-engine/soc/ai-grading/provider";
import { gradeCriterion, ProviderUnavailableError } from "../lib/lab-engine/soc/ai-grading/grade-criterion";
import { buildPrefilterContext, prepareSubmission } from "../lib/lab-engine/soc/ai-grading/session";
import { syntheticReports, SYNTHETIC_FACTS } from "../lib/lab-engine/soc/ai-grading/calibration/synthetic";
import { runInjectionSuite } from "../lib/lab-engine/soc/ai-grading/calibration/injection-suite";
import { injectionBaseReport } from "../lib/lab-engine/soc/ai-grading/calibration/injection-corpus";
import { realProviderRefusal } from "../lib/lab-engine/soc/ai-grading/calibration/real-provider-guard";

const argv = process.argv.slice(2);
const refusal = realProviderRefusal(argv, process.env);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const n = Number(argv[argv.indexOf("--n") + 1]) || 4;
const env = { ...process.env, SOC_AI_PROVIDER: "" };
const provider = getAiGradingProvider(env);
const modelId = configuredModelId(env);
const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const template = await getReportTemplate("incident-report-l1");
const log: unknown[] = [];

console.log(`Real-provider evaluation against ${modelId}. Synthetic reports only. ${n} reports x ${rubric.criteria.length} criteria.`);
for (const [i, report] of syntheticReports(n, "eval-real").entries()) {
  const prepared = prepareSubmission(report, SYNTHETIC_FACTS, template);
  for (const criterion of rubric.criteria) {
    try {
      const o = await gradeCriterion({
        criterion,
        input: prepared.input,
        injection: prepared.injection,
        prefilter: buildPrefilterContext(criterion, template),
        provider,
        config,
        versions: { aiRubricVersion: rubric.version, promptVersion: config.promptVersion },
      });
      console.log(`\n=== report ${i + 1} / ${criterion.id}: ${o.status}${o.band !== undefined ? ` band ${o.band} (${o.confidence})` : ` (${o.notGradedReason})`} model=${o.modelId}`);
      console.log(`feedback: ${o.feedback.summary}\n  + ${o.feedback.strengths.join("\n  + ")}\n  - ${o.feedback.improvements.join("\n  - ")}`);
      console.log(`spans: ${o.verifiedSpans.map((s) => JSON.stringify(s.text)).join(" | ")}`);
      for (const s of o.rawSamples) console.log(`raw[${s.sampleIndex}.${s.attempt}]${s.rejection ? ` REJECTED(${s.rejection})` : ""}: ${s.text.slice(0, 600)}`);
      log.push({ report: i, criterion: criterion.id, outcome: o });
    } catch (e) {
      console.log(`=== report ${i + 1} / ${criterion.id}: provider error ${e instanceof ProviderUnavailableError ? e.message : String(e)}`);
    }
  }
}

if (argv.includes("--injection")) {
  const inj = await runInjectionSuite({
    baseReport: injectionBaseReport(createEmptyReportData),
    rubric,
    config,
    template,
    facts: SYNTHETIC_FACTS,
    baselineProvider: provider,
    attackProvider: () => provider,
    maxCountedElevation: config.gate.injectionMaxCountedElevation,
    maxSusceptibilityRate: config.gate.injectionMaxSusceptibilityRate,
  });
  console.log(`\nInjection corpus vs real model: ${inj.total} cases, counted elevations=${inj.elevated}, model obeyed=${(inj.susceptibilityRate * 100).toFixed(1)}%, detected=${(inj.detectedRate * 100).toFixed(1)}%`);
  log.push({ injection: inj });
}

const out = path.resolve(process.env.NEON_DATA_DIR ?? ".data", "soc-ai-calibration", `eval-real-${Date.now()}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ modelId, promptVersion: config.promptVersion, log }, null, 2));
console.log(`\nFull log: ${out}`);
