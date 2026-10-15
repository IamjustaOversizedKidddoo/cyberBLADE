"use client";

import type { PreSubmitLintResult } from "@/lib/lab-engine/soc/reports/types";
import { ModalFocusScope } from "@/components/ui/ModalFocusScope";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  isSubmitting: boolean;
  lintResult: PreSubmitLintResult | null;
}

export function PreSubmitLintModal({
  isOpen,
  onClose,
  onConfirmSubmit,
  isSubmitting,
  lintResult,
}: Props) {
  if (!isOpen) return null;

  const hasErrors = (lintResult?.errors.length ?? 0) > 0;

  return (
    <ModalFocusScope onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pre-Submission Lint Review"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-mono text-xs"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xs border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                hasErrors ? "bg-error" : "bg-success"
              }`}
            />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
              Pre-Submission Audit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-muted hover:text-ink text-sm px-1"
          >
            ✕
          </button>
        </div>

        <div className="my-4 max-h-[350px] overflow-y-auto space-y-3">
          {/* One-Shot Policy Warning Alert */}
          <div className="rounded-xs border border-warning/40 bg-warning/10 p-3 text-warning">
            <div className="font-bold uppercase tracking-wider text-[11px] mb-1">
              ⚠️ Irreversible One-Shot Policy
            </div>
            <p className="text-[11px] leading-relaxed">
              Once submitted, your incident report is permanently locked and evaluated against
              authoritative scenario ground truth. You cannot edit or resubmit this attempt.
            </p>
          </div>

          {/* Validation Diagnostics */}
          {lintResult ? (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Validation Checks ({lintResult.checksRun} executed)
              </div>

              {lintResult.errors.length > 0 && (
                <div className="rounded-xs border border-error/40 bg-error/10 p-2.5 space-y-1">
                  <div className="font-bold text-error text-[11px]">
                    Blocking Issues ({lintResult.errors.length})
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-ink">
                    {lintResult.errors.map((err, idx) => (
                      <li key={idx}>
                        <span className="font-bold uppercase text-muted mr-1">
                          [{err.sectionId}]
                        </span>
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lintResult.warnings.length > 0 && (
                <div className="rounded-xs border border-warning/30 bg-warning/5 p-2.5 space-y-1">
                  <div className="font-bold text-warning text-[11px]">
                    Advisory Warnings ({lintResult.warnings.length})
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-muted">
                    {lintResult.warnings.map((warn, idx) => (
                      <li key={idx}>
                        <span className="font-bold uppercase mr-1">[{warn.sectionId}]</span>
                        {warn.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lintResult.errors.length === 0 && (
                <div className="rounded-xs border border-success/40 bg-success/10 p-3 text-success font-bold text-center">
                  ✓ All required sections complete and format checks passed. Ready for grading.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted">Analyzing report draft...</div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xs border border-line bg-surface-raised px-3 py-1.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Return to Editor
          </button>
          <button
            type="button"
            onClick={onConfirmSubmit}
            disabled={isSubmitting || hasErrors}
            className="rounded-xs border border-cyan bg-cyan/20 px-4 py-1.5 font-bold uppercase tracking-wider text-cyan hover:bg-cyan/30 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            {isSubmitting ? "Grading Report..." : "Submit Incident Report"}
          </button>
        </div>
      </div>
    </div>
    </ModalFocusScope>
  );
}
