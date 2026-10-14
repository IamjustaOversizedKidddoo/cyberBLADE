import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { currentVersions, gateFileName, resolveEffectiveMode, type GateFile } from "@/lib/lab-engine/soc/ai-grading/gate";
import { composeAiResult } from "@/lib/lab-engine/soc/ai-grading/compose";
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import type { AiCriterionGradeRecord, AiCriterionId } from "@/lib/lab-engine/soc/ai-grading/types";
import { tempGateDir } from "./pipeline-harness";

const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const MODEL = "groq:llama-3.3-70b-versatile";

function validGate(over: Partial<GateFile> = {}): GateFile {
  const v = currentVersions();
  return {
    gateVersion: 1,
    ...v,
    modelId: MODEL,
    thresholdsVersion: config.gate.thresholdsVersion,
    calibrationSet: { id: "cal-1", hash: "h", synthetic: false, reports: 80, promptVersion: v.promptVersion, modelId: MODEL, aiRubricVersion: v.aiRubricVersion },
    results: {},
    passed: true,
    failures: [],
    computedAt: "2026-10-20T00:00:00Z",
    signOff: { signedOffBy: "owner", signedOffAt: "2026-10-21T00:00:00Z" },
    ...over,
  };
}

function writeGate(dir: string, gate: GateFile, name = gateFileName(currentVersions(), gate.modelId)) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(gate));
}

const LIVE: NodeJS.ProcessEnv = { NODE_ENV: "test", SOC_AI_GRADING_MODE: "live" };

describe("live mode is refused server-side without a valid signed gate", () => {
  it("no gate file: live becomes preview with a reason", () => {
    const m = resolveEffectiveMode(LIVE, tempGateDir());
    expect(m).toMatchObject({ mode: "preview", requested: "live", liveModels: [] });
    expect(m.liveRefusedReasons).toEqual(["no gate file exists"]);
  });

  it.each([
    ["unsigned", { signOff: { signedOffBy: "", signedOffAt: "" } }, "owner sign-off missing"],
    ["failed thresholds", { passed: false }, "did not pass"],
    ["synthetic calibration set", { calibrationSet: { ...validGate().calibrationSet, synthetic: true } }, "synthetic"],
    ["prompt changed", { promptVersion: "p0" }, "prompt version changed"],
    ["stale calibration set", { calibrationSet: { ...validGate().calibrationSet, modelId: "gemini:x" } }, "stale"],
    ["thresholds changed", { thresholdsVersion: "t-old" }, "thresholds changed"],
  ] as const)("%s gate is refused", (_label, over, reason) => {
    const dir = tempGateDir();
    writeGate(dir, validGate(over as Partial<GateFile>));
    const m = resolveEffectiveMode(LIVE, dir);
    expect(m.mode).toBe("preview");
    expect(m.liveRefusedReasons?.join(" ")).toContain(reason);
  });

  it("a gate under the wrong file name is ignored", () => {
    const dir = tempGateDir();
    writeGate(dir, validGate(), "renamed.json");
    expect(resolveEffectiveMode(LIVE, dir).mode).toBe("preview");
  });

  it("a malformed gate file is refused, not crashed on", () => {
    const dir = tempGateDir();
    fs.writeFileSync(path.join(dir, "x.json"), "{not json");
    expect(resolveEffectiveMode(LIVE, dir).liveRefusedReasons?.[0]).toMatch(/unreadable/);
  });

  it("a valid, signed, matching gate allows live for that model only", () => {
    const dir = tempGateDir();
    writeGate(dir, validGate());
    expect(resolveEffectiveMode(LIVE, dir)).toMatchObject({ mode: "live", liveModels: [MODEL] });
  });

  it("the repository ships no gate file (live is impossible out of the box)", () => {
    expect(resolveEffectiveMode(LIVE).mode).toBe("preview");
  });
});

function grade(criterionId: AiCriterionId, over: Partial<AiCriterionGradeRecord> = {}): AiCriterionGradeRecord {
  return {
    id: `g-${criterionId}`,
    submissionId: "s",
    attemptId: "a",
    userId: "u",
    criterionId,
    status: "graded",
    band: 3,
    confidence: "high",
    eligibleToCount: true,
    feedback: { summary: "x", strengths: [], improvements: [] },
    verifiedSpans: [],
    flags: [],
    aiRubricId: rubric.rubricId,
    aiRubricVersion: rubric.version,
    promptVersion: config.promptVersion,
    graderVersion: config.graderVersion,
    modelId: MODEL,
    params: { temperature: 0, samples: 3, maxOutputTokens: 600 },
    inputHash: "h",
    cacheKey: "k",
    inputTokens: 1,
    outputTokens: 1,
    source: "ai",
    createdAt: "2026-10-14T10:00:00Z",
    ...over,
  };
}

