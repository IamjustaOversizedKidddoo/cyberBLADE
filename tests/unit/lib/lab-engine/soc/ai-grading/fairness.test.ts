import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/defaults";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { generateFixtureReport } from "@/lib/lab-engine/soc/reports/fixtures";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { loadAiGradingConfig, loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import { pairFor, runFairnessSuite, type FairnessTransform } from "@/lib/lab-engine/soc/ai-grading/calibration/fairness";
import { injectionBaseReport } from "@/lib/lab-engine/soc/ai-grading/calibration/injection-corpus";
import {
  createBulletRewardingMock,
  createContentHeuristicMock,
  createLengthRewardingMock,
  createOrderSensitiveMock,
  createSimpleEnglishPenalizingMock,
} from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import type { MockProvider } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { FACTS, loadTemplate, sampleReport } from "./helpers";

const config = loadAiGradingConfig();
const rubric = loadAiRubric();
const template = loadTemplate();

function reports() {
  const dir = path.resolve("content/soc/families");
  const out = [sampleReport(), injectionBaseReport(createEmptyReportData)];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".yaml")).slice(0, 4)) {
    const family = socFamilySchema.parse(parseYaml(fs.readFileSync(path.join(dir, f), "utf8"))) as SocFamily;
    const truth = generateSocVariant(family, "fair-1", "intermediate").scenario.groundTruth.incidents[0]?.reportGroundTruth;
    if (truth) out.push(generateFixtureReport(truth, "good", { seed: 1 }), generateFixtureReport(truth, "mediocre", { seed: 1 }));
  }
  return out;
}
const REPORTS = reports();

const run = (provider: () => MockProvider, transforms?: FairnessTransform[]) =>
  runFairnessSuite({ reports: REPORTS, rubric, config, template, facts: FACTS, provider, transforms });

describe("fairness transforms", () => {
  it("keep facts and evidence identifiers intact", () => {
    const r = sampleReport();
    for (const t of ["length", "bullets", "formality", "indian_english", "padding", "section_order"] as const) {
      const [a, b] = pairFor(t, r);
      const ids = (x: typeof r) => JSON.stringify(x).match(/alt-\d+|198\.51\.100\.23|billing-notice/g)?.sort();
      expect(ids(b), t).toEqual(ids(a));
    }
  });
});

describe("fairness harness", () => {
  it("passes a model whose judgement depends only on content", { timeout: 60_000 }, async () => {
    const r = await run(() => createContentHeuristicMock());
    for (const t of r.transforms) expect(t.failures, t.transform).toEqual([]);
    expect(r.passed).toBe(true);
    expect(r.transforms.every((t) => t.pairs > 20)).toBe(true);
  });

  it.each([
    ["length-rewarding", createLengthRewardingMock, ["length", "padding"]],
    ["bullet-rewarding", createBulletRewardingMock, ["bullets"]],
    ["simple-English-penalizing", createSimpleEnglishPenalizingMock, ["formality"]],
    ["order-sensitive", createOrderSensitiveMock, ["section_order"]],
  ] as const)("FAILS a planted %s model on the matching transform", { timeout: 60_000 }, async (_name, make, transforms) => {
    const r = await run(make, [...transforms]);
    expect(r.passed).toBe(false);
    for (const t of r.transforms) {
      expect(t.passed, `${t.transform}: ${JSON.stringify(t)}`).toBe(false);
    }
  });
});
