/**
 * Pure exam result builder: turns what the exam service gathered at submission into the stored
 * SocExamResult. No I/O, so it is tested on fixtures. Components that could not be graded are
 * shown as "not graded" and their weight is shared across the graded ones.
 */
import type { SocEvaluationResult, SocDecisionRecord } from "../types";
import type { SocAlertSource } from "../schema";
import type { GradingResult } from "../reports/types";
import type { IntegrityFlag, SkillScore, SocExamAttemptRecord, SocExamResult } from "./types";
import type { SocExamFormatConfig } from "./config";
import type { KnowledgeItem } from "./knowledge";

export const SOURCE_SKILL: Record<SocAlertSource, string> = {
  EDR: "soc_endpoint_triage",
  "Network IDS": "soc_network_traffic",
  "Email Gateway": "soc_phishing_analysis",
  Firewall: "soc_network_indicators",
  Authentication: "soc_credential_attacks",
  "Cloud Audit": "soc_cloud_identity",
};

export const COMPONENT_LABEL: Record<string, string> = {
  decisions: "Triage decisions",
  questions: "Investigation questions",
  handoff: "Handoff note",
  report: "Incident report",
  items: "Knowledge items",
};

export type ExamResultInput = {
  exam: SocExamAttemptRecord;
  config: SocExamFormatConfig;
  submittedAt: string;
  submitReason: "learner" | "deadline";
  /** Scenario formats only. */
  evaluation: SocEvaluationResult | null;
  alertSources: Record<string, SocAlertSource>;
  alertIds: string[];
  decisions: SocDecisionRecord[];
  activity: { queries: string[]; lookups: Array<{ at: string; entity: string }>; questionAnswers: Array<{ at: string; questionId: string; isCorrect: boolean }> };
  /** null when searching and questions were switched off for this exam. */
  questionsTotal: number | null;
  report: GradingResult | null;
  /** "absent": an investigation exam submitted without a report draft. */
  reportState: "graded" | "absent" | "not_applicable";
  handoffText: string | null;
  knowledge: Array<{ item: KnowledgeItem; correct: boolean; answeredAt: string | null }> | null;
};

const pct = (earned: number, possible: number) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);
const secs = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000));

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Deterministic handoff completeness check (not a quality judgement): length, names at least
 * one alert, states a next step, and states an outcome or severity.
 */
export function handoffChecks(text: string | null, alertIds: string[]) {
  const t = (text ?? "").trim();
  const lower = t.toLowerCase();
  return [
    { id: "length", label: "At least 150 characters", met: t.length >= 150 },
    { id: "alerts", label: "Names at least one alert ID", met: alertIds.some((id) => lower.includes(id.toLowerCase())) },
    { id: "next_step", label: "States a next step or open item", met: /\b(next|pending|open|follow[- ]?up|monitor|waiting|todo|to do)\b/.test(lower) },
    { id: "outcome", label: "States an outcome or severity", met: /\b(escalat\w*|closed|false positive|benign|true positive|critical|high|medium|low)\b/.test(lower) },
  ];
}

function addSkill(map: Map<string, { earned: number; possible: number }>, skill: string, earned: number, possible: number) {
  const s = map.get(skill) ?? { earned: 0, possible: 0 };
  s.earned += earned;
  s.possible += possible;
  map.set(skill, s);
}

