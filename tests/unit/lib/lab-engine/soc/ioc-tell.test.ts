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
  it("new attempts use the balanced generator version", () => {
    expect(GENERATOR_VERSION).toBe("1.1.0");
  });

  it("attempts pinned to 1.0.0 regenerate exactly as before (same alerts, same content hash)", () => {
    for (const f of families) {
      const old = generateSocVariant(f, "pin-check", "intermediate", { generatorVersion: "1.0.0" });
      const now = generateSocVariant(f, "pin-check", "intermediate");
      expect(old.contentHash).toBe(now.contentHash); // stored attempt hashes keep matching
      expect(old.scenario.alerts.filter((a) => a.groundTruth.kind !== "true_positive" && a.relatedIocs.length > 0)).toEqual([]);
      // True-positive IOCs (the report and enrichment answer keys) are identical in both versions.
      const tp = (s: SocScenario) => s.alerts.filter((a) => a.groundTruth.kind === "true_positive").map((a) => a.relatedIocs);
      expect(tp(now.scenario)).toEqual(tp(old.scenario));
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
