/**
 * Provisional readiness gate (pure, table-tested). Looks at the learner's most recent submitted
 * exams that count for readiness and reports every unmet criterion by name. It never claims a
 * pass: the only positive wording is READINESS_STATEMENT, exactly.
 */
import type { ReadinessConfig } from "./config";
import type { SocExamAttemptRecord } from "./types";
import { skillAverages } from "./study-plan";

export const READINESS_STATEMENT = "Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam.";

export type ReadinessState = "not_ready" | "close" | "ready";

export type ReadinessCriterion = {
  id: "attempts" | "formats" | "variants" | "overall" | "skill_floor" | "report" | "time" | "integrity";
  label: string;
  /** Met at the "ready" level. */
  met: boolean;
  /** Met at the "close" level (identical to met for criteria without levels). */
  metForClose: boolean;
  detail: string;
};

export type ReadinessResult = {
  provisional: true;
  state: ReadinessState;
  statement: string | null;
  criteria: ReadinessCriterion[];
  unmet: ReadinessCriterion[];
  examIds: string[];
};

export function evaluateReadiness(allExams: SocExamAttemptRecord[], counts: (format: string) => boolean, cfg: ReadinessConfig): ReadinessResult {
  const recent = allExams
    .filter((e) => e.status === "submitted" && e.result && e.submittedAt && counts(e.format))
    .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
    .slice(0, cfg.windowAttempts);

  const formats = new Set(recent.map((e) => e.format));
  // Distinct scenarios (shift or family) across scenario-based exams; knowledge draws are not variants.
  const variants = new Set(recent.filter((e) => !e.format.startsWith("knowledge")).map((e) => e.variantId));
  const overall = recent.length ? Math.round(recent.reduce((a, e) => a + e.result!.scorePercent, 0) / recent.length) : 0;
  const skills = skillAverages(recent);
  const lowest = [...skills].sort((a, b) => a[1] - b[1])[0];
  const reports = recent.filter((e) => e.result!.report);
  const reportAvg = reports.length ? Math.round(reports.reduce((a, e) => a + e.result!.report!.totalPercent, 0) / reports.length) : null;
  const overTime = recent.filter((e) => !e.result!.timeAnalysis.withinBudget);
  const flagged = recent.filter((e) => e.result!.integrityFlags.length > 0);

  const enough = recent.length >= cfg.windowAttempts;
  const crit: ReadinessCriterion[] = [
    { id: "attempts", label: `${cfg.windowAttempts} recent exam attempts`, met: enough, metForClose: recent.length >= Math.min(2, cfg.windowAttempts), detail: `${recent.length} of ${cfg.windowAttempts} counted exams submitted.` },
    { id: "formats", label: `At least ${cfg.minFormats} exam formats`, met: formats.size >= cfg.minFormats, metForClose: formats.size >= cfg.minFormats, detail: `${formats.size} format(s) in your recent attempts.` },
    { id: "variants", label: `At least ${cfg.minVariants} different scenarios`, met: variants.size >= cfg.minVariants, metForClose: variants.size >= cfg.minVariants, detail: `${variants.size} different scenario(s) in alert-queue and investigation exams.` },
    { id: "overall", label: `Average score at least ${cfg.ready.overall}%`, met: recent.length > 0 && overall >= cfg.ready.overall, metForClose: recent.length > 0 && overall >= cfg.close.overall, detail: `Average ${overall}% (close needs ${cfg.close.overall}%).` },
    {
      id: "skill_floor",
      label: `Every skill at least ${cfg.ready.skillFloor}%`,
      met: !!lowest && lowest[1] >= cfg.ready.skillFloor,
      metForClose: !!lowest && lowest[1] >= cfg.close.skillFloor,
      detail: lowest ? `Lowest skill: ${lowest[0]} at ${lowest[1]}%.` : "No skill scores yet.",
    },
    {
      id: "report",
      label: `Report quality at least ${cfg.ready.reportFloor}%`,
      met: reportAvg !== null && reportAvg >= cfg.ready.reportFloor,
      metForClose: reportAvg !== null && reportAvg >= cfg.close.reportFloor,
      detail: reportAvg === null ? "No graded incident report in your recent attempts (take an investigation exam)." : `Average graded report score ${reportAvg}%.`,
    },
  ];
  if (cfg.requireWithinTime) {
    const ok = overTime.length === 0 && recent.length > 0;
    crit.push({ id: "time", label: "Every recent exam submitted within time", met: ok, metForClose: ok, detail: overTime.length ? `${overTime.length} exam(s) ran out of time.` : recent.length ? "All within time." : "No exams yet." });
  }
  if (cfg.requireNoIntegrityFlags) {
    const ok = flagged.length === 0 && recent.length > 0;
    crit.push({ id: "integrity", label: "No integrity flags", met: ok, metForClose: ok, detail: flagged.length ? `${flagged.length} exam(s) have informational flags (see each result).` : recent.length ? "None." : "No exams yet." });
  }

  const state: ReadinessState = crit.every((c) => c.met) ? "ready" : crit.every((c) => c.metForClose) ? "close" : "not_ready";
  return { provisional: true, state, statement: state === "ready" ? READINESS_STATEMENT : null, criteria: crit, unmet: crit.filter((c) => !c.met), examIds: recent.map((e) => e.id) };
}
