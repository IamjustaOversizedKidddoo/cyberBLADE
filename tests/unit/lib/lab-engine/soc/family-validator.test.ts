import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import fs from "node:fs";
import path from "node:path";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import {
  validateVariantSemanticConsistency,
  scanClientViewLeaks,
  detectTells,
  ReferenceSolver,
  runFamilyProof,
  TrustToolSeveritySolver,
  evaluateSolverOnScenario,
} from "@/lib/lab-engine/soc/family-validator";
import { type SocScenario } from "@/lib/lab-engine/soc/schema";

function loadReferenceFamily(): SocFamily {
  const raw = fs.readFileSync(path.resolve("content/soc/families/soc-f-mixed-signal-01.yaml"), "utf8");
  return socFamilySchema.parse(parseYaml(raw));
}

describe("SOC Family Proof & Validation Toolchain (Positive & Negative Fixtures)", () => {
  const family = loadReferenceFamily();

  it("passes all 7 layers on valid generated variants", () => {
    const { scenario } = generateSocVariant(family, "valid-proof-seed", "intermediate");

    // Semantic consistency
    const sem = validateVariantSemanticConsistency(scenario);
    expect(sem.valid).toBe(true);
    expect(sem.errors).toHaveLength(0);

    // Client view zero-knowledge scan
    const leak = scanClientViewLeaks(scenario);
    expect(leak.passed).toBe(true);
    expect(leak.leaks).toHaveLength(0);

    // Tell detection across pooled scenarios
    const samplePool = [1, 2, 3, 4, 5].map((i) => generateSocVariant(family, `tell-check-${i}`, "intermediate").scenario);
    const tell = detectTells(samplePool);
    expect(tell.passed).toBe(true);

    // Reference solver solvability
    const refSolve = evaluateSolverOnScenario(ReferenceSolver, scenario);
    expect(refSolve.scorePercentage).toBeGreaterThanOrEqual(75);
  });

  describe("Planted Flaw Negative Tests", () => {
    it("catches ground truth leakage in client-visible fields (Flaw 1: Leaked Field)", () => {
      const { scenario } = generateSocVariant(family, "leak-flaw-seed", "intermediate");

      // Intentionally plant forbidden ground truth string into an alert summary
      const mutated: SocScenario = {
        ...scenario,
        alerts: scenario.alerts.map((a, idx) =>
          idx === 0
            ? { ...a, summary: `${a.summary} (ATTACK_STAGE: true_positive)` }
            : a,
        ),
      };

      const leak = scanClientViewLeaks(mutated);
      expect(leak.passed).toBe(false);
      expect(leak.leaks.some((f) => f.includes("true_positive"))).toBe(true);
    });

    it("catches true positive alert with zero supporting evidence (Flaw 2: Missing Evidence)", () => {
      const { scenario } = generateSocVariant(family, "missing-evidence-seed", "intermediate");

      // Mutate a true positive alert to strip all supporting events, IOCs, and raw fields
      const tpAlert = scenario.alerts.find((a) => a.groundTruth.kind === "true_positive")!;
      const mutated: SocScenario = {
        ...scenario,
        alerts: scenario.alerts.map((a) =>
          a.id === tpAlert.id
            ? {
                ...a,
                linkedRawEvents: [],
                relatedIocs: [],
                rawFields: {},
              }
            : a,
        ),
      };

      const sem = validateVariantSemanticConsistency(mutated);
      expect(sem.valid).toBe(false);
      expect(sem.errors.some((e) => e.includes("zero supporting evidence"))).toBe(true);
    });

    it("catches alert referencing non-existent incident (Flaw 3: Orphaned Reference)", () => {
      const { scenario } = generateSocVariant(family, "orphaned-incident-seed", "intermediate");

      const mutated: SocScenario = {
        ...scenario,
        alerts: scenario.alerts.map((a, idx) =>
          idx === 0
            ? {
                ...a,
                groundTruth: {
                  ...a.groundTruth,
                  incidentId: "inc-non-existent-9999",
                },
              }
            : a,
        ),
      };

      const sem = validateVariantSemanticConsistency(mutated);
      expect(sem.valid).toBe(false);
      expect(sem.errors.some((e) => e.includes("references unknown incident"))).toBe(true);
    });

    it("catches accidental IOC collision between benign alert and incident (Flaw 4: IOC Collision)", () => {
      const { scenario } = generateSocVariant(family, "ioc-collision-seed", "intermediate");

      const inc = scenario.groundTruth.incidents[0];
      const tpAlert = scenario.alerts.find((a) => inc.truePositiveAlertIds.includes(a.id) && a.relatedIocs.length > 0)!;
      const incidentIoc = tpAlert.relatedIocs[0];

      // Plant this incident IOC onto a benign alert
      const benignAlert = scenario.alerts.find((a) => a.groundTruth.kind === "false_positive")!;
      const mutated: SocScenario = {
        ...scenario,
        alerts: scenario.alerts.map((a) =>
          a.id === benignAlert.id
            ? {
                ...a,
                relatedIocs: [...a.relatedIocs, incidentIoc],
              }
            : a,
        ),
      };

      const sem = validateVariantSemanticConsistency(mutated);
      expect(sem.valid).toBe(false);
      expect(sem.errors.some((e) => e.includes("IOC Collision"))).toBe(true);
    });

    it("catches trivial severity exploit where tool severity separates TP from FP (Flaw 5: Trivial Exploit)", () => {
      const { scenario } = generateSocVariant(family, "trivial-exploit-seed", "intermediate");

      // Mutate scenario so tool severity trivially predicts true positives
      // All TP are CRITICAL, all FP are LOW, and ground truth aligns with it
      const mutated: SocScenario = {
        ...scenario,
        alerts: scenario.alerts.map((a) => {
          const isTP = a.groundTruth.kind === "true_positive";
          return {
            ...a,
            severity: isTP ? "CRITICAL" : "LOW",
            groundTruth: {
              ...a.groundTruth,
              correctSeverity: isTP ? "CRITICAL" : "LOW",
              correctDisposition: isTP ? "true_positive" : "false_positive",
              correctEscalation: isTP,
            },
          };
        }),
      };

      // Running TrustToolSeverity on this trivialized scenario should achieve near 100%
      const { scorePercentage } = evaluateSolverOnScenario(TrustToolSeveritySolver, mutated);
      expect(scorePercentage).toBeGreaterThanOrEqual(95); // Violates the <=70% ceiling!
    });
  });

  describe("Proof Toolchain Sample Run", () => {
    it("runs 20-seed proof runner and passes with positive margin", () => {
      const report = runFamilyProof(family, 20, "intermediate");
      expect(report.verdict).toBe("PASSED");
      expect(report.structuralPassRate).toBe(100);
      expect(report.semanticPassRate).toBe(100);
      expect(report.tellDetectionPassRate).toBe(100);
      expect(report.leakScanPassRate).toBe(100);
      expect(report.referenceSolver.meanScore).toBeGreaterThanOrEqual(80);
      expect(report.bestNaiveMaxScore).toBeLessThanOrEqual(70);
      expect(report.referenceToNaiveMargin).toBeGreaterThanOrEqual(20);
    });
  });
});