const ids = rubric.criteria.map((c) => c.id);
const live = { mode: "live" as const, requested: "live" as const, killSwitch: false, liveModels: [MODEL] };
const preview = { mode: "preview" as const, requested: "preview" as const, killSwitch: false, liveModels: [] };

function compose(mode: typeof live | typeof preview, grades: AiCriterionGradeRecord[], det = 80) {
  return composeAiResult({ deterministicTotal: det, rubric, config, mode, grades, jobs: [], reviewItems: [], humanReviewRequested: false });
}

describe("score composition", () => {
  it("preview never changes the total and labels everything preview", () => {
    const v = compose(preview, ids.map((id) => grade(id)));
    expect(v.displayedTotal).toBe(80);
    expect(v.aiWeightCounted).toBe(0);
    expect(v.criteria.every((c) => c.displayStatus === "preview" && !c.countsInTotal)).toBe(true);
    expect(v.calibrated).toBe(false);
  });

  it("live blends counted criteria with capped weight: det*(1-W) + sum(w*band/3*100)", () => {
    const grades = ids.map((id, i) => grade(id, { band: i % 2 === 0 ? 3 : 0 }));
    const v = compose(live, grades);
    const W = rubric.criteria.reduce((s, c) => s + c.weight, 0);
    const ai = rubric.criteria.reduce((s, c, i) => s + c.weight * ((i % 2 === 0 ? 3 : 0) / 3) * 100, 0);
    expect(v.aiWeightCounted).toBeCloseTo(W, 6);
    expect(v.displayedTotal).toBeCloseTo(80 * (1 - W) + ai, 2);
    expect(W).toBeLessThanOrEqual(config.weights.totalCap);
  });

  it("uncounted AI criteria hand their weight back (a missing grade never lowers the score)", () => {
    const v = compose(live, [grade("coherence", { band: 3 })], 90);
    const w = rubric.criteria.find((c) => c.id === "coherence")!.weight;
    expect(v.aiWeightCounted).toBeCloseTo(w, 6);
    expect(v.displayedTotal).toBeCloseTo(90 * (1 - w) + w * 100, 2);
  });

  it("does not count low-confidence, ungated-model, needs-review or not-graded results", () => {
    const v = compose(live, [
      grade("narrative_quality", { confidence: "low", eligibleToCount: false }),
      grade("coherence", { modelId: "gemini:not-gated" }),
      grade("tone_concision", { status: "needs_review", eligibleToCount: false }),
      grade("handoff_usefulness", { status: "not_graded", band: undefined, notGradedReason: "empty", eligibleToCount: false }),
    ]);
    expect(v.aiWeightCounted).toBe(0);
    expect(v.displayedTotal).toBe(80);
    const by = Object.fromEntries(v.criteria.map((c) => [c.criterionId, c]));
    expect(by.narrative_quality.reason).toMatch(/low confidence/);
    expect(by.coherence.reason).toMatch(/not from a calibrated model/);
    expect(by.tone_concision.displayStatus).toBe("under_review");
    expect(by.tone_concision.band).toBeUndefined(); // unreviewed band is not shown
    expect(by.handoff_usefulness).toMatchObject({ displayStatus: "not_graded", reason: expect.stringMatching(/empty/) });
  });

  it("a human override (newer record) replaces the AI grade and counts in live", () => {
    const v = compose(live, [
      grade("coherence", { band: 0 }),
      grade("coherence", { id: "h1", band: 2, source: "human_override", createdAt: "2026-10-15T00:00:00Z", modelId: "human" }),
    ]);
    const c = v.criteria.find((x) => x.criterionId === "coherence")!;
    expect(c).toMatchObject({ band: 2, source: "human_override", countsInTotal: true });
  });

  it("shows pending and off states honestly", () => {
    const pending = composeAiResult({
      deterministicTotal: 50,
      rubric,
      config,
      mode: preview,
      grades: [],
      jobs: [{ id: "j", submissionId: "s", attemptId: "a", userId: "u", criterionId: "coherence", idempotencyKey: "k", status: "pending", attempts: 0, nextRunAt: "", createdAt: "", updatedAt: "" }],
      reviewItems: [],
      humanReviewRequested: false,
    });
    expect(pending.criteria.find((c) => c.criterionId === "coherence")!.displayStatus).toBe("pending");
    const off = compose({ mode: "off", requested: "off", killSwitch: false, liveModels: [] } as never, []);
    expect(off.criteria.every((c) => c.displayStatus === "not_graded" && c.reason === "AI feedback is off")).toBe(true);
  });
});
