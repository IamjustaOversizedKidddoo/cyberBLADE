"use client";

import type { GradingResult } from "@/lib/lab-engine/soc/reports/types";

interface Props {
  result: GradingResult;
  onViewComparison?: () => void;
  onExportReport?: () => void;
}

export function GradedResultsScorecard({
  result,
  onViewComparison,
  onExportReport,
}: Props) {
  const isPassing = result.totalScore >= 70;
  const activeFlags = Object.entries(result.flags ?? {})
    .filter(([, active]) => active)
    .map(([key]) => key);

  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      {/* Top Banner: Overall Score & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-line bg-surface p-4 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <div
            className={`flex flex-col items-center justify-center rounded-xs border px-4 py-2 ${
              isPassing
                ? "border-success/40 bg-success/15 text-success"
                : "border-error/40 bg-error/15 text-error"
            }`}
          >
            <span className="text-2xl font-bold tracking-tight">
              {result.totalScore.toFixed(1)}%
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {isPassing ? "PASSED (>= 70%)" : "FAILED (< 70%)"}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-ink">Authoritative Evaluation</h2>
              <span className="rounded-xs border border-line bg-surface-raised px-1.5 py-0.5 text-[10px] text-muted">
                {result.isFullyGraded ? "Final Grade" : "Provisional Grade"}
              </span>
            </div>
            <div className="text-[10px] text-muted">
              {result.versionLabel} • Computed at {new Date(result.computedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onViewComparison && (
            <button
              type="button"
              onClick={onViewComparison}
              className="rounded-xs border border-cyan/40 bg-cyan/15 px-3 py-1.5 font-bold text-cyan hover:bg-cyan/25 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Compare with Model Report
            </button>
          )}
          {onExportReport && (
            <button
              type="button"
              onClick={onExportReport}
              className="rounded-xs border border-line bg-surface-raised px-3 py-1.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Export Report
            </button>
          )}
        </div>
      </div>

      {/* Integrity Flags (if any detected) */}
      {activeFlags.length > 0 && (
        <div className="rounded-xs border border-warning/40 bg-warning/10 p-3">
          <div className="font-bold uppercase tracking-wider text-[10px] text-warning mb-1.5">
            Integrity & Anti-Gaming Alerts Detected
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-xs border border-warning/60 bg-surface px-2 py-0.5 text-[10px] font-bold text-warning"
              >
                {flag.replace(/([A-Z])/g, "_$1").toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Criterion Breakdown Table */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Rubric Criteria Performance
        </div>

        <div className="space-y-2">
          {Object.entries(result.criterionResults)
            // Zero-weight placeholders (the old AI seam) are shown in the writing-feedback section instead.
            .filter(([, cRes]) => !(cRes.status === "not_available" && cRes.weight === 0))
            .map(([criterionId, cRes]) => {
            const pct = cRes.maxScore > 0 ? (cRes.score / cRes.maxScore) * 100 : 0;
            const isGood = pct >= 80;
            const isMid = pct >= 50 && pct < 80;

            return (
              <div
                key={criterionId}
                className="rounded-xs border border-line bg-surface p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink uppercase text-[11px] flex items-center gap-1">
                      <span>{criterionId.replace(/_/g, " ")}</span>
                      {criterionId.toLowerCase().includes("timeline") && (
                        <span
                          className="cursor-help font-normal text-muted hover:text-cyan"
                          title="Evaluated via Kendall-Tau distance: mathematical measure of correct chronological ordering of intrusion milestones."
                        >
                          ℹ
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted">
                      (Weight: {cRes.weight * 100}%)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        isGood ? "text-success" : isMid ? "text-warning" : "text-error"
                      }`}
                    >
                      {cRes.score.toFixed(1)} / {cRes.maxScore.toFixed(1)} pts
                    </span>
                    <span className="text-[10px] text-muted">({pct.toFixed(0)}%)</span>
                  </div>
                </div>

                {/* Feedback */}
                <p className="text-[11px] text-ink leading-relaxed">{cRes.feedback}</p>

                {/* Teaching Pointers */}
                {cRes.teachingPointers.length > 0 && (
                  <div className="rounded-xs border border-line/60 bg-surface-raised p-2 text-[10px] text-cyan">
                    <span className="font-bold mr-1">💡 Coaching Pointer:</span>
                    {cRes.teachingPointers.join(" ")}
                  </div>
                )}

                {/* Annotations Tags */}
                {cRes.annotations.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {cRes.annotations.map((ann, idx) => (
                      <span
                        key={idx}
                        className={`rounded-xs px-1.5 py-0.5 text-[9px] border ${
                          ann.status === "supported"
                            ? "bg-success/10 border-success/30 text-success"
                            : ann.status === "incorrect"
                            ? "bg-error/10 border-error/30 text-error"
                            : ann.status === "missing"
                            ? "bg-warning/10 border-warning/30 text-warning"
                            : "bg-surface-raised border-line text-muted"
                        }`}
                      >
                        {ann.claimType}: {ann.detail}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
