import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import { currentVersions, gateFileName, resolveEffectiveMode } from "@/lib/lab-engine/soc/ai-grading/gate";
import { computeInputHash } from "@/lib/lab-engine/soc/ai-grading/prompt";
import { prepareSubmission } from "@/lib/lab-engine/soc/ai-grading/session";
import { createContentHeuristicMock, createLengthRewardingMock } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { inputFromPacket, packetsForSubmission, parseHumanScoresCsv, type HumanScore, type ModelScore } from "@/lib/lab-engine/soc/ai-grading/calibration/packets";
import { evaluateGate, gradePackets, toGateFile } from "@/lib/lab-engine/soc/ai-grading/calibration/gate-eval";
import { simulatedHumanScores, syntheticManifest, syntheticPackets, syntheticReports } from "@/lib/lab-engine/soc/ai-grading/calibration/synthetic";
import { baselineFrom, compareDrift } from "@/lib/lab-engine/soc/ai-grading/calibration/drift";
import { runFairnessSuite } from "@/lib/lab-engine/soc/ai-grading/calibration/fairness";
import type { FairnessResult } from "@/lib/lab-engine/soc/ai-grading/calibration/fairness";
import type { InjectionSuiteResult } from "@/lib/lab-engine/soc/ai-grading/calibration/injection-suite";
import { tempGateDir } from "./pipeline-harness";
import { FACTS, loadTemplate, sampleReport } from "./helpers";

const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const template = loadTemplate();
const v = currentVersions();
const MODEL = "mock:content-heuristic";

const PASSING_FAIRNESS: FairnessResult = { transforms: [], passed: true };
const PASSING_INJECTION = { passed: true, elevated: 0, susceptibilityRate: 0 } as InjectionSuiteResult;

describe("calibration packets", () => {
  const input = prepareSubmission(sampleReport(), FACTS, template, ["op_kavya"]).input;

  it("are anonymous: ids are salted hashes, the source id never appears", () => {
    const a = packetsForSubmission(input, rubric, { sourceId: "submission-1234-secret", salt: "s1", synthetic: false });
    const b = packetsForSubmission(input, rubric, { sourceId: "submission-1234-secret", salt: "s2", synthetic: false });
    expect(JSON.stringify(a)).not.toContain("submission-1234-secret");
    expect(JSON.stringify(a)).not.toContain("op_kavya");
    expect(a.map((p) => p.packetId)).not.toEqual(b.map((p) => p.packetId));
    expect(new Set(a.map((p) => p.reportRef)).size).toBe(1);
  });

  it("give graders exactly the text the model is graded on", () => {
    for (const p of packetsForSubmission(input, rubric, { sourceId: "x", salt: "s", synthetic: false })) {
      const crit = rubric.criteria.find((c) => c.id === p.criterionId)!;
      const versions = { aiRubricVersion: rubric.version, promptVersion: config.promptVersion };
      expect(computeInputHash(crit, inputFromPacket(p, rubric, template), versions)).toBe(computeInputHash(crit, input, versions));
    }
  });

  it("human score import accepts pseudonyms only and rejects bad rows", () => {
    expect(parseHumanScoresCsv("packetId,graderId,band\n0123456789abcdef,grader_7,2")).toEqual([{ packetId: "0123456789abcdef", graderId: "grader_7", band: 2 }]);
    expect(() => parseHumanScoresCsv("packetId,graderId,band\n0123456789abcdef,priya@example.com,2")).toThrow(/pseudonym/);
    expect(() => parseHumanScoresCsv("packetId,graderId,band\n0123456789abcdef,g1,5")).toThrow();
    expect(() => parseHumanScoresCsv("packetId,graderId,band\n0123456789abcdef,g1,1\n0123456789abcdef,g1,2")).toThrow(/duplicate/);
    expect(() => parseHumanScoresCsv("id,who,score\n")).toThrow(/header/);
  });
});

