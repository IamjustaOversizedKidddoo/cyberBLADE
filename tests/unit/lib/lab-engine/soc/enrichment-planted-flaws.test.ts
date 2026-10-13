import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import {
  validateEnrichmentConsistency,
  detectEnrichmentTells,
  verifySourceCalibration,
} from "@/lib/lab-engine/soc/enrichment/validator";
import type { EntityRole, ReputationSourceReport } from "@/lib/lab-engine/soc/enrichment/types";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = parseYaml(fs.readFileSync(filePath, "utf8"));
  return socFamilySchema.parse(raw);
}

describe("SOC Enrichment Planted Flaw & Tell Detection Suite", () => {
  const family = loadFamily("soc-f-phishing-cred-01");
  const { scenario: baseScenario } = generateSocVariant(family, "planted-flaw-seed-01", "intermediate");

  it("passes clean scenario without planted flaws", () => {
    const result = validateEnrichmentConsistency(baseScenario, "planted-flaw-seed-01");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("Flaw 1: Leaked ground truth marker 'attacker_infra' must be detected by validateEnrichmentConsistency", () => {
    const broken = structuredClone(baseScenario);
    broken.rawEvents[0].message = `${broken.rawEvents[0].message} [attacker_infra node]`;

    const result = validateEnrichmentConsistency(broken, "planted-flaw-seed-01");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("attacker_infra"))).toBe(true);
  });

  it("Flaw 2: Alert referencing nonexistent CMDB asset must be caught by validateEnrichmentConsistency", () => {
    const broken = structuredClone(baseScenario);
    broken.alerts[0].relatedAsset = "phantom-server-999.corp.internal";

    const result = validateEnrichmentConsistency(broken, "planted-flaw-seed-01");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("phantom-server-999.corp.internal"))).toBe(true);
  });

  it("Flaw 3: Unique field present only on malicious responses must be caught by detectEnrichmentTells", () => {
    const samples = [
      { role: "attacker_infra" as EntityRole, payload: { domain: "bad.example", isKnownMaliciousFlag: true } },
      { role: "benign_business" as EntityRole, payload: { domain: "good.example" } },
    ];

    const result = detectEnrichmentTells(samples);
    expect(result.passed).toBe(false);
    expect(result.leakingFeatures.some((f) => f.feature === "unique-field-presence")).toBe(true);
  });

  it("Flaw 4: Artificial latency disparity between malicious and benign must be caught by detectEnrichmentTells", () => {
    const samples: Array<{ role: EntityRole; payload: Record<string, unknown>; latencyMs: number }> = [];

    // 10 attacker queries with 120ms latency
    for (let i = 0; i < 10; i++) {
      samples.push({ role: "attacker_infra", payload: { query: `atk-${i}` }, latencyMs: 120 });
    }
    // 10 benign queries with 20ms latency
    for (let i = 0; i < 10; i++) {
      samples.push({ role: "benign_business", payload: { query: `ben-${i}` }, latencyMs: 20 });
    }

    const result = detectEnrichmentTells(samples);
    expect(result.passed).toBe(false);
    expect(result.leakingFeatures.some((f) => f.feature === "latency-disparity")).toBe(true);
  });

  it("Flaw 5: Unanimous malicious verdict tell (zero false negatives) must be caught by detectEnrichmentTells", () => {
    const samples: Array<{ role: EntityRole; payload: Record<string, unknown> }> = [];

    // 10 attacker queries where all sources report 100% malicious without any disagreement
    for (let i = 0; i < 10; i++) {
      samples.push({
        role: "attacker_infra",
        payload: {
          sources: [
            { id: "src1", verdict: "malicious" },
            { id: "src2", verdict: "malicious" },
          ],
        },
      });
    }
    // 10 benign queries
    for (let i = 0; i < 10; i++) {
      samples.push({
        role: "benign_business",
        payload: {
          sources: [
            { id: "src1", verdict: "clean" },
            { id: "src2", verdict: "clean" },
          ],
        },
      });
    }

    const result = detectEnrichmentTells(samples);
    expect(result.passed).toBe(false);
    expect(result.leakingFeatures.some((f) => f.feature === "unanimous-attacker-verdict")).toBe(true);
  });

  it("Flaw 6: Uncalibrated source error rate must be caught by verifySourceCalibration", () => {
    // Fabricate samples where ThreatWatch has 80% false positives (declared is 12%)
    const brokenSamples: Array<{ role: EntityRole; sourceKey: "threatwatch_community"; report: ReputationSourceReport }> = [];

    for (let i = 0; i < 100; i++) {
      brokenSamples.push({
        role: "benign_business",
        sourceKey: "threatwatch_community",
        report: {
          id: "threatwatch_community",
          name: "ThreatWatch",
          category: "community_feed",
          verdict: i < 80 ? "malicious" : "clean", // 80% FP!
          score: 85,
          confidence: 80,
          firstSeen: null,
          lastSeen: null,
          notes: "Broken mock",
        },
      });
      brokenSamples.push({
        role: "attacker_infra",
        sourceKey: "threatwatch_community",
        report: {
          id: "threatwatch_community",
          name: "ThreatWatch",
          category: "community_feed",
          verdict: "malicious",
          score: 95,
          confidence: 90,
          firstSeen: null,
          lastSeen: null,
          notes: "Broken mock",
        },
      });
    }

    const calibResult = verifySourceCalibration(brokenSamples);
    expect(calibResult.passed).toBe(false);
    expect(calibResult.rates.threatwatch_community.realizedFP).toBe(0.8);
  });
});
