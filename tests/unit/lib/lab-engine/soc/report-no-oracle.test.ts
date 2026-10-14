import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { lintReportDraft } from "@/lib/lab-engine/soc/reports/pre-submit-lint";
import { getReportTemplate } from "@/lib/lab-engine/soc/reports/templates";
import { generateFixtureReport } from "@/lib/lab-engine/soc/reports/fixtures";
import type { SocReportData, SocDisposition } from "@/lib/lab-engine/soc/reports/types";

describe("SOC Report Pre-Submit Lint: No-Oracle Statistical Integrity", () => {
  const raw = fs.readFileSync("content/soc/families/soc-f-phishing-cred-01.yaml", "utf8");
  const family = socFamilySchema.parse(parseYaml(raw)) as SocFamily;
  const gen = generateSocVariant(family, "proof-seed-soc-f-phishing-cred-01-1", "intermediate");
  const truth = gen.scenario.groundTruth.incidents[0].reportGroundTruth!;
  let template: Awaited<ReturnType<typeof getReportTemplate>>;

  const baseReport = generateFixtureReport(truth, "good");

  it("proves disposition changes never alter pre-submit lint output (zero correctness oracle)", async () => {
    template = await getReportTemplate("incident-report-l1");
    const testDispositions: SocDisposition[] = [
      "true_positive",
      "false_positive",
      "benign_true_positive",
      "duplicate",
      "needs_more_info",
    ];

    const lintOutputs = testDispositions.map((disp) => {
      const draft: SocReportData = {
        ...baseReport,
        verdict: {
          ...baseReport.verdict,
          disposition: disp,
        },
      };
      return lintReportDraft(draft, template);
    });

    // 1. Every disposition variant must produce the exact same error and warning counts
    const baseErrors = lintOutputs[0].errors.length;
    const baseWarnings = lintOutputs[0].warnings.length;

    for (let i = 1; i < lintOutputs.length; i++) {
      expect(
        lintOutputs[i].errors.length,
        `Disposition '${testDispositions[i]}' produced different error count than '${testDispositions[0]}'`,
      ).toBe(baseErrors);

      expect(
        lintOutputs[i].warnings.length,
        `Disposition '${testDispositions[i]}' produced different warning count than '${testDispositions[0]}'`,
      ).toBe(baseWarnings);
    }

    // 2. Lint output messages must never leak whether the disposition is correct
    for (const out of lintOutputs) {
      const allText = JSON.stringify(out).toLowerCase();
      expect(allText).not.toContain("correct disposition");
      expect(allText).not.toContain("expected disposition");
      expect(allText).not.toContain("ground truth");
    }
  });

  it("proves true-positive IoCs vs fabricated IoCs produce identical lint feedback", () => {
    // Report A: Real ground-truth IoC
    const realIoc = truth.iocs.find((i) => i.isTruePositive)!;
    const reportReal: SocReportData = {
      ...baseReport,
      iocs: [
        {
          id: "ioc-1",
          type: realIoc.type,
          value: realIoc.value,
          role: realIoc.role,
          evidenceRefs: [],
        },
      ],
    };

    // Report B: Completely fabricated IoC with same syntax
    const reportFake: SocReportData = {
      ...baseReport,
      iocs: [
        {
          id: "ioc-1",
          type: realIoc.type,
          value: "198.51.100.99",
          role: realIoc.role,
          evidenceRefs: [],
        },
      ],
    };

    const lintReal = lintReportDraft(reportReal, template);
    const lintFake = lintReportDraft(reportFake, template);

    expect(lintReal.errors.length).toBe(lintFake.errors.length);
    expect(lintReal.warnings.length).toBe(lintFake.warnings.length);

    // Neither should leak whether the indicator was actually present in telemetry
    const serializedReal = JSON.stringify(lintReal);
    const serializedFake = JSON.stringify(lintFake);
    expect(serializedReal).not.toContain("not observed");
    expect(serializedFake).not.toContain("not observed");
    expect(serializedReal).not.toContain("hallucinated");
    expect(serializedFake).not.toContain("hallucinated");
  });

  it("proves lint response timings are statistically indistinguishable across claim correctness", () => {
    const N = 50;
    const timingsCorrect: number[] = [];
    const timingsIncorrect: number[] = [];

    const correctReport = generateFixtureReport(truth, "excellent");
    const incorrectReport = generateFixtureReport(truth, "poor");

    // Warm-up JIT
    for (let i = 0; i < 10; i++) {
      lintReportDraft(correctReport, template);
      lintReportDraft(incorrectReport, template);
    }

    // Interleaved timing measurements
    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      lintReportDraft(correctReport, template);
      timingsCorrect.push(performance.now() - t0);

      const t1 = performance.now();
      lintReportDraft(incorrectReport, template);
      timingsIncorrect.push(performance.now() - t1);
    }

    const meanCorrect = timingsCorrect.reduce((a, b) => a + b, 0) / N;
    const meanIncorrect = timingsIncorrect.reduce((a, b) => a + b, 0) / N;

    // Both must complete in sub-millisecond or low single-digit millisecond time
    expect(meanCorrect).toBeLessThan(10); // < 10ms
    expect(meanIncorrect).toBeLessThan(10); // < 10ms

    // Timing difference must be negligible (< 1.5ms diff)
    const diff = Math.abs(meanCorrect - meanIncorrect);
    expect(diff).toBeLessThan(1.5);
  });

  it("proves error shapes conform to strict validation contracts with zero ground-truth leakage", () => {
    const brokenDraft: SocReportData = {
      header: {
        title: "",
        caseId: "",
        analystHandle: "",
        createdAt: "",
        classification: "",
      },
      executiveSummary: "[Enter executive summary here]",
      verdict: {
        disposition: "needs_more_info",
        severity: "LOW",
        confidence: "low",
        justification: "",
      },
      scope: {
        affectedAssets: [],
        affectedUsers: [],
      },
      timeline: [],
      iocs: [],
      techniques: [],
      actions: [],
      attackNarrative: "",
      escalation: {
        requiresEscalation: false,
        urgency: "routine",
        handoffSummary: "",
      },
    };

    const lintResult = lintReportDraft(brokenDraft, template);
    expect(lintResult.valid).toBe(false);
    expect(lintResult.errors.length).toBeGreaterThan(0);

    for (const err of lintResult.errors) {
      // Contract check
      expect(err).toHaveProperty("sectionId");
      expect(err).toHaveProperty("message");

      // Ground truth secrecy check
      expect(err.message).not.toContain(truth.verdict.correctDisposition);
      for (const asset of truth.scope.affectedAssets) {
        expect(err.message).not.toContain(asset);
      }
    }
  });
});
