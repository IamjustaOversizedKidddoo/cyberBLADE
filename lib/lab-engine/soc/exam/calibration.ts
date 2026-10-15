/**
 * Offline calibration: for each self-reported real exam outcome, what did the provisional gate say
 * using only the learner's practice exams submitted before that exam date? Output is aggregate
 * counts only (no user ids). Self-reports are untrusted: malformed or future-dated rows are
 * skipped and counted, never fixed up.
 */
import type { ReadinessConfig } from "./config";
import { evaluateReadiness, type ReadinessState } from "./readiness";
import type { SocExamAttemptRecord, SocExamOutcomeReport } from "./types";

export type CalibrationTable = {
  rows: number;
  skipped: number;
  byState: Record<ReadinessState, { passed: number; failed: number }>;
};

export function calibrationTable(
  exams: SocExamAttemptRecord[],
  outcomes: SocExamOutcomeReport[],
  cfg: ReadinessConfig,
  counts: (format: string) => boolean,
  now: Date,
): CalibrationTable {
  const table: CalibrationTable = { rows: 0, skipped: 0, byState: { not_ready: { passed: 0, failed: 0 }, close: { passed: 0, failed: 0 }, ready: { passed: 0, failed: 0 } } };
  for (const o of outcomes) {
    const at = Date.parse(`${o.examDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.examDate) || !Number.isFinite(at) || at > now.getTime() || typeof o.passed !== "boolean") {
      table.skipped += 1;
      continue;
    }
    const before = exams.filter((e) => e.userId === o.userId && e.submittedAt && Date.parse(e.submittedAt) < at);
    const state = evaluateReadiness(before, counts, cfg).state;
    table.byState[state][o.passed ? "passed" : "failed"] += 1;
    table.rows += 1;
  }
  return table;
}
