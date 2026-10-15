import { describe, expect, it } from "vitest";
import { buildExamResult, handoffChecks, type ExamResultInput } from "@/lib/lab-engine/soc/exam/results";
import { loadExamConfig } from "@/lib/lab-engine/soc/exam/config";
import type { SocEvaluationResult, AlertEvaluation, SocDecisionRecord } from "@/lib/lab-engine/soc/types";
import type { GradingResult } from "@/lib/lab-engine/soc/reports/types";
import type { SocExamAttemptRecord } from "@/lib/lab-engine/soc/exam/types";

const START = "2026-10-15T10:00:00.000Z";
const at = (sec: number) => new Date(Date.parse(START) + sec * 1000).toISOString();

const exam = (format: SocExamAttemptRecord["format"], minutes: number): SocExamAttemptRecord => ({
  id: "e1", userId: "u", format, configVersion: 1, variantId: "shift-quiet-day", socAttemptId: "s1", seed: "seed", itemIds: [], status: "active", submitReason: null,
  startedAt: START, deadlineAt: at(minutes * 60), timeMultiplier: 1, submittedAt: null, result: null,
});

const alert = (alertId: string, ok: boolean, learnerEscalate: boolean | null, correctEscalate: boolean, disp: AlertEvaluation["correctDisposition"] = "true_positive"): AlertEvaluation => ({
  alertId, isCorrect: ok, learnerDisposition: learnerEscalate === null ? null : ok ? disp : "duplicate", correctDisposition: disp,
  learnerSeverity: null, correctSeverity: "HIGH", learnerEscalate, correctEscalate, pointsEarned: ok ? 10 : 0, maxPoints: 10,
});

function evaluation(alerts: AlertEvaluation[]): SocEvaluationResult {
  const earned = alerts.reduce((a, x) => a + x.pointsEarned, 0);
  return {
    attemptId: "s1", scenarioId: "exam-e1", totalScore: earned, maxScore: alerts.length * 10, percentage: Math.round((earned / (alerts.length * 10)) * 100), passed: false,
    alertsTotal: alerts.length, alertsDecided: alerts.filter((a) => a.learnerDisposition).length, truePositivesFound: 0, truePositivesTotal: 0,
    falsePositivesHandled: 1, falsePositivesTotal: 2, overEscalatedCount: 1, underEscalatedCount: 1, incidents: [], skills: [], alertResults: alerts, overallDebrief: "x", submittedAt: at(600),
  };
}

const dec = (alertId: string, sec: number, escalate = false): SocDecisionRecord =>
  ({ id: `d-${alertId}`, attemptId: "s1", alertId, disposition: "true_positive", severity: "HIGH", escalate, targetTier: null, rationale: "r", evidenceRefs: [], createdAt: at(sec) }) as SocDecisionRecord;

function base(over: Partial<ExamResultInput>): ExamResultInput {
  const config = loadExamConfig().formats["alert-queue"];
  return {
    exam: exam("alert-queue", 75), config, submittedAt: at(1800), submitReason: "learner", evaluation: null, alertSources: {}, alertIds: [], decisions: [],
    activity: { queries: [], lookups: [], questionAnswers: [] }, questionsTotal: null, report: null, reportState: "not_applicable", handoffText: null, knowledge: null, ...over,
  };
}

