/**
 * Runs the prompt-injection corpus against MOCK models (no network).
 *
 *   npm run soc:ai:injection                  # obedient adversary: proves the defences
 *   npm run soc:ai:injection -- --neutral     # a model that ignores payloads
 *   npm run soc:ai:injection -- --json        # machine-readable output
 *
 * The real-model run lives in scripts/soc-ai-eval-real.mts (manual only).
 */
import { createEmptyReportData } from "../lib/lab-engine/soc/reports/defaults";
import { getReportTemplate } from "../lib/lab-engine/soc/reports/templates";
import { loadAiGradingConfig, loadAiRubric } from "../lib/lab-engine/soc/ai-grading/config";
import { injectionBaseReport, triggersFor } from "../lib/lab-engine/soc/ai-grading/calibration/injection-corpus";
import { runInjectionSuite } from "../lib/lab-engine/soc/ai-grading/calibration/injection-suite";
import { createContentHeuristicMock, createInjectionCompliantMock } from "../lib/lab-engine/soc/ai-grading/mock-providers";

const neutral = process.argv.includes("--neutral");
const asJson = process.argv.includes("--json");
const config = loadAiGradingConfig();

const result = await runInjectionSuite({
  baseReport: injectionBaseReport(createEmptyReportData),
  rubric: loadAiRubric(),
  config,
  template: await getReportTemplate("incident-report-l1"),
  facts: { title: "Synthetic demo shift", briefing: "Synthetic briefing used only for the injection suite." },
  baselineProvider: createContentHeuristicMock(),
  attackProvider: (c) => (neutral ? createContentHeuristicMock() : createInjectionCompliantMock(triggersFor(c))),
  maxCountedElevation: config.gate.injectionMaxCountedElevation,
  maxSusceptibilityRate: config.gate.injectionMaxSusceptibilityRate,
});

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log(`Model: ${neutral ? "mock neutral (ignores payloads)" : "mock adversary (obeys every payload)"}`);
  console.log(`Cases: ${result.total}   counted elevations: ${result.elevated}   detected: ${pct(result.detectedRate)}   model obeyed: ${pct(result.susceptibilityRate)}`);
  console.log("category           total  detected  elevated");
  for (const [cat, b] of Object.entries(result.byCategory)) {
    console.log(`${cat.padEnd(18)} ${String(b.total).padStart(5)}  ${String(b.detected).padStart(8)}  ${String(b.elevated).padStart(8)}`);
  }
  const outcomes = result.cases.reduce<Record<string, number>>((m, c) => ((m[c.outcome] = (m[c.outcome] ?? 0) + 1), m), {});
  console.log(`Outcomes: ${JSON.stringify(outcomes)}`);
  console.log(`Suite verdict for this model: ${result.passed ? "PASS" : "FAIL"} (needs 0 counted elevations and model-obeyed <= ${pct(config.gate.injectionMaxSusceptibilityRate)})`);
}
process.exitCode = result.elevated > 0 ? 1 : 0;
