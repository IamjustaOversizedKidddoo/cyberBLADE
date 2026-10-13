import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { toClientView } from "@/lib/lab-engine/soc/schema";
import { evaluateSocAttempt } from "@/lib/lab-engine/soc/evaluator";
import {
  validateEnrichmentConsistency,
  detectEnrichmentTells,
  verifySourceCalibration,
} from "@/lib/lab-engine/soc/enrichment/validator";
import { generateEnrichment, resolveEntityRole } from "@/lib/lab-engine/soc/enrichment/generator";
import { evaluateSourceReputation } from "@/lib/lab-engine/soc/enrichment/sources";
import {
  EnrichmentAwareReferenceSolver,
  LazyEnrichmentSolver,
  ScoreOnlySolver,
} from "@/lib/lab-engine/soc/enrichment/solvers";
import { ENRICHMENT_TOOLS, type EntityRole, type ReputationSourceReport, type ReputationResult } from "@/lib/lab-engine/soc/enrichment/types";
import { createRng } from "@/lib/generators/rng";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = parseYaml(fs.readFileSync(filePath, "utf8"));
  return socFamilySchema.parse(raw);
}

const ALL_FAMILY_IDS = [
  "soc-f-alert-fatigue-01",
  "soc-f-attachment-script-01",
  "soc-f-brute-force-auth-01",
  "soc-f-cloud-identity-01",
  "soc-f-insider-policy-01",
  "soc-f-mixed-signal-01",
  "soc-f-outbound-exfil-01",
  "soc-f-phishing-cred-01",
  "soc-f-web-attack-data-01",
];

describe("Part E Proof Toolchain: Solvability, Calibration, Tells, and Coherence", () => {
  it("validates cross-tool consistency and lack of ground truth leaks across all 9 families", () => {
    for (const familyId of ALL_FAMILY_IDS) {
      const family = loadFamily(familyId);
      const { scenario } = generateSocVariant(family, `proof-coherence-${familyId}`, "intermediate");

      const result = validateEnrichmentConsistency(scenario, `proof-coherence-${familyId}`);
      expect(result.valid, `Consistency failed for ${familyId}: ${result.errors.join(", ")}`).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it("verifies tell detection: tool outputs do not leak ground truth through field presence or unanimous verdict", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "tell-detection-seed-42", "intermediate");

    const samples: Array<{ role: EntityRole; payload: any; latencyMs: number }> = [];

    // Sample attacker indicators
    const attackerIps = ["198.51.100.24", "198.51.100.99"];
    for (const ip of attackerIps) {
      const res = generateEnrichment(scenario, "tell-detection-seed-42", "reputation", "ip", ip);
      samples.push({ role: "attacker_infra", payload: res.data, latencyMs: 42 });
    }

    // Sample benign indicators
    const benignIps = ["192.0.2.10", "192.0.2.45"];
    for (const ip of benignIps) {
      const res = generateEnrichment(scenario, "tell-detection-seed-42", "reputation", "ip", ip);
      samples.push({ role: "benign_business", payload: res.data, latencyMs: 44 });
    }

    const tellResult = detectEnrichmentTells(samples);
    expect(tellResult.passed).toBe(true);
    expect(tellResult.leakingFeatures).toHaveLength(0);
  });

  it("verifies source calibration over 1,000 queries matches declared FP and FN error profiles", () => {
    const samples: Array<{ role: EntityRole; sourceKey: "threatwatch_community" | "apex_commercial"; report: ReputationSourceReport }> = [];

    // Run 1,000 stochastic evaluations using sub-seeded RNGs
    for (let i = 0; i < 1000; i++) {
      const rng1 = createRng(`calib-tw-${i}`);
      const rng2 = createRng(`calib-apex-${i}`);

      const role: EntityRole = i % 2 === 0 ? "attacker_infra" : "benign_business";

      const repTW = evaluateSourceReputation("threatwatch_community", role, rng1);
      if (repTW) {
        samples.push({ role, sourceKey: "threatwatch_community", report: repTW });
      }

      const repApex = evaluateSourceReputation("apex_commercial", role, rng2);
      if (repApex) {
        samples.push({ role, sourceKey: "apex_commercial", report: repApex });
      }
    }

    const calibResult = verifySourceCalibration(samples);
    expect(calibResult.passed).toBe(true);

    // ThreatWatch: declared FP 0.12, declared FN 0.15
    const tw = calibResult.rates.threatwatch_community;
    expect(tw.realizedFP).toBeGreaterThan(0.06);
    expect(tw.realizedFP).toBeLessThan(0.20);
    expect(tw.realizedFN).toBeGreaterThan(0.08);
    expect(tw.realizedFN).toBeLessThan(0.24);

    // Apex: declared FP 0.03, declared FN 0.20
    const apex = calibResult.rates.apex_commercial;
    expect(apex.realizedFP).toBeLessThan(0.10);
    expect(apex.realizedFN).toBeGreaterThan(0.10);
    expect(apex.realizedFN).toBeLessThan(0.32);
  });

  it("proves Reference Solver solvability with tools across diverse families with +15% margin over naive solvers", () => {
    function toDecisionRecords(map: Record<string, any>) {
      return Object.values(map).map((d) => ({
        ...d,
        id: `dec-${d.alertId}`,
        attemptId: "test-attempt",
        evidenceRefs: [],
        createdAt: new Date().toISOString(),
      }));
    }

    const testFamilies = ["soc-f-phishing-cred-01", "soc-f-brute-force-auth-01", "soc-f-alert-fatigue-01"];

    const margins: number[] = [];

    for (const familyId of testFamilies) {
      const family = loadFamily(familyId);
      const seed = `solvability-seed-${familyId}`;
      const { scenario } = generateSocVariant(family, seed, "intermediate");
      const clientView = toClientView(scenario);

      // 1. Reference Solver
      const refResult = EnrichmentAwareReferenceSolver.solve(scenario, clientView, seed);
      const refEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(refResult.decisions), []);

      expect(refEval.percentage).toBeGreaterThanOrEqual(75);
      expect(refResult.stats.totalLookups).toBeGreaterThan(0);

      // 2. Lazy Solver
      const lazyDecisions = LazyEnrichmentSolver.solve(scenario, clientView, seed);
      const lazyEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(lazyDecisions), []);
      expect(lazyEval.percentage).toBeLessThanOrEqual(70);

      // 3. Score-Only Solver
      const scoreDecisions = ScoreOnlySolver.solve(scenario, clientView, seed);
      const scoreEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(scoreDecisions), []);
      expect(scoreEval.percentage).toBeLessThanOrEqual(70);

      const bestNaive = Math.max(lazyEval.percentage, scoreEval.percentage);
      const margin = refEval.percentage - bestNaive;
      margins.push(margin);

      console.log(`[Family: ${familyId}] Ref: ${refEval.percentage}%, Lazy: ${lazyEval.percentage}%, ScoreOnly: ${scoreEval.percentage}%, Margin: +${margin}%`);
      expect(margin).toBeGreaterThanOrEqual(10);
    }

    const meanMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    expect(meanMargin).toBeGreaterThanOrEqual(15);
  });

  it("benchmarks lookup generation performance across all 10 tools to ensure under 50ms execution", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "perf-bench-seed-99", "intermediate");

    for (const tool of ENRICHMENT_TOOLS) {
      const t0 = performance.now();
      const res = generateEnrichment(scenario, "perf-bench-seed-99", tool, "ip", "198.51.100.24");
      const elapsed = performance.now() - t0;

      expect(res).toBeDefined();
      expect(elapsed).toBeLessThan(50); // Under 50ms pure generation time
    }
  });
});