export function buildExamResult(input: ExamResultInput): SocExamResult {
  const { exam, config, evaluation } = input;
  const skills = new Map<string, { earned: number; possible: number }>();
  const components: SocExamResult["components"] = [];
  const weight = (id: string) => config.weights[id] ?? 0;

  // Decisions
  let decisionQuality: SocExamResult["decisionQuality"] = null;
  if (evaluation) {
    for (const a of evaluation.alertResults) {
      const source = input.alertSources[a.alertId];
      if (source) addSkill(skills, SOURCE_SKILL[source], a.pointsEarned, a.maxPoints);
      addSkill(skills, "soc_alert_triage", a.pointsEarned, a.maxPoints);
      addSkill(skills, "soc_escalation_handoff", a.learnerEscalate !== null && a.learnerEscalate === a.correctEscalate ? 1 : 0, 1);
    }
    decisionQuality = {
      alertsTotal: evaluation.alertsTotal,
      alertsDecided: evaluation.alertsDecided,
      correctDispositions: evaluation.alertResults.filter((a) => a.learnerDisposition !== null && (a.learnerDisposition === a.correctDisposition || a.acceptableAlternativeMatched)).length,
      overEscalations: evaluation.overEscalatedCount,
      underEscalations: evaluation.underEscalatedCount,
      falsePositivesHandled: evaluation.falsePositivesHandled,
      falsePositivesTotal: evaluation.falsePositivesTotal,
    };
    components.push({ id: "decisions", label: COMPONENT_LABEL.decisions, percent: evaluation.percentage, weight: weight("decisions"), graded: true });
  }

  // Investigation questions: the latest answer per question counts.
  let questionsAnswered = 0;
  if ("questions" in config.weights) {
    const latest = new Map<string, boolean>();
    for (const q of [...input.activity.questionAnswers].sort((a, b) => a.at.localeCompare(b.at))) latest.set(q.questionId, q.isCorrect);
    questionsAnswered = latest.size;
    if (input.questionsTotal === null || input.questionsTotal === 0) {
      components.push({ id: "questions", label: COMPONENT_LABEL.questions, percent: 0, weight: weight("questions"), graded: false, note: "Searching and questions were switched off for this exam." });
    } else {
      const correct = [...latest.values()].filter(Boolean).length;
      addSkill(skills, "soc_siem_correlation", correct, input.questionsTotal);
      components.push({ id: "questions", label: COMPONENT_LABEL.questions, percent: pct(correct, input.questionsTotal), weight: weight("questions"), graded: true });
    }
  }

  // Handoff note (alert queue)
  if ("handoff" in config.weights) {
    const checks = handoffChecks(input.handoffText, input.alertIds);
    const met = checks.filter((c) => c.met).length;
    addSkill(skills, "soc_escalation_handoff", met, checks.length);
    components.push({ id: "handoff", label: COMPONENT_LABEL.handoff, percent: pct(met, checks.length), weight: weight("handoff"), graded: true, note: "Completeness check only: " + checks.map((c) => `${c.met ? "met" : "not met"}: ${c.label}`).join("; ") });
  }

  // Incident report (investigation)
  let report: SocExamResult["report"] = null;
  if ("report" in config.weights) {
    if (input.report) {
      const criteria = Object.entries(input.report.criterionResults).map(([id, c]) => ({
        id,
        label: id.replace(/[_-]/g, " "),
        status: c.status === "graded" ? ("graded" as const) : ("not_graded" as const),
        percent: c.status === "graded" ? pct(c.score, c.maxScore) : null,
        note: c.status === "graded" ? undefined : "Not graded: this criterion needs a grader that is not switched on.",
      }));
      const totalPercent = pct(input.report.earnedGradedPoints, input.report.availableGradedPoints);
      report = { totalPercent, criteria };
      addSkill(skills, "soc_documentation", input.report.earnedGradedPoints, input.report.availableGradedPoints);
      components.push({ id: "report", label: COMPONENT_LABEL.report, percent: totalPercent, weight: weight("report"), graded: true, note: input.report.isFullyGraded ? undefined : "Some criteria are not graded; the percentage covers graded criteria only." });
    } else {
      addSkill(skills, "soc_documentation", 0, 1);
      components.push({ id: "report", label: COMPONENT_LABEL.report, percent: 0, weight: weight("report"), graded: true, note: "No report was written before submission." });
    }
  }

  // Knowledge items
  let knowledge: SocExamResult["knowledge"] = null;
  if (input.knowledge) {
    const byType: Record<string, { correct: number; total: number }> = {};
    for (const k of input.knowledge) {
      addSkill(skills, k.item.skill, k.correct ? 1 : 0, 1);
      const t = (byType[k.item.type] ??= { correct: 0, total: 0 });
      t.total += 1;
      if (k.correct) t.correct += 1;
    }
    const correct = input.knowledge.filter((k) => k.correct).length;
    knowledge = { correct, total: input.knowledge.length, byType };
    components.push({ id: "items", label: COMPONENT_LABEL.items, percent: pct(correct, input.knowledge.length), weight: weight("items"), graded: true });
  }

  const graded = components.filter((c) => c.graded && c.weight > 0);
  const totalWeight = graded.reduce((a, c) => a + c.weight, 0);
  const scorePercent = totalWeight > 0 ? Math.round(graded.reduce((a, c) => a + c.percent * c.weight, 0) / totalWeight) : 0;

  // Time analysis
  const budgetSeconds = secs(exam.startedAt, exam.deadlineAt);
  const end = Date.parse(input.submittedAt) < Date.parse(exam.deadlineAt) ? input.submittedAt : exam.deadlineAt;
  const durationSeconds = secs(exam.startedAt, end);
  const firstDecision = new Map<string, string>();
  for (const d of [...input.decisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (!firstDecision.has(d.alertId)) firstDecision.set(d.alertId, d.createdAt);
  const decisionTimes = [...firstDecision.values()].sort();
  const perAlert = decisionTimes.map((t, i) => secs(i === 0 ? exam.startedAt : decisionTimes[i - 1], t));
  const activityTimes = [
    exam.startedAt,
    ...input.decisions.map((d) => d.createdAt),
    ...input.activity.queries,
    ...input.activity.lookups.map((l) => l.at),
    ...input.activity.questionAnswers.map((q) => q.at),
    ...(input.knowledge ?? []).flatMap((k) => (k.answeredAt ? [k.answeredAt] : [])),
    end,
  ]
    .filter((t) => Date.parse(t) <= Date.parse(end))
    .sort();
  let longestIdleGapSeconds = 0;
  let idleSeconds = 0;
  for (let i = 1; i < activityTimes.length; i++) {
    const gap = secs(activityTimes[i - 1], activityTimes[i]);
    longestIdleGapSeconds = Math.max(longestIdleGapSeconds, gap);
    if (gap >= 300) idleSeconds += gap;
  }
  const firstContainment = input.decisions.filter((d) => d.escalate).map((d) => d.createdAt).sort()[0];
  const timeAnalysis: SocExamResult["timeAnalysis"] = {
    durationSeconds,
    budgetSeconds,
    withinBudget: input.submitReason === "learner" && Date.parse(input.submittedAt) <= Date.parse(exam.deadlineAt),
    medianSecondsPerAlert: median(perAlert),
    longestIdleGapSeconds,
    timeToFirstContainmentSeconds: firstContainment ? secs(exam.startedAt, firstContainment) : null,
  };

  // Budgets
  const budgetsUsed: SocExamResult["budgetsUsed"] = {};
  const used = { queries: input.activity.queries.length, lookups: input.activity.lookups.length, questionAnswers: input.activity.questionAnswers.length };
  for (const [kind, limit] of Object.entries(config.budgets)) if (limit !== undefined) budgetsUsed[kind] = { used: used[kind as keyof typeof used], limit };

  // Integrity flags (informational only; they never change the score)
  const integrityFlags: IntegrityFlag[] = [];
  const fast = perAlert.slice(1).filter((s) => s < 5).length;
  if (perAlert.length >= 5 && fast > perAlert.length / 2) integrityFlags.push({ code: "rapid_decisions", detail: `${fast} of ${perAlert.length} alerts were decided less than 5 seconds after the previous one.` });
  for (const [kind, b] of Object.entries(budgetsUsed)) if (b.limit > 0 && b.used >= b.limit) integrityFlags.push({ code: "budget_exhausted", detail: `All ${b.limit} ${kind === "questionAnswers" ? "question answers" : kind} were used.` });
  if (input.submitReason === "deadline") integrityFlags.push({ code: "auto_submitted", detail: "The exam was submitted automatically when time ran out." });
  if (durationSeconds > 0 && idleSeconds > durationSeconds / 2) integrityFlags.push({ code: "idle_majority", detail: `More than half of the time (${Math.round(idleSeconds / 60)} min) had no activity for 5 minutes or longer.` });

  const thoroughness: SocExamResult["thoroughness"] = evaluation
    ? {
        queries: used.queries,
        lookups: used.lookups,
        distinctEntitiesLookedUp: new Set(input.activity.lookups.map((l) => l.entity.toLowerCase())).size,
        questionsAnswered,
        questionsTotal: input.questionsTotal ?? 0,
      }
    : null;

  const perSkill: SkillScore[] = [...skills.entries()]
    .map(([skill, s]) => ({ skill, earned: s.earned, possible: s.possible, percent: pct(s.earned, s.possible) }))
    .sort((a, b) => a.skill.localeCompare(b.skill));

  return {
    format: exam.format,
    variantId: exam.variantId,
    scorePercent,
    components,
    perSkill,
    decisionQuality,
    timeAnalysis,
    thoroughness,
    report,
    knowledge,
    integrityFlags,
    budgetsUsed,
    submitReason: input.submitReason,
  };
}