describe("exam results on fixtures", () => {
  const alerts = [alert("a1", true, true, true), alert("a2", true, false, false, "false_positive"), alert("a3", false, true, false), alert("a4", false, false, true)];
  const input = base({
    evaluation: evaluation(alerts),
    alertSources: { a1: "EDR", a2: "Authentication", a3: "EDR", a4: "Email Gateway" },
    alertIds: ["a1", "a2", "a3", "a4"],
    decisions: [dec("a1", 60, true), dec("a2", 150), dec("a3", 200, true), dec("a4", 1500)],
    activity: {
      queries: [at(30), at(100)],
      lookups: [{ at: at(40), entity: "1.2.3.4" }, { at: at(45), entity: "1.2.3.4" }, { at: at(50), entity: "evil.example" }],
      questionAnswers: [{ at: at(300), questionId: "q1", isCorrect: false }, { at: at(320), questionId: "q1", isCorrect: true }, { at: at(330), questionId: "q2", isCorrect: false }],
    },
    questionsTotal: 4,
    handoffText: "Escalated a1 as HIGH. Next: monitor the host. ".repeat(4),
  });
  const r = buildExamResult(input);

  it("computes decision quality", () => {
    expect(r.decisionQuality).toEqual({ alertsTotal: 4, alertsDecided: 4, correctDispositions: 2, overEscalations: 1, underEscalations: 1, falsePositivesHandled: 1, falsePositivesTotal: 2 });
  });

  it("weights components and counts the latest question answer", () => {
    expect(r.components.map((c) => [c.id, c.percent, c.graded])).toEqual([["decisions", 50, true], ["questions", 25, true], ["handoff", 100, true]]);
    expect(r.scorePercent).toBe(Math.round(50 * 0.6 + 25 * 0.25 + 100 * 0.15));
  });

  it("breaks skills down by alert source plus triage and escalation", () => {
    const s = Object.fromEntries(r.perSkill.map((x) => [x.skill, x.percent]));
    expect(s.soc_endpoint_triage).toBe(50);
    expect(s.soc_credential_attacks).toBe(100);
    expect(s.soc_phishing_analysis).toBe(0);
    expect(s.soc_alert_triage).toBe(50);
    expect(s.soc_siem_correlation).toBe(25);
  });

  it("analyses time: median per alert, idle gap, first containment, within budget", () => {
    expect(r.timeAnalysis).toEqual({ durationSeconds: 1800, budgetSeconds: 4500, withinBudget: true, medianSecondsPerAlert: 75, longestIdleGapSeconds: 1170, timeToFirstContainmentSeconds: 60 });
  });

  it("measures thoroughness from logs", () => {
    expect(r.thoroughness).toEqual({ queries: 2, lookups: 3, distinctEntitiesLookedUp: 2, questionsAnswered: 2, questionsTotal: 4 });
    expect(r.budgetsUsed).toEqual({ queries: { used: 2, limit: 40 }, lookups: { used: 3, limit: 30 }, questionAnswers: { used: 3, limit: 20 } });
  });

  it("raises informational integrity flags without touching the score", () => {
    const rapid = base({ ...input, decisions: ["a1", "a2", "a3", "a4", "a5", "a6"].map((id, i) => dec(id, 10 + i * 2)), submitReason: "deadline", submittedAt: at(4600) });
    const out = buildExamResult(rapid);
    expect(out.integrityFlags.map((f) => f.code).sort()).toEqual(["auto_submitted", "idle_majority", "rapid_decisions"]);
    expect(out.timeAnalysis.withinBudget).toBe(false);
    expect(out.timeAnalysis.durationSeconds).toBe(4500);
    expect(out.scorePercent).toBe(buildExamResult({ ...rapid, submitReason: "learner", submittedAt: at(4400) }).scorePercent);
  });

  it("marks questions not graded when search is off and shares their weight", () => {
    const off = buildExamResult({ ...input, questionsTotal: null });
    expect(off.components.find((c) => c.id === "questions")).toMatchObject({ graded: false });
    expect(off.scorePercent).toBe(Math.round((50 * 0.6 + 100 * 0.15) / 0.75));
  });

  it("reports graded and not-graded report criteria separately", () => {
    const config = loadExamConfig().formats.investigation;
    const report = {
      totalScore: 30, maxScore: 60, availableGradedPoints: 40, earnedGradedPoints: 30, isFullyGraded: false,
      criterionResults: {
        timeline: { criterionId: "timeline", score: 20, maxScore: 20, weight: 1, status: "graded", feedback: "", teachingPointers: [], annotations: [], missedItems: [], flags: [] },
        iocs: { criterionId: "iocs", score: 10, maxScore: 20, weight: 1, status: "graded", feedback: "", teachingPointers: [], annotations: [], missedItems: [], flags: [] },
        narrative: { criterionId: "narrative", score: 0, maxScore: 20, weight: 1, status: "not_available", feedback: "", teachingPointers: [], annotations: [], missedItems: [], flags: [] },
      },
    } as unknown as GradingResult;
    const out = buildExamResult({ ...input, exam: exam("investigation", 150), config, report, reportState: "graded", handoffText: null });
    expect(out.report).toEqual({
      totalPercent: 75,
      criteria: [
        { id: "timeline", label: "timeline", status: "graded", percent: 100, note: undefined },
        { id: "iocs", label: "iocs", status: "graded", percent: 50, note: undefined },
        { id: "narrative", label: "narrative", status: "not_graded", percent: null, note: expect.stringContaining("Not graded") },
      ],
    });
    expect(out.components.map((c) => c.id)).toEqual(["decisions", "questions", "report"]);
  });

  it("handoff completeness checks are deterministic", () => {
    expect(handoffChecks("", ["a1"]).every((c) => !c.met)).toBe(true);
    expect(handoffChecks(`A1 closed as benign. Pending: follow-up with the owner. ${"x".repeat(150)}`, ["a1"]).every((c) => c.met)).toBe(true);
  });
});
