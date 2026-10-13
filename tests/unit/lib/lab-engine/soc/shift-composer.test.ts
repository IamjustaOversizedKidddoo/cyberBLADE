import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { shiftProfileSchema, type ShiftProfile } from "@/lib/lab-engine/soc/shift-schema";
import {
  loadFamilyCatalog,
  composeShiftScenario,
  runShiftProof,
} from "@/lib/lab-engine/soc/shift-composer";

describe("SOC Shift Composer", () => {
  const shiftsDir = path.resolve("content/soc/shifts");
  const shiftFiles = fs.readdirSync(shiftsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const familyCatalog = loadFamilyCatalog();

  it("should have all 4 required shift profile YAML files present and valid against schema", () => {
    expect(shiftFiles.length).toBeGreaterThanOrEqual(4);

    for (const file of shiftFiles) {
      const raw = fs.readFileSync(path.join(shiftsDir, file), "utf8");
      const parsed = shiftProfileSchema.safeParse(parseYaml(raw));
      expect(parsed.success, `Schema validation failed for ${file}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("should generate deterministic shift scenarios from (shiftProfile, seed)", () => {
    const raw = fs.readFileSync(path.join(shiftsDir, "shift-quiet-day.yaml"), "utf8");
    const profile = shiftProfileSchema.parse(parseYaml(raw));

    const s1 = composeShiftScenario(profile, "test-shift-seed-alpha", familyCatalog);
    const s2 = composeShiftScenario(profile, "test-shift-seed-alpha", familyCatalog);
    const s3 = composeShiftScenario(profile, "test-shift-seed-beta", familyCatalog);

    expect(s1.id).toBe(s2.id);
    expect(s1.alerts.length).toBe(s2.alerts.length);
    expect(s1.rawEvents.length).toBe(s2.rawEvents.length);
    expect(s1.alerts[0].summary).toBe(s2.alerts[0].summary);

    // Different seed produces different scenario
    expect(s1.id).not.toBe(s3.id);
    expect(s1.alerts.map((a) => a.summary)).not.toEqual(s3.alerts.map((a) => a.summary));
  });

  it("should correctly support declared multi-stage chain linking in standard mixed shift", () => {
    const raw = fs.readFileSync(path.join(shiftsDir, "shift-standard-mixed.yaml"), "utf8");
    const profile = shiftProfileSchema.parse(parseYaml(raw));

    const scenario = composeShiftScenario(profile, "test-chain-linking-01", familyCatalog);

    // Verify incidents and alert counts
    expect(scenario.groundTruth.incidents.length).toBeGreaterThanOrEqual(2);
    expect(scenario.alerts.length).toBeGreaterThanOrEqual(profile.targetAlertCount.min);

    // Find the multi-stage chain incident
    const chainedInc = scenario.groundTruth.incidents.find((i) => i.truePositiveAlertIds.length >= 2);
    expect(chainedInc).toBeDefined();
  });

  it("should run proof validation on shift-quiet-day with reference solver beating naive ceiling", () => {
    const raw = fs.readFileSync(path.join(shiftsDir, "shift-quiet-day.yaml"), "utf8");
    const profile = shiftProfileSchema.parse(parseYaml(raw));

    const report = runShiftProof(profile, 5, familyCatalog);

    expect(report.structuralPassRate).toBe(100);
    expect(report.semanticPassRate).toBe(100);
    expect(report.leakScanPassRate).toBe(100);
    expect(report.referenceSolver.minScore).toBeGreaterThanOrEqual(75);
    expect(report.bestNaiveMaxScore).toBeLessThanOrEqual(70);
    expect(report.verdict).toBe("PASSED");
  });
});
