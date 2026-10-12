import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socScenarioSchema, type SocScenario } from "@/lib/lab-engine/soc/schema";
import { evaluateSocAttempt } from "@/lib/lab-engine/soc/evaluator";
import type { SocDecisionRecord, SocCaseRecord } from "@/lib/lab-engine/soc/types";

function loadDemoScenario(): SocScenario {
  const filePath = path.resolve("content/soc/scenarios/soc-l1-noisy-shift.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  return socScenarioSchema.parse(parseYaml(raw));
}

describe("SOC Evaluator (server-authoritative scoring)", () => {
  const scenario = loadDemoScenario();
  const attemptId = "attempt-eval-001";
  const now = new Date().toISOString();

  it("scores high percentage on a perfect analyst run", () => {
    // Generate perfect decisions based on groundTruth
    const decisions: SocDecisionRecord[] = scenario.alerts.map((alert) => {
      const gt = alert.groundTruth!;
      return {
        id: `dec-${alert.id}`,
        attemptId,
        alertId: alert.id,
        disposition: gt.correctDisposition,
        severity: gt.correctSeverity,
        escalate: gt.correctEscalation,
        targetTier: gt.correctEscalation ? "tier2" : null,
        rationale: "Comprehensive evidence-based triage rationale.",
        evidenceRefs: [alert.id],
        createdAt: now,
      };
    });

    // Group alerts into matching cases for real incidents
    const cases: SocCaseRecord[] = (scenario.groundTruth?.incidents ?? []).map((inc) => ({
      id: `case-${inc.id}`,
      attemptId,
      title: inc.title,
      severity: "HIGH",
      status: "escalated",
      notes: "Incident investigation case notes.",
      alertIds: inc.truePositiveAlertIds,
      createdAt: now,
      updatedAt: now,
    }));

    const result = evaluateSocAttempt(attemptId, scenario, decisions, cases, now);

    expect(result.passed).toBe(true);
    expect(result.percentage).toBeGreaterThanOrEqual(95);
    expect(result.incidents.filter((i) => i.detected).length).toBe(3);
    expect(result.overEscalatedCount).toBe(0);
    expect(result.underEscalatedCount).toBe(0);

    // All triaged alerts must have debrief populated
    for (const item of result.alertResults) {
      expect(item.debrief).toBeDefined();
      expect(item.debrief?.length).toBeGreaterThan(0);
    }
  });

  it("penalizes and fails an all-escalate 'alarmist' run", () => {
    // Escalate everything as CRITICAL true_positive
    const decisions: SocDecisionRecord[] = scenario.alerts.map((alert) => ({
      id: `dec-${alert.id}`,
      attemptId,
      alertId: alert.id,
      disposition: "true_positive",
      severity: "CRITICAL",
      escalate: true,
      targetTier: "incident_response",
      rationale: "Escalating everything immediately.",
      evidenceRefs: [],
      createdAt: now,
    }));

    const result = evaluateSocAttempt(attemptId, scenario, decisions, [], now);

    expect(result.passed).toBe(false);
    expect(result.overEscalatedCount).toBeGreaterThan(25);
    expect(result.percentage).toBeLessThan(50);
  });

  it("penalizes and fails an all-dismiss 'negligent' run", () => {
    // Dismiss everything as false_positive with no escalation
    const decisions: SocDecisionRecord[] = scenario.alerts.map((alert) => ({
      id: `dec-${alert.id}`,
      attemptId,
      alertId: alert.id,
      disposition: "false_positive",
      severity: "LOW",
      escalate: false,
      targetTier: null,
      rationale: "Ignoring all alerts as noise.",
      evidenceRefs: [],
      createdAt: now,
    }));

    const result = evaluateSocAttempt(attemptId, scenario, decisions, [], now);

    expect(result.passed).toBe(false);
    expect(result.underEscalatedCount).toBeGreaterThan(5);
    expect(result.incidents.filter((i) => i.detected).length).toBe(0);
  });

  it("NEVER exposes debrief answers for unworked alerts (Anti-Cheat Invariant)", () => {
    // Learner triaged only 2 alerts
    const triagedAlertIds = [scenario.alerts[0].id, scenario.alerts[1].id];
    const decisions: SocDecisionRecord[] = triagedAlertIds.map((alertId) => ({
      id: `dec-${alertId}`,
      attemptId,
      alertId,
      disposition: "false_positive",
      severity: "LOW",
      escalate: false,
      targetTier: null,
      rationale: "Normal false positive traffic.",
      evidenceRefs: [],
      createdAt: now,
    }));

    const result = evaluateSocAttempt(attemptId, scenario, decisions, [], now);

    for (const item of result.alertResults) {
      if (triagedAlertIds.includes(item.alertId)) {
        // Triaged alerts receive debrief explanation
        expect(item.debrief).toBeDefined();
      } else {
        // Untriaged alerts MUST NOT reveal debrief or answers
        expect(item.debrief).toBeUndefined();
        expect(item.learnerDisposition).toBeNull();
      }
    }
  });

  it("rewards acceptable alternative dispositions on ambiguous alerts", () => {
    // Ambiguous alt-015 allows benign_true_positive or false_positive
    const altDecision: SocDecisionRecord = {
      id: "dec-alt-015",
      attemptId,
      alertId: "alt-015",
      disposition: "false_positive", // Primary is benign_true_positive, alternative is false_positive
      severity: "LOW",
      escalate: false,
      targetTier: null,
      rationale: "Could be seen as FP or authorized BTP backup.",
      evidenceRefs: [],
      createdAt: now,
    };

    const result = evaluateSocAttempt(attemptId, scenario, [altDecision], [], now);
    const item = result.alertResults.find((d) => d.alertId === "alt-015");
    expect(item).toBeDefined();
    expect(item?.isCorrect).toBe(true);
    expect(item?.acceptableAlternativeMatched).toBe(true);
  });
});
