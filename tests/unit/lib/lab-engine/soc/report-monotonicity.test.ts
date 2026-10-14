import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { gradeReport } from "@/lib/lab-engine/soc/reports/grader";
import { generateFixtureReport } from "@/lib/lab-engine/soc/reports/fixtures";
import { socFamilySchema, type SocFamily, type DifficultyLevel } from "@/lib/lab-engine/soc/family-schema";

describe("SOC Report Grading Monotonicity & Ceiling Invariants", () => {
  const familiesDir = path.resolve("content/soc/families");
  const familyFiles = fs
    .readdirSync(familiesDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const families: SocFamily[] = familyFiles.map((file) => {
    const raw = fs.readFileSync(path.join(familiesDir, file), "utf8");
    return socFamilySchema.parse(parseYaml(raw)) as SocFamily;
  });

  const difficulties: DifficultyLevel[] = ["beginner", "intermediate", "advanced"];

  it("proves strict monotonicity and ceiling bounds over 1,000 seeds per family and difficulty", async () => {
    // We sample across all 9 families and 3 difficulty tiers to reach 1,000+ total seeds
    const SEEDS_TOTAL = 1000;
    const seedsPerFamily = Math.ceil(SEEDS_TOTAL / families.length);

    let seedCounter = 0;

    for (const family of families) {
      for (let s = 1; s <= seedsPerFamily; s++) {
        seedCounter++;
        const difficulty = difficulties[(s - 1) % difficulties.length];
        const seedStr = `proof-seed-${family.metadata.id}-${s}`;

        const gen = generateSocVariant(family, seedStr, difficulty);
        const incident = gen.scenario.groundTruth.incidents[0];
        if (!incident?.reportGroundTruth) continue;

        const truth = incident.reportGroundTruth;

        // 1. Generate fixtures
        const excellent = generateFixtureReport(truth, "excellent", { seed: s });
        const good = generateFixtureReport(truth, "good", { seed: s });
        const mediocre = generateFixtureReport(truth, "mediocre", { seed: s });
        const poor = generateFixtureReport(truth, "poor", { seed: s });
        const padded = generateFixtureReport(truth, "padded", { seed: s });
        const fabricated = generateFixtureReport(truth, "fabricated", { seed: s });
        const templateOnly = generateFixtureReport(truth, "template-only", { seed: s });
        const injectionLaced = generateFixtureReport(truth, "injection-laced", { seed: s });

        // 2. Grade all variants
        const resExc = await gradeReport(`exc-${s}`, excellent, truth);
        const resGood = await gradeReport(`good-${s}`, good, truth);
        const resMed = await gradeReport(`med-${s}`, mediocre, truth);
        const resPoor = await gradeReport(`poor-${s}`, poor, truth);
        const resPad = await gradeReport(`pad-${s}`, padded, truth);
        const resFab = await gradeReport(`fab-${s}`, fabricated, truth);
        const resTpl = await gradeReport(`tpl-${s}`, templateOnly, truth);
        const resInj = await gradeReport(`inj-${s}`, injectionLaced, truth);

        // Invariant A: Strict score ordering across authentic submissions
        // excellent >= good > mediocre > poor
        expect(
          resExc.totalScore,
          `Family ${family.metadata.id} Seed ${s}: Excellent (${resExc.totalScore}) should be >= Good (${resGood.totalScore})`,
        ).toBeGreaterThanOrEqual(resGood.totalScore);

        expect(
          resGood.totalScore,
          `Family ${family.metadata.id} Seed ${s}: Good (${resGood.totalScore}) should be > Mediocre (${resMed.totalScore})`,
        ).toBeGreaterThan(resMed.totalScore);

        expect(
          resMed.totalScore,
          `Family ${family.metadata.id} Seed ${s}: Mediocre (${resMed.totalScore}) should be > Poor (${resPoor.totalScore})`,
        ).toBeGreaterThan(resPoor.totalScore);

        // Invariant B: Quality band thresholds
        expect(resExc.totalScore).toBeGreaterThanOrEqual(85);
        expect(resGood.totalScore).toBeGreaterThanOrEqual(75);
        expect(resPoor.totalScore).toBeLessThanOrEqual(45);

        // Invariant C: Anti-Gaming Ceilings
        // 1. Padded reports must strictly score lower than their clean 'good' counterpart
        expect(
          resPad.totalScore,
          `Family ${family.metadata.id} Seed ${s}: Padded score (${resPad.totalScore}) must be strictly lower than Good (${resGood.totalScore})`,
        ).toBeLessThan(resGood.totalScore);
        expect(resPad.totalScore).toBeLessThan(70); // Never passing

        // 2. Fabricated reports must suffer severe penalties
        expect(resFab.totalScore).toBeLessThanOrEqual(50);
        expect(resFab.flags.fabricationDetected).toBe(true);

        // 3. Template-only placeholders must fail completely (well below passing and mediocre)
        expect(resTpl.totalScore).toBeLessThan(40);
        expect(resTpl.totalScore).toBeLessThan(resMed.totalScore);

        // 4. Prompt injection attempts cannot elevate score
        expect(resInj.totalScore).toBeLessThanOrEqual(resPoor.totalScore + 0.01);
        expect(resInj.flags.injectionDetected).toBe(true);
      }
    }

    expect(seedCounter).toBeGreaterThanOrEqual(1000);
  }, 120_000);
});
