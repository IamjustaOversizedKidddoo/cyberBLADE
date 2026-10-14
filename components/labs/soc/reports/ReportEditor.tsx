"use client";

import { useState, useEffect, useTransition } from "react";
import type {
  SocReportData,
  PreSubmitLintResult,
  EvidenceAppendixItem,
  SocDisposition,
  SocSeverity,
} from "@/lib/lab-engine/soc/reports/types";
import type { SocAlertClient } from "@/lib/lab-engine/soc/schema";
import { SectionOutline } from "./SectionOutline";
import { IocTableEditor } from "./IocTableEditor";
import { TimelineEditor } from "./TimelineEditor";
import { EvidencePickerDrawer } from "./EvidencePickerDrawer";
import { PreSubmitLintModal } from "./PreSubmitLintModal";
import { ReportExport } from "./ReportExport";

interface Props {
  initialReport: SocReportData;
  alerts: SocAlertClient[];
  onSaveDraft: (data: SocReportData) => Promise<PreSubmitLintResult | null>;
  onSubmitReport: (data: SocReportData) => Promise<void>;
  disabled?: boolean;
}

export function ReportEditor({
  initialReport,
  alerts,
  onSaveDraft,
  onSubmitReport,
  disabled = false,
}: Props) {
  const [report, setReport] = useState<SocReportData>(initialReport);
  const [activeSectionId, setActiveSectionId] = useState<string>("header");
  const [lintResult, setLintResult] = useState<PreSubmitLintResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("All changes saved");
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [isLintModalOpen, setIsLintModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Debounced auto-save & lint
  useEffect(() => {
    if (disabled) return;
    const timeout = setTimeout(() => {
      setSaveStatus("Saving draft...");
      startTransition(async () => {
        try {
          const lint = await onSaveDraft(report);
          setLintResult(lint);
          setSaveStatus(`Saved at ${new Date().toLocaleTimeString()}`);
        } catch {
          setSaveStatus("Failed to save draft");
        }
      });
    }, 1200);

    return () => clearTimeout(timeout);
  }, [report, onSaveDraft, disabled]);

  const updateHeader = (partial: Partial<SocReportData["header"]>) => {
    setReport((prev) => ({ ...prev, header: { ...prev.header, ...partial } }));
  };

  const updateVerdict = (partial: Partial<SocReportData["verdict"]>) => {
    setReport((prev) => ({ ...prev, verdict: { ...prev.verdict, ...partial } }));
  };

  const updateScope = (partial: Partial<SocReportData["scope"]>) => {
    setReport((prev) => ({ ...prev, scope: { ...prev.scope, ...partial } }));
  };

  const updateEscalation = (partial: Partial<SocReportData["escalation"]>) => {
    setReport((prev) => ({ ...prev, escalation: { ...prev.escalation, ...partial } }));
  };

  const handleAddEvidenceItem = (item: EvidenceAppendixItem) => {
    const existing = report.evidenceAppendix ?? [];
    if (!existing.some((e) => e.targetId === item.targetId)) {
      setReport((prev) => ({
        ...prev,
        evidenceAppendix: [...existing, item],
      }));
    }
    setIsEvidenceDrawerOpen(false);
  };

  const handlePreSubmitAudit = async () => {
    const lint = await onSaveDraft(report);
    setLintResult(lint);
    setIsLintModalOpen(true);
  };

  const handleFinalSubmit = () => {
    startTransition(async () => {
      await onSubmitReport(report);
      setIsLintModalOpen(false);
    });
  };

  return (
    <div className="flex h-full flex-col font-mono text-xs">
      {/* Editor Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface p-2.5">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-ink text-xs">
            Incident Report Editor
          </span>
          <span className="text-[10px] text-muted italic">({saveStatus})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEvidenceDrawerOpen(true)}
            disabled={disabled}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-xs text-muted hover:text-cyan hover:border-cyan/40"
          >
            + Attach Evidence
          </button>

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            Export
          </button>

          {!disabled && (
            <button
              type="button"
              onClick={handlePreSubmitAudit}
              className="rounded-xs border border-cyan bg-cyan/20 px-3.5 py-1 font-bold uppercase tracking-wider text-cyan hover:bg-cyan/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              Pre-Submit Audit & Finalize
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail: Section Outline (Desktop) */}
        <div className="hidden md:block w-56 border-r border-line bg-surface-raised/40 p-2 overflow-y-auto">
          <SectionOutline
            data={report}
            activeSectionId={activeSectionId}
            onSelectSection={(id) => {
              setActiveSectionId(id);
              const el = document.getElementById(`section-${id}`);
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            lintResult={lintResult}
          />
        </div>

        {/* Center: Scrollable Form Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Section 1: Header */}
          <section id="section-header" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-ink text-xs border-b border-line pb-1.5">
              1. Incident Header
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Report Title *
                </label>
                <input
                  type="text"
                  value={report.header.title}
                  disabled={disabled}
                  onChange={(e) => updateHeader({ title: e.target.value })}
                  aria-label="Report Title"
                  placeholder="e.g. Incident Report: Unauthorized PowerShell Execution and Beaconing"
                  className="w-full rounded-xs border border-line bg-surface-raised px-2.5 py-1.5 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">Case ID</label>
                <input
                  type="text"
                  value={report.header.caseId}
                  disabled
                  aria-label="Case ID"
                  className="w-full rounded-xs border border-line bg-surface-raised/50 px-2.5 py-1.5 text-muted font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">Classification</label>
                <select
                  value={report.header.classification}
                  disabled={disabled}
                  onChange={(e) => updateHeader({ classification: e.target.value })}
                  aria-label="Classification"
                  className="w-full rounded-xs border border-line bg-surface px-2 py-1.5 text-ink"
                >
                  <option value="TLP:CLEAR">TLP:CLEAR (Public / Unclassified)</option>
                  <option value="TLP:GREEN">TLP:GREEN (Community)</option>
                  <option value="TLP:AMBER">TLP:AMBER (Internal SOC Restricted)</option>
                  <option value="TLP:RED">TLP:RED (Strictly Named Individuals)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Executive Summary */}
          <section id="section-executive-summary" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <h3 className="font-bold uppercase tracking-wider text-ink text-xs">
                2. Executive Summary *
              </h3>
              <span className="text-[10px] text-muted">
                {(report.executiveSummary ?? "").length} / 1200 chars (min 30)
              </span>
            </div>
            <textarea
              value={report.executiveSummary}
              disabled={disabled}
              onChange={(e) => setReport((prev) => ({ ...prev, executiveSummary: e.target.value }))}
              rows={4}
              aria-label="Executive Summary"
              placeholder="High-level synthesis for management and Tier-2: What happened, affected assets, business impact, and containment status..."
              className="w-full rounded-xs border border-line bg-surface-raised p-2.5 text-ink leading-relaxed focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
          </section>

          {/* Section 3: Verdict & Scope */}
          <section id="section-verdict-scope" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-ink text-xs border-b border-line pb-1.5">
              3. Verdict & Scoping *
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Investigation Disposition *
                </label>
                <select
                  value={report.verdict.disposition}
                  disabled={disabled}
                  onChange={(e) => updateVerdict({ disposition: e.target.value as SocDisposition })}
                  aria-label="Investigation Disposition"
                  className="w-full rounded-xs border border-line bg-surface px-2 py-1.5 text-ink font-bold"
                >
                  <option value="undetermined">Select disposition...</option>
                  <option value="true_positive">True Positive (Incident)</option>
                  <option value="false_positive">False Positive (Benign / Misconfig)</option>
                  <option value="benign_true_positive">Benign True Positive (Authorized)</option>
                  <option value="duplicate">Duplicate Alarm</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">Severity Rating *</label>
                <select
                  value={report.verdict.severity}
                  disabled={disabled}
                  onChange={(e) => updateVerdict({ severity: e.target.value as SocSeverity })}
                  aria-label="Severity Rating"
                  className="w-full rounded-xs border border-line bg-surface px-2 py-1.5 text-ink font-bold"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">Analyst Confidence</label>
                <select
                  value={report.verdict.confidence}
                  disabled={disabled}
                  onChange={(e) => updateVerdict({ confidence: e.target.value as "high" | "medium" | "low" })}
                  aria-label="Analyst Confidence"
                  className="w-full rounded-xs border border-line bg-surface px-2 py-1.5 text-ink"
                >
                  <option value="high">High Confidence (Corroborated)</option>
                  <option value="medium">Medium Confidence (Likely)</option>
                  <option value="low">Low Confidence (Unverified)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase text-muted mb-1">Verdict Justification *</label>
                <textarea
                  value={report.verdict.justification}
                  disabled={disabled}
                  onChange={(e) => updateVerdict({ justification: e.target.value })}
                  rows={2}
                  aria-label="Verdict Justification"
                  placeholder="Explain why this disposition and severity was chosen based on evidence..."
                  className="w-full rounded-xs border border-line bg-surface-raised p-2 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Affected Assets (comma-separated hostnames or IPs) *
                </label>
                <input
                  type="text"
                  value={(report.scope.affectedAssets ?? []).join(", ")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateScope({
                      affectedAssets: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  aria-label="Affected Assets"
                  placeholder="ws-fin-01.corp.internal, dc-01.corp.internal"
                  className="w-full rounded-xs border border-line bg-surface-raised px-2.5 py-1.5 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Affected User Accounts (comma-separated usernames)
                </label>
                <input
                  type="text"
                  value={(report.scope.affectedUsers ?? []).join(", ")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateScope({
                      affectedUsers: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  aria-label="Affected User Accounts"
                  placeholder="jsmith, finance_service"
                  className="w-full rounded-xs border border-line bg-surface-raised px-2.5 py-1.5 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Indicators of Compromise */}
          <section id="section-iocs" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-ink text-xs border-b border-line pb-1.5">
              4. Indicators of Compromise (IoCs) *
            </h3>
            <IocTableEditor
              iocs={report.iocs ?? []}
              onChange={(iocs) => setReport((prev) => ({ ...prev, iocs }))}
              disabled={disabled}
            />
          </section>

          {/* Section 5: Timeline */}
          <section id="section-timeline" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-ink text-xs border-b border-line pb-1.5">
              5. Incident Investigation Timeline *
            </h3>
            <TimelineEditor
              timeline={report.timeline ?? []}
              onChange={(timeline) => setReport((prev) => ({ ...prev, timeline }))}
              disabled={disabled}
            />
          </section>

          {/* Section 6: Attack Narrative & Escalation */}
          <section id="section-narrative" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-ink text-xs border-b border-line pb-1.5">
              6. Attack Narrative & Escalation Handoff *
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase text-muted mb-1">
                  Technical Attack Narrative (min 50 chars) *
                </label>
                <textarea
                  value={report.attackNarrative}
                  disabled={disabled}
                  onChange={(e) => setReport((prev) => ({ ...prev, attackNarrative: e.target.value }))}
                  rows={5}
                  aria-label="Technical Attack Narrative"
                  placeholder="Chronological narrative of adversary actions: Initial delivery, execution method, privilege escalation, persistence, and impact..."
                  className="w-full rounded-xs border border-line bg-surface-raised p-2.5 text-ink leading-relaxed focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="escalation-required"
                    checked={report.escalation.requiresEscalation}
                    disabled={disabled}
                    onChange={(e) => updateEscalation({ requiresEscalation: e.target.checked })}
                    className="h-4 w-4 rounded-xs border-line text-cyan focus:ring-cyan"
                  />
                  <label htmlFor="escalation-required" className="text-xs font-bold text-ink">
                    Tier-2 Escalation Required
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-muted mb-1">Handoff Urgency</label>
                  <select
                    value={report.escalation.urgency}
                    disabled={disabled}
                    onChange={(e) =>
                      updateEscalation({
                        urgency: e.target.value as "immediate" | "priority" | "routine",
                      })
                    }
                    aria-label="Handoff Urgency"
                    className="w-full rounded-xs border border-line bg-surface px-2 py-1 text-ink"
                  >
                    <option value="immediate">Immediate (&lt; 15 min)</option>
                    <option value="priority">Priority (&lt; 1 hour)</option>
                    <option value="routine">Routine (&lt; 4 hours)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase text-muted mb-1">Handoff Summary</label>
                  <textarea
                    value={report.escalation.handoffSummary}
                    disabled={disabled}
                    onChange={(e) => updateEscalation({ handoffSummary: e.target.value })}
                    rows={2}
                    aria-label="Handoff Summary"
                    placeholder="Specific instructions and containment summary for the receiving responder team..."
                    className="w-full rounded-xs border border-line bg-surface-raised p-2 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Evidence Appendix */}
          <section id="section-evidence" className="rounded-xs border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <h3 className="font-bold uppercase tracking-wider text-ink text-xs">
                7. Evidence Appendix ({(report.evidenceAppendix?.length ?? 0)} items)
              </h3>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setIsEvidenceDrawerOpen(true)}
                  className="rounded-xs border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan hover:bg-cyan/25"
                >
                  + Add Telemetry Evidence
                </button>
              )}
            </div>

            {(report.evidenceAppendix?.length ?? 0) === 0 ? (
              <p className="text-muted italic p-2 text-center">
                No telemetry artifacts attached yet. Use &quot;+ Add Telemetry Evidence&quot; to link alerts and logs.
              </p>
            ) : (
              <div className="space-y-2">
                {(report.evidenceAppendix ?? []).map((ev) => (
                  <div key={ev.id} className="rounded-xs border border-line bg-surface-raised p-2 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-ink mr-2">{ev.label}</span>
                      <span className="text-[10px] text-muted">[{ev.type}:{ev.targetId}]</span>
                      <p className="text-[11px] text-muted mt-0.5">{ev.annotation}</p>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() =>
                          setReport((prev) => ({
                            ...prev,
                            evidenceAppendix: (prev.evidenceAppendix ?? []).filter((e) => e.id !== ev.id),
                          }))
                        }
                        className="text-error hover:underline px-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Slide-over Drawers & Modals */}
      <EvidencePickerDrawer
        isOpen={isEvidenceDrawerOpen}
        onClose={() => setIsEvidenceDrawerOpen(false)}
        alerts={alerts}
        onAddEvidence={handleAddEvidenceItem}
      />

      <PreSubmitLintModal
        isOpen={isLintModalOpen}
        onClose={() => setIsLintModalOpen(false)}
        onConfirmSubmit={handleFinalSubmit}
        isSubmitting={isPending}
        lintResult={lintResult}
      />

      {isExportOpen && (
        <ReportExport report={report} onClose={() => setIsExportOpen(false)} />
      )}
    </div>
  );
}
