"use client";

import { useState } from "react";
import { ModalFocusScope } from "@/components/ui/ModalFocusScope";
import type { SocEvaluationResult } from "@/lib/lab-engine/soc/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconCheck, IconCross, IconShield, IconAlertTriangle } from "@/components/ui/icons";

type Props = {
  isOpen: boolean;
  result: SocEvaluationResult;
  onClose: () => void;
  onReturnToLabs?: () => void;
};

export function ShiftResultsModal({ isOpen, result, onClose, onReturnToLabs }: Props) {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <ModalFocusScope onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-sm border border-line bg-console shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className={`p-6 border-b border-line ${result.passed ? "bg-success/10" : "bg-warning/10"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                  SHIFT DEBRIEF & SCORECARD
                </span>
                <Badge variant={result.passed ? "emerald" : "amber"}>
                  {result.passed ? "SHIFT PASSED" : "RETRIAL RECOMMENDED"}
                </Badge>
              </div>
              <h2 id="results-title" className="font-mono text-2xl font-bold text-ink">
                Score: {result.percentage}% • {result.totalScore} / {result.maxScore} pts
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {result.passed && (
                <div className="rounded-xs border border-cyan/40 bg-cyan/15 px-3 py-1.5 font-mono text-xs font-bold text-cyan">
                  +150 XP AWARDED
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div
          tabIndex={0}
          aria-label="Shift evaluation scorecard content"
          className="flex-1 overflow-y-auto p-6 space-y-6 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xs border border-line bg-surface p-3 space-y-1">
              <span className="text-[11px] font-mono text-muted uppercase">Triage Coverage</span>
              <div className="font-mono text-base font-bold text-ink">
                {result.alertsDecided} / {result.alertsTotal}
              </div>
              <span className="text-[10px] text-muted">Alerts reviewed</span>
            </div>

            <div className="rounded-xs border border-line bg-surface p-3 space-y-1">
              <span className="text-[11px] font-mono text-muted uppercase">Incidents Found</span>
              <div className="font-mono text-base font-bold text-success">
                {result.incidents.filter((i) => i.detected).length} / {result.incidents.length}
              </div>
              <span className="text-[10px] text-muted">Real incidents identified</span>
            </div>

            <div className="rounded-xs border border-line bg-surface p-3 space-y-1">
              <span className="text-[11px] font-mono text-muted uppercase">False Positives</span>
              <div className="font-mono text-base font-bold text-ink">
                {result.falsePositivesHandled} / {result.falsePositivesTotal}
              </div>
              <span className="text-[10px] text-muted">Accurately filtered noise</span>
            </div>

            <div className="rounded-xs border border-line bg-surface p-3 space-y-1">
              <span className="text-[11px] font-mono text-muted uppercase">Noise Errors</span>
              <div className="font-mono text-base font-bold text-warning">
                {result.overEscalatedCount} Over / {result.underEscalatedCount} Under
              </div>
              <span className="text-[10px] text-muted">Escalation misclassifications</span>
            </div>
          </div>

          {/* Overall Debrief */}
          {result.overallDebrief && (
            <div className="rounded-xs border border-line bg-surface/60 p-4 space-y-1.5">
              <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                <IconShield className="h-4 w-4 text-cyan" />
                Senior Analyst Shift Assessment
              </span>
              <p className="text-xs text-secondary leading-relaxed">
                {result.overallDebrief}
              </p>
            </div>
          )}

          {/* Skill Breakdown */}
          <div className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
              Assessed Competencies
            </h3>
            <div className="space-y-3">
              {result.skills.map((skill) => (
                <div key={skill.skillId} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-secondary">{skill.skillTitle}</span>
                    <span className="text-ink font-semibold">{skill.percentage}%</span>
                  </div>
                  <ProgressBar value={skill.percentage} max={100} />
                </div>
              ))}
            </div>
          </div>

          {/* Incident Verification */}
          <div className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
              Incident Correlation Breakdown
            </h3>
            <div className="divide-y divide-line/30">
              {result.incidents.map((inc) => (
                <div key={inc.incidentId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono font-semibold text-ink">{inc.title}</span>
                    <div className="text-[11px] text-muted font-mono">
                      {inc.foundAlertCount} of {inc.totalAlertCount} component alerts escalated
                    </div>
                  </div>
                  <Badge variant={inc.detected ? "emerald" : "danger"}>
                    {inc.detected ? "IDENTIFIED" : "MISSED"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Per-Alert Detailed Feedback */}
          <div className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
                Individual Alert Debriefs ({result.alertResults.filter((a) => a.debrief).length} Triaged)
              </h3>
              <span className="text-[11px] text-muted font-mono">
                Click any alert to inspect verdict explanation
              </span>
            </div>

            <div
              tabIndex={0}
              aria-label="Individual alert debriefs list"
              className="space-y-2 max-h-80 overflow-y-auto pr-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              {result.alertResults.map((item) => {
                const isSelected = selectedAlertId === item.alertId;
                const hasDebrief = Boolean(item.debrief);

                return (
                  <div
                    key={item.alertId}
                    className={`rounded-xs border transition-colors p-3 text-xs ${
                      isSelected
                        ? "border-cyan/50 bg-cyan/5"
                        : "border-line bg-surface-raised/40 hover:bg-surface-raised"
                    }`}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setSelectedAlertId(isSelected ? null : item.alertId)}
                    >
                      <div className="flex items-center gap-2">
                        {item.isCorrect ? (
                          <IconCheck className="h-4 w-4 text-success" />
                        ) : hasDebrief ? (
                          <IconAlertTriangle className="h-4 w-4 text-warning" />
                        ) : (
                          <span className="text-muted text-[11px] font-mono">[UNWORKED]</span>
                        )}
                        <span className="font-mono font-semibold text-ink">{item.alertId}</span>
                        {item.acceptableAlternativeMatched && (
                          <Badge variant="cyan" size="sm">Acceptable Alternative</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-muted">
                          Your: <strong className="text-ink">{item.learnerDisposition ?? "None"}</strong>
                        </span>
                        <span className="font-bold text-ink">
                          {item.pointsEarned} / {item.maxPoints} pts
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-line/40 space-y-2 text-[11px]">
                        {hasDebrief ? (
                          <>
                            <div className="grid grid-cols-2 gap-2 font-mono text-muted">
                              <div>Expected Verdict: <strong className="text-ink">{item.correctDisposition}</strong></div>
                              <div>Expected Escalation: <strong className="text-ink">{item.correctEscalate ? "Yes" : "No"}</strong></div>
                            </div>
                            <div className="rounded-xs bg-console p-2.5 font-mono text-secondary leading-relaxed border border-line/40">
                              <span className="text-cyan font-bold block mb-1">Debrief Explanation:</span>
                              {item.debrief}
                            </div>
                            {item.alternativeReason && (
                              <p className="text-cyan text-[11px] italic">
                                Note: {item.alternativeReason}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-muted font-mono italic">
                            This alert was not triaged during your shift. Answers and debriefs remain hidden to preserve learning integrity.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-surface flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line bg-surface-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Review Workspace
          </button>

          {onReturnToLabs && (
            <button
              type="button"
              onClick={onReturnToLabs}
              className="rounded-xs border border-cyan bg-cyan/20 px-5 py-2 text-xs font-bold text-cyan hover:bg-cyan/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              Exit to Labs Directory
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalFocusScope>
  );
}