describe("gate evaluation", () => {
  it("the SYNTHETIC demo set computes every metric but can never pass", { timeout: 60_000 }, async () => {
    const packets = syntheticPackets(syntheticReports(12), rubric, template, "demo-salt");
    const human = simulatedHumanScores(packets);
    const model = await gradePackets({ packets, rubric, config, template, provider: createContentHeuristicMock() });
    const manifest = syntheticManifest(packets, { id: "synthetic-demo", ...v, modelId: MODEL, createdAt: "2026-10-14T00:00:00Z" });
    const ev = evaluateGate({ manifest, packets, human, model, fairness: PASSING_FAIRNESS, injection: PASSING_INJECTION, config, current: v, modelId: MODEL });
    expect(ev.overall.items).toBeGreaterThan(30);
    expect(ev.overall.weightedKappa.estimate).not.toBeNull();
    expect(ev.overall.humanHumanKappa).not.toBeNull();
    expect(ev.overall.flipRate).toBe(0);
    expect(ev.passed).toBe(false);
    expect(ev.failures).toContain("calibration set is synthetic (demo only)");
    expect(ev.failures.some((f) => f.startsWith("only 12 reports"))).toBe(true);

    // Even if someone writes it into the gate directory and signs it, live stays refused.
    const gate = toGateFile(ev, { manifest, current: v, modelId: MODEL, thresholdsVersion: config.gate.thresholdsVersion, computedAt: "2026-10-14T00:00:00Z" });
    expect(gate.signOff).toEqual({ signedOffBy: "", signedOffAt: "", notes: "" });
    const dir = tempGateDir();
    fs.writeFileSync(path.join(dir, gateFileName(v, MODEL)), JSON.stringify({ ...gate, passed: true, failures: [], signOff: { signedOffBy: "x", signedOffAt: "2026-10-14T00:00:00Z" } }));
    expect(resolveEffectiveMode({ NODE_ENV: "test", SOC_AI_GRADING_MODE: "live" }, dir).mode).toBe("preview");
  });

  function realLike(reports: number, opts: { humansAgree: boolean; modelOffset?: number; flip?: boolean }) {
    const packets = syntheticPackets(syntheticReports(reports, "reallike"), rubric, template, "rl").map((p) => ({ ...p, synthetic: false }));
    const truth = (id: string) => parseInt(id.slice(0, 2), 16) % 4;
    const human: HumanScore[] = packets.flatMap((p) => [
      { packetId: p.packetId, graderId: "g1", band: truth(p.packetId) },
      { packetId: p.packetId, graderId: "g2", band: opts.humansAgree ? truth(p.packetId) : 3 - truth(p.packetId) },
    ]);
    const model: ModelScore[] = packets.flatMap((p) => {
      const b = Math.max(0, Math.min(3, truth(p.packetId) + (opts.modelOffset ?? 0)));
      return [
        { packetId: p.packetId, run: 1 as const, band: b },
        { packetId: p.packetId, run: 2 as const, band: opts.flip ? 3 - b : b },
      ];
    });
    const manifest = { ...syntheticManifest(packets, { id: "real-like", ...v, modelId: MODEL, createdAt: "2026-10-14T00:00:00Z" }), synthetic: false };
    return { manifest, packets, human, model };
  }

  it("a calibration set that meets every threshold passes (the gate is achievable)", { timeout: 60_000 }, () => {
    const d = realLike(60, { humansAgree: true });
    const ev = evaluateGate({ ...d, fairness: PASSING_FAIRNESS, injection: PASSING_INJECTION, config, current: v, modelId: MODEL });
    expect(ev.failures).toEqual([]);
    expect(ev.passed).toBe(true);
    expect(ev.overall.weightedKappa.estimate).toBeCloseTo(1, 6);
  });

  it.each([
    ["humans disagree with each other", { humansAgree: false }, /human-human kappa/],
    ["model is systematically generous by 2 bands", { humansAgree: true, modelOffset: 2 }, /weighted kappa|within-one/],
    ["model is unstable between runs", { humansAgree: true, flip: true }, /flip rate/],
  ] as const)("fails when %s", { timeout: 60_000 }, (_l, opts, re) => {
    const d = realLike(60, opts);
    const ev = evaluateGate({ ...d, fairness: PASSING_FAIRNESS, injection: PASSING_INJECTION, config, current: v, modelId: MODEL });
    expect(ev.passed).toBe(false);
    expect(ev.failures.join(" | ")).toMatch(re);
  });

  it("fails when fairness or injection suites fail, or were not run, or the set is stale", { timeout: 60_000 }, async () => {
    const d = realLike(60, { humansAgree: true });
    const unfair = await runFairnessSuite({ reports: [sampleReport()], rubric, config, template, facts: FACTS, provider: createLengthRewardingMock, transforms: ["length"] });
    const ev = evaluateGate({ ...d, fairness: unfair, injection: null, config, current: v, modelId: MODEL });
    expect(ev.failures.join(" | ")).toMatch(/fairness failed: length/);
    expect(ev.failures).toContain("injection suite not run");
    const stale = evaluateGate({ ...d, manifest: { ...d.manifest, promptVersion: "p0" }, fairness: PASSING_FAIRNESS, injection: PASSING_INJECTION, config, current: v, modelId: MODEL });
    expect(stale.failures).toContain("calibration set was built for another prompt version");
  });
});

describe("drift", () => {
  const meta = { modelId: MODEL, promptVersion: "p1", aiRubricVersion: "0.1.0", canarySetHash: "h", recordedAt: "t" };
  const scores = (bands: Array<number | null>): ModelScore[] => bands.map((band, i) => ({ packetId: `p${i}`, run: 1, band }));
  const limits = { maxChangedRate: config.drift.maxChangedRate, maxMeanShift: config.drift.maxMeanShift };

  it("stays quiet when nothing changed", () => {
    const base = baselineFrom(scores([0, 1, 2, 3, 2, 1, 0, 3, 2, 1]), meta);
    expect(compareDrift(base, { scores: scores([0, 1, 2, 3, 2, 1, 0, 3, 2, 1]), ...meta }, limits)).toMatchObject({ alert: false, changed: 0 });
  });

  it("alerts on band shifts, lost grades, and version changes", () => {
    const base = baselineFrom(scores([0, 1, 2, 3, 2, 1, 0, 3, 2, 1]), meta);
    const shifted = compareDrift(base, { scores: scores([1, 2, 3, 3, 3, 2, 1, 3, 3, 2]), ...meta }, limits);
    expect(shifted.alert).toBe(true);
    expect(shifted.meanShift).toBeCloseTo(0.8, 6);
    const lost = compareDrift(base, { scores: scores([0, 1, 2, 3, 2, 1, 0, 3, 2, null]), ...meta }, limits);
    expect(lost.reasons.join(" ")).toMatch(/no longer graded/);
    const other = compareDrift(base, { scores: scores([0, 1, 2, 3, 2, 1, 0, 3, 2, 1]), ...meta, modelId: "groq:new" }, limits);
    expect(other.reasons).toContain("model id differs from baseline");
  });
});
