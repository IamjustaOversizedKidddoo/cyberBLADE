/**
 * L1-A-03 regression: an IOC chip on an alert must not give the verdict away. Measured the way the
 * audit did: pooled over every family and shift, how well does "has at least one IOC" predict a
 * true positive? Before the fix every alert with an IOC was a true positive (precision 1.0).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { shiftProfileSchema, type ShiftProfile } from "@/lib/lab-engine/soc/shift-schema";
import { generateSocVariant, GENERATOR_VERSION } from "@/lib/lab-engine/soc/generator";
import { composeShiftScenario } from "@/lib/lab-engine/soc/shift-composer";
import type { SocScenario } from "@/lib/lab-engine/soc/schema";
import { validateVariantSemanticConsistency } from "@/lib/lab-engine/soc/family-validator";

const read = <T,>(dir: string, parse: (x: unknown) => T) =>
  fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).map((f) => parse(parseYaml(fs.readFileSync(path.join(dir, f), "utf8"))));
const families = read(path.resolve("content/soc/families"), (x) => socFamilySchema.parse(x) as SocFamily);
const shifts = read(path.resolve("content/soc/shifts"), (x) => shiftProfileSchema.parse(x) as ShiftProfile);

// Pooled tally, filled one family/shift per test (tests in a file run in order) so no single test
// does the whole CPU-heavy sweep under the per-test budget.
const tally = { tpWith: 0, tpWithout: 0, otherWith: 0, otherWithout: 0 };
function count(sc: SocScenario) {
  for (const a of sc.alerts) {
    const tp = a.groundTruth.kind === "true_positive";
    const has = a.relatedIocs.length > 0;
    if (tp && has) tally.tpWith++;
    else if (tp) tally.tpWithout++;
    else if (has) tally.otherWith++;
    else tally.otherWithout++;
  }
}

describe("L1-A-03: IOC presence is not a verdict tell", () => {
  it("new attempts use the current generator version (IOC balancing + per-seed values)", () => {
    expect(GENERATOR_VERSION).toBe("1.2.0");
  });

  it("attempts pinned to an older version regenerate exactly as before (same alerts, same content hash)", () => {
    const tp = (s: SocScenario) => s.alerts.filter((a) => a.groundTruth.kind === "true_positive").map((a) => a.relatedIocs);
    for (const f of families) {
      const v100 = generateSocVariant(f, "pin-check", "intermediate", { generatorVersion: "1.0.0" });
      const v110 = generateSocVariant(f, "pin-check", "intermediate", { generatorVersion: "1.1.0" });
      const now = generateSocVariant(f, "pin-check", "intermediate");
      // Stored attempt hashes keep matching across versions (IOC values are not part of the hash).
      expect(new Set([v100.contentHash, v110.contentHash, now.contentHash]).size).toBe(1);
      expect(v100.scenario.alerts.filter((a) => a.groundTruth.kind !== "true_positive" && a.relatedIocs.length > 0)).toEqual([]);
      // 1.1.0 changed only non-true-positive alerts; the answer-key IOCs are those of 1.0.0.
      expect(tp(v110.scenario)).toEqual(tp(v100.scenario));
      // Everything but indicator values is identical in 1.2.0 (its values use their own RNG stream).
      expect(now.scenario.alerts.map((a) => [a.ruleName, a.timestamp, a.groundTruth.correctDisposition])).toEqual(
        v110.scenario.alerts.map((a) => [a.ruleName, a.timestamp, a.groundTruth.correctDisposition]),
      );
    }
    const sh = shifts[0];
    const oldShift = composeShiftScenario(sh, "pin-check", undefined, { generatorVersion: "1.0.0" });
    expect(oldShift.alerts.filter((a) => a.groundTruth.kind !== "true_positive" && a.relatedIocs.length > 0)).toEqual([]);
  });

  it.each(families.map((f) => [f.metadata.id, f] as const))("pools 8 variants of %s", (_id, f) => {
    for (let s = 1; s <= 8; s++) count(generateSocVariant(f, `ioc-tell-${f.metadata.id}-${s}`, "intermediate").scenario);
  });

  it.each(shifts.map((sh) => [sh.id, sh] as const))("pools 3 variants of %s", (_id, sh) => {
    for (let s = 1; s <= 3; s++) count(composeShiftScenario(sh, `ioc-tell-${sh.id}-${s}`));
  });

  it("'has an IOC' predicts true positive no better than a weak hint", () => {
    const { tpWith, tpWithout, otherWith, otherWithout } = tally;
    expect(tpWith + tpWithout + otherWith + otherWithout).toBeGreaterThan(1000);
    const precision = tpWith / (tpWith + otherWith);
    const balancedAccuracy = (tpWith / (tpWith + tpWithout) + otherWithout / (otherWith + otherWithout)) / 2;
    expect(otherWith, "benign / false-positive alerts must also carry IOCs").toBeGreaterThan(0);
    expect(precision).toBeLessThan(0.5);
    expect(balancedAccuracy).toBeLessThan(0.72);
  });
});

describe("L1-A-09 (indicator part): true-positive indicator values do not repeat across variants", () => {
  const external = (v: string) => /^(198\.51\.100|203\.0\.113|192\.0\.2)\./.test(v) || /\.(example|test)$/i.test(v) || /^[a-f0-9]{64}$/i.test(v);

  it.each(families.map((f) => [f.metadata.id, f] as const))("%s: no external indicator value is reused in more than 15%% of 20 variants", (_id, f) => {
    const seenIn = new Map<string, number>();
    for (let s = 1; s <= 20; s++) {
      const sc = generateSocVariant(f, `ioc-reuse-${f.metadata.id}-${s}`, "intermediate").scenario;
      // A drawn value must never collide with a benign alert's indicator.
      expect(validateVariantSemanticConsistency(sc).errors.filter((e) => e.startsWith("IOC Collision"))).toEqual([]);
      const values = new Set(sc.alerts.filter((a) => a.groundTruth.kind === "true_positive").flatMap((a) => a.relatedIocs.map((i) => i.value.toLowerCase())).filter(external));
      for (const v of values) seenIn.set(v, (seenIn.get(v) ?? 0) + 1);
    }
    const worst = Math.max(0, ...seenIn.values());
    expect(worst, [...seenIn].sort((a, b) => b[1] - a[1]).slice(0, 3).join(" ")).toBeLessThanOrEqual(3);
  });
});
