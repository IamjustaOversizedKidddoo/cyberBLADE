import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import {
  validateVariantSemanticConsistency,
  scanClientViewLeaks,
  detectTells,
} from "@/lib/lab-engine/soc/family-validator";

describe("SOC Planted Flaw Detection Suite", () => {
  const familiesDir = path.resolve("content/soc/families");
  const familyFiles = fs.readdirSync(familiesDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const families: SocFamily[] = familyFiles.map((file) => {
    const raw = parseYaml(fs.readFileSync(path.join(familiesDir, file), "utf8"));
    return socFamilySchema.parse(raw);
  });

  it("should fail validation if reviewStatus is practitioner-reviewed without reviewerNotes", () => {
    const raw = parseYaml(fs.readFileSync(path.join(familiesDir, familyFiles[0]), "utf8")) as Record<string, unknown>;
    const metadata = { ...(raw.metadata as Record<string, unknown>), reviewStatus: "practitioner-reviewed", reviewerNotes: "" };
    const invalid = { ...raw, metadata };

    const parsed = socFamilySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  for (const family of families) {
    describe(`Planted flaws for family: ${family.metadata.id}`, () => {
      const baseResult = generateSocVariant(family, "planted-flaw-base-seed-01", "intermediate");
      const baseScenario = baseResult.scenario;

      it("Flaw 1: Leaked ground-truth word 'true_positive' in alert summary must be caught by scanClientViewLeaks", () => {
        const broken = structuredClone(baseScenario);
        const tpAlert = broken.alerts.find((a) => a.groundTruth.kind === "true_positive");
        expect(tpAlert).toBeDefined();
        tpAlert!.summary = `${tpAlert!.summary} (verified true_positive)`;

        const leakResult = scanClientViewLeaks(broken);
        expect(leakResult.passed).toBe(false);
        expect(leakResult.leaks.some((l) => l.includes("true_positive"))).toBe(true);
      });

      it("Flaw 2: Tell-tale ID format on malicious alerts only must be caught by detectTells", () => {
        // Give malicious alerts an anomalous ID length format
        const brokenBatch = [1, 2, 3, 4, 5].map((idx) => {
          const sc = structuredClone(generateSocVariant(family, `tell-seed-id-${idx}`, "intermediate").scenario);
          for (const a of sc.alerts) {
            if (a.groundTruth.kind === "true_positive") {
              a.id = `malicious-alert-long-id-${a.id}`;
            }
          }
          return sc;
        });

        const tellResult = detectTells(brokenBatch);
        const idTell = tellResult.leakingFeatures.find((f) => f.feature === "id-length");
        expect(idTell).toBeDefined();
        expect(idTell!.accuracy).toBeGreaterThan(0.72);
        expect(tellResult.passed).toBe(false);
      });

      it("Flaw 3: Missing evidence link on true positive alert must be caught by validateVariantSemanticConsistency", () => {
        const broken = structuredClone(baseScenario);
        const tpAlert = broken.alerts.find((a) => a.groundTruth.kind === "true_positive");
        expect(tpAlert).toBeDefined();
        tpAlert!.linkedRawEvents = [];
        tpAlert!.relatedIocs = [];
        tpAlert!.rawFields = {};

        const semResult = validateVariantSemanticConsistency(broken);
        expect(semResult.valid).toBe(false);
        expect(semResult.errors.some((e) => e.includes("zero supporting evidence"))).toBe(true);
      });

      it("Flaw 4: IOC collision between benign alert and malicious incident must be caught", () => {
        const broken = structuredClone(baseScenario);
        const tpAlert = broken.alerts.find((a) => a.groundTruth.kind === "true_positive");
        const fpAlert = broken.alerts.find((a) => a.groundTruth.kind !== "true_positive");
        expect(tpAlert).toBeDefined();
        expect(fpAlert).toBeDefined();

        const maliciousIoc = tpAlert!.relatedIocs[0] ?? { type: "ip", value: "198.51.100.77" };
        if (tpAlert!.relatedIocs.length === 0) {
          tpAlert!.relatedIocs.push(maliciousIoc);
        }
        fpAlert!.relatedIocs.push({ ...maliciousIoc });

        const semResult = validateVariantSemanticConsistency(broken);
        expect(semResult.valid).toBe(false);
        expect(semResult.errors.some((e) => e.includes("IOC Collision"))).toBe(true);
      });

      it("Flaw 5: Telemetry gap removing all evidence from true positive must be caught", () => {
        const broken = structuredClone(baseScenario);
        const tpAlert = broken.alerts.find((a) => a.groundTruth.kind === "true_positive");
        expect(tpAlert).toBeDefined();

        broken.rawEvents = broken.rawEvents.filter((e) => !tpAlert!.linkedRawEvents.includes(e.id));
        tpAlert!.relatedIocs = [];
        tpAlert!.rawFields = {};

        const semResult = validateVariantSemanticConsistency(broken);
        expect(semResult.valid).toBe(false);
      });

      it("Flaw 6: Severity equals ground truth in all cases must be caught by validateVariantSemanticConsistency", () => {
        const defective = structuredClone(baseScenario);
        for (const a of defective.alerts) {
          a.severity = a.groundTruth.correctSeverity;
        }

        const semResult = validateVariantSemanticConsistency(defective);
        expect(semResult.valid).toBe(false);
        expect(semResult.errors.some((e) => e.includes("Uncalibrated tool severity"))).toBe(true);
      });
    });
  }
});
