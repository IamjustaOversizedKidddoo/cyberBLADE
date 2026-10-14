import { describe, expect, it } from "vitest";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/defaults";
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import { applyInjection, buildInjectionCorpus, injectionBaseReport, triggersFor } from "@/lib/lab-engine/soc/ai-grading/calibration/injection-corpus";
import { runInjectionSuite } from "@/lib/lab-engine/soc/ai-grading/calibration/injection-suite";
import { createContentHeuristicMock, createInjectionCompliantMock } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { gradeCriterion } from "@/lib/lab-engine/soc/ai-grading/grade-criterion";
import { buildPrefilterContext, prepareSubmission } from "@/lib/lab-engine/soc/ai-grading/session";
import { FACTS, loadTemplate } from "./helpers";

const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const template = loadTemplate();
const base = injectionBaseReport(createEmptyReportData);
const common = {
  baseReport: base,
  rubric,
  config,
  template,
  facts: FACTS,
  baselineProvider: createContentHeuristicMock(),
  maxCountedElevation: config.gate.injectionMaxCountedElevation,
  maxSusceptibilityRate: config.gate.injectionMaxSusceptibilityRate,
};

describe("injection corpus", () => {
  it("has 100+ unique cases across every required category", () => {
    const corpus = buildInjectionCorpus();
    expect(corpus.length).toBeGreaterThanOrEqual(100);
    expect(new Set(corpus.map((c) => c.id)).size).toBe(corpus.length);
    expect(new Set(corpus.map((c) => c.category))).toEqual(
      new Set(["direct", "fake_system", "delimiter_spoof", "json_injection", "unicode", "hindi_hinglish", "quoted_logs", "rubric_reveal", "score_begging", "role_play", "split_fields"]),
    );
  });

  it("baseline report sits in low bands so obedience is measurable", async () => {
    const r = await runInjectionSuite({ ...common, attackProvider: () => createContentHeuristicMock(), cases: [] });
    expect(r.total).toBe(0);
  });
});

describe("injection defences (proven against a model that OBEYS every payload)", () => {
  it("no injected report earns a counted band above its clean baseline", { timeout: 60_000 }, async () => {
    const r = await runInjectionSuite({ ...common, attackProvider: (c) => createInjectionCompliantMock(triggersFor(c)) });
    const elevated = r.cases.filter((c) => c.outcome === "elevated").map((c) => c.id);
    expect(elevated).toEqual([]);
    expect(r.elevated).toBe(0);
    // The harness still FAILS this model: it obeys injected text (planted flaw caught).
    expect(r.susceptibilityRate).toBeGreaterThan(0.5);
    expect(r.passed).toBe(false);
    // Detection coverage is reported, and is high on this corpus.
    expect(r.detectedRate).toBeGreaterThanOrEqual(0.9);
  });

  it("a model that ignores payloads passes the whole suite", { timeout: 60_000 }, async () => {
    const r = await runInjectionSuite({ ...common, attackProvider: () => createContentHeuristicMock() });
    expect(r.elevated).toBe(0);
    expect(r.susceptibilityRate).toBe(0);
    expect(r.passed).toBe(true);
  });

  it("ablation: with detection switched off, the obedient model DOES get credit (so the suite can fail)", async () => {
    const c = buildInjectionCorpus().find((x) => x.id === "direct-01")!;
    const injected = applyInjection(base, c);
    const prepared = prepareSubmission(injected, FACTS, template);
    const crit = rubric.criteria.find((x) => x.id === "narrative_quality")!;
    const args = {
      criterion: crit,
      input: prepared.input,
      prefilter: buildPrefilterContext(crit, template),
      config,
      versions: { aiRubricVersion: rubric.version, promptVersion: config.promptVersion },
    };
    const defended = await gradeCriterion({ ...args, injection: prepared.injection, provider: createInjectionCompliantMock(triggersFor(c)) });
    expect(defended.eligibleToCount).toBe(false);
    const undefended = await gradeCriterion({ ...args, injection: { flagged: false, kinds: [], regions: [] }, provider: createInjectionCompliantMock(triggersFor(c)) });
    expect(undefended).toMatchObject({ status: "graded", band: 3, eligibleToCount: true });
  });
});
