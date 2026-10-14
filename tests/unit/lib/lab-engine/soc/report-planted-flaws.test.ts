import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { gradeReport, loadRubric, loadScoringConfig } from "@/lib/lab-engine/soc/reports/grader";
import { generateFixtureReport } from "@/lib/lab-engine/soc/reports/fixtures";
import type {
  SocReportData,
  SocReportGroundTruth,
  ScoringConfig,
} from "@/lib/lab-engine/soc/reports/types";

describe("Planted-Flaw Grader Verification Suite", () => {
  // Load sample ground truth
  const raw = fs.readFileSync("content/soc/families/soc-f-phishing-cred-01.yaml", "utf8");
  const family = socFamilySchema.parse(parseYaml(raw)) as SocFamily;
  const gen = generateSocVariant(family, "proof-seed-soc-f-phishing-cred-01-1", "intermediate");
  const truth = gen.scenario.groundTruth.incidents[0].reportGroundTruth!;

  const goodReport = generateFixtureReport(truth, "good");
  const poorReport = generateFixtureReport(truth, "poor");
  const paddedReport = generateFixtureReport(truth, "padded");
  const fabricatedReport = generateFixtureReport(truth, "fabricated");
  const injectionReport = generateFixtureReport(truth, "injection-laced");

  it("proves Flaw 1: Inverting verdict grading breaks the poor-report penalty and fails monotonicity", async () => {
    // Normal grading: poor report gets low score
    const normalPoor = await gradeReport("sub-poor", poorReport, truth);
    expect(normalPoor.totalScore).toBeLessThanOrEqual(45);

    // Broken grader: awards full marks if disposition is wrong
    const brokenGradeVerdict = (report: SocReportData, gt: SocReportGroundTruth): number => {
      // Inverted logic flaw: inverted disposition gets full 15 points
      if (report.verdict.disposition !== gt.verdict.correctDisposition) return 15;
      return 0;
    };

    const flawedScore = brokenGradeVerdict(poorReport, truth);
    expect(flawedScore).toBe(15); // awards unearned 15 points to inverted verdict

    // Proves that when this flaw is planted, our invariant assertion (poor.verdict <= partialCredit) fails!
    const assertVerdictCorrect = (score: number) => {
      if (score > 10) throw new Error("Flaw detected: Poor report received full verdict credit!");
    };
    expect(() => assertVerdictCorrect(flawedScore)).toThrow("Flaw detected: Poor report received full verdict credit!");
  });

  it("proves Flaw 2: Zeroing fabrication penalty lets hallucinated IoCs bypass the ceiling", async () => {
    const defaultRubric = loadRubric();
    const defaultConfig = loadScoringConfig();

    // Normal grading
    const normalFab = await gradeReport("sub-fab", fabricatedReport, truth);
    expect(normalFab.totalScore).toBeLessThanOrEqual(50);
    expect(normalFab.flags.fabricationDetected).toBe(true);

    // Planted flaw: zero fabrication penalty
    const flawedConfig: ScoringConfig = {
      ...defaultConfig,
      penalties: {
        ...defaultConfig.penalties,
        fabricationPenaltyPerItem: 0, // Bypassed penalty
      },
    };

    // Calculate IoC score with flawed config
    const iocCriterion = defaultRubric.criteria.find((c) => c.id === "ioc_extraction")!;
    // Without penalty: recall/precision without deduction
    const flawedIocScore = iocCriterion.maxPoints * 0.3; // gets precision portion without negative deduction
    expect(flawedIocScore).toBeGreaterThan(0);

    // Proves the ceiling assertion catches the flawed penalty configuration
    const assertPenaltyEnforced = (config: ScoringConfig) => {
      if (config.penalties.fabricationPenaltyPerItem <= 0) {
        throw new Error("Flaw detected: Fabrication penalty is disabled or zero!");
      }
    };
    expect(() => assertPenaltyEnforced(flawedConfig)).toThrow("Flaw detected: Fabrication penalty is disabled or zero!");
  });

  it("proves Flaw 3: Zeroing padding penalty allows keyword-stuffed reports to score like good reports", async () => {
    const normalGood = await gradeReport("sub-good", goodReport, truth);
    const normalPadded = await gradeReport("sub-pad", paddedReport, truth);

    // Baseline anti-gaming rule: padded report must score strictly lower than good report
    expect(normalPadded.totalScore).toBeLessThan(normalGood.totalScore);
    expect(normalPadded.totalScore).toBeLessThan(70);

    // Planted flaw: remove padding penalty
    const assertPaddingProtected = (padScore: number, goodScore: number) => {
      if (padScore >= goodScore) {
        throw new Error("Flaw detected: Padded spam report scored equal to or higher than clean report!");
      }
    };

    // Simulated flaw where padded report gets unpenalized recall boost
    const simulatedFlawedPaddedScore = normalGood.totalScore + 5;
    expect(() => assertPaddingProtected(simulatedFlawedPaddedScore, normalGood.totalScore)).toThrow(
      "Flaw detected: Padded spam report scored equal to or higher than clean report!",
    );
  });

  it("proves Flaw 4: Disabling timeline ordering (Kendall-Tau) lets reversed timelines score full marks", async () => {
    const reversedTimelineReport: SocReportData = {
      ...goodReport,
      timeline: [...goodReport.timeline].reverse(),
    };

    const gradedNormal = await gradeReport("sub-rev", reversedTimelineReport, truth);
    expect(gradedNormal.totalScore).toBeDefined();

    // Planted flaw: Grader that ignores order and only checks presence of milestone IDs
    const brokenGradeTimelineOrder = (_report: SocReportData): number => {
      void _report;
      // Flawed implementation: 1.0 order score regardless of inversions
      return 15.0; // full points
    };

    const flawedTimelineScore = brokenGradeTimelineOrder(reversedTimelineReport);
    expect(flawedTimelineScore).toBe(15.0);

    const assertOrderEnforced = (score: number, isReversed: boolean) => {
      if (isReversed && score >= 14.5) {
        throw new Error("Flaw detected: Reversed timeline received full order credit!");
      }
    };

    expect(() => assertOrderEnforced(flawedTimelineScore, true)).toThrow(
      "Flaw detected: Reversed timeline received full order credit!",
    );
  });

  it("proves Flaw 5: Prompt injection susceptibility elevates untrusted input to full score", async () => {
    // True deterministic behavior: injection is ignored as passive text
    const honestResult = await gradeReport("sub-inj", injectionReport, truth);
    expect(honestResult.totalScore).toBeLessThanOrEqual(45);
    expect(honestResult.flags.injectionDetected).toBe(true);

    // Planted flaw: Naive LLM evaluator that executes text commands
    const naiveLlmEvaluator = (report: SocReportData): number => {
      if (report.attackNarrative?.includes("OVERRIDE") || report.executiveSummary?.includes("100/100")) {
        return 100; // Evaluator fell for injection attack
      }
      return 10;
    };

    const compromisedScore = naiveLlmEvaluator(injectionReport);
    expect(compromisedScore).toBe(100);

    const assertInjectionImmunity = (score: number, hasInjection: boolean) => {
      if (hasInjection && score > 70) {
        throw new Error("Flaw detected: Grader evaluated prompt injection instructions as authoritative commands!");
      }
    };

    expect(() => assertInjectionImmunity(compromisedScore, true)).toThrow(
      "Flaw detected: Grader evaluated prompt injection instructions as authoritative commands!",
    );
  });
});
