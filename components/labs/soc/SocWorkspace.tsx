"use client";

import { useState, useCallback, useEffect } from "react";
import type { SocSessionClient, SocDecisionRecord, SocCaseRecord, SocEvaluationResult } from "@/lib/lab-engine/soc/types";
import type { SocDisposition, SocSeverity, SocEscalationTier } from "@/lib/lab-engine/soc/schema";
import { recordSocDecisionAction, manageSocCaseAction, submitSocAttemptAction, abandonSocAttemptAction } from "@/app/(app)/labs/soc/actions";
import { AlertQueueTable } from "./AlertQueueTable";
import { AlertDetailPanel } from "./AlertDetailPanel";
import { CaseManagementPanel } from "./CaseManagementPanel";
import { ShiftBriefingModal } from "./ShiftBriefingModal";
import { ShiftResultsModal } from "./ShiftResultsModal";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog";
import {
  EnrichmentWorkbenchDrawer,
  type InvestigationTarget,
} from "./enrichment/EnrichmentWorkbenchDrawer";
import { Badge } from "@/components/ui/Badge";
import { IconClock, IconShield } from "@/components/ui/icons";
import { SocSearchTab } from "./search/SocSearchTab";

type Props = {
  session: SocSessionClient;
  onExit?: () => void;
};

type WorkspaceView = "triage" | "search";
type MobileTab = "queue" | "detail" | "cases" | "search" | "tools";

export function SocWorkspace({ session, onExit }: Props) {
  const { scenario, attempt: initialAttempt } = session;

  const [attemptStatus, setAttemptStatus] = useState(initialAttempt.status);
  const [decisions, setDecisions] = useState<Record<string, SocDecisionRecord>>(session.decisions);
  const [cases, setCases] = useState<SocCaseRecord[]>(session.cases);
  const [results, setResults] = useState<SocEvaluationResult | null>(session.results);

  const [selectedAlertId, setSelectedAlertId] = useState<string>(
    scenario.alerts.length > 0 ? scenario.alerts[0].id : "",
  );

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("triage");
  const [mobileTab, setMobileTab] = useState<MobileTab>("queue");
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(Boolean(session.results));
  const [isKbdHelpOpen, setIsKbdHelpOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnrichmentOpen, setIsEnrichmentOpen] = useState(false);
  const [enrichmentTarget, setEnrichmentTarget] = useState<InvestigationTarget | null>(null);
  const [actionAnnouncement, setActionAnnouncement] = useState("");

  const activeAlert = scenario.alerts.find((a) => a.id === selectedAlertId) ?? scenario.alerts[0];
  const liveAnnouncement = actionAnnouncement || (
    activeAlert
      ? `Selected alert ${activeAlert.id}: ${activeAlert.ruleName}, severity ${activeAlert.severity}`
      : ""
  );

  // Global keyboard shortcuts (when not in inputs)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setIsKbdHelpOpen((prev) => !prev);
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setIsEnrichmentOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsKbdHelpOpen(false);
        setIsBriefingOpen(false);
        setIsSubmitConfirmOpen(false);
        setIsEnrichmentOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Handle saving triage decision
  const handleSaveDecision = useCallback(
    async (input: {
      disposition: SocDisposition;
      severity: SocSeverity;
      escalate: boolean;
      targetTier?: SocEscalationTier;
      rationale: string;
      evidenceRefs?: string[];
    }) => {
      if (!activeAlert) return;

      const record = await recordSocDecisionAction(session.attempt.id, activeAlert.id, input);
      setDecisions((prev) => ({
        ...prev,
        [activeAlert.id]: record,
      }));
      setActionAnnouncement(`Decision recorded for alert ${activeAlert.id}: ${input.disposition}`);
    },
    [session.attempt.id, activeAlert],
  );

  // Handle case management actions
  const handleManageCase = useCallback(
    async (input: {
      action: "create" | "update" | "delete" | "add_alert" | "remove_alert";
      caseId?: string;
      title?: string;
      severity?: SocSeverity;
      status?: SocCaseRecord["status"];
      notes?: string;
      alertId?: string;
      alertIds?: string[];
    }) => {
      if (input.action === "create") {
        const res = await manageSocCaseAction(session.attempt.id, {
          action: "create",
          title: input.title!,
          severity: input.severity,
          notes: input.notes,
          alertIds: input.alertIds,
        });
        if (res.case) {
          setCases((prev) => [...prev, res.case!]);
        }
      } else if (input.action === "delete") {
        await manageSocCaseAction(session.attempt.id, {
          action: "delete",
          caseId: input.caseId!,
        });
        setCases((prev) => prev.filter((c) => c.id !== input.caseId));
      } else if (input.action === "update") {
        const res = await manageSocCaseAction(session.attempt.id, {
          action: "update",
          caseId: input.caseId!,
          title: input.title,
          severity: input.severity,
          status: input.status,
          notes: input.notes,
        });
        if (res.case) {
          setCases((prev) => prev.map((c) => (c.id === res.case!.id ? res.case! : c)));
        }
      } else if (input.action === "add_alert") {
        const res = await manageSocCaseAction(session.attempt.id, {
          action: "add_alert",
          caseId: input.caseId!,
          alertId: input.alertId!,
        });
        if (res.case) {
          setCases((prev) => prev.map((c) => (c.id === res.case!.id ? res.case! : c)));
        }
      } else if (input.action === "remove_alert") {
        const res = await manageSocCaseAction(session.attempt.id, {
          action: "remove_alert",
          caseId: input.caseId!,
          alertId: input.alertId!,
        });
        if (res.case) {
          setCases((prev) => prev.map((c) => (c.id === res.case!.id ? res.case! : c)));
        }
      }
    },
    [session.attempt.id],
  );

  // Submit attempt
  const handleSubmitShift = async () => {
    try {
      setIsSubmitting(true);
      const evalResult = await submitSocAttemptAction(session.attempt.id);
      setResults(evalResult);
      setAttemptStatus("submitted");
      setIsSubmitConfirmOpen(false);
      setIsResultsOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit attempt");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abandon attempt
  const handleAbandon = async () => {
    if (confirm("Are you sure you want to abandon this shift? Progress will be marked abandoned.")) {
      await abandonSocAttemptAction(session.attempt.id);
      setAttemptStatus("abandoned");
      if (onExit) onExit();
    }
  };

  const untriagedCount = scenario.alerts.filter((a) => !decisions[a.id]).length;
  const decidedCount = Object.keys(decisions).length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1920px] mx-auto bg-console font-mono text-ink overflow-hidden border border-line">
      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Top Console Command Bar */}
      <header className="flex flex-wrap items-center justify-between border-b border-line bg-surface px-4 py-2.5 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan text-sm tracking-wide">SOC//WORKSPACE</span>
            <Badge variant="cyan" size="sm">{scenario.level}</Badge>
          </div>
          <div className="h-4 w-px bg-line hidden sm:block" />
          <h1 className="text-xs font-semibold text-ink truncate max-w-xs sm:max-w-md">
            {scenario.title}
          </h1>

          {/* Workspace View Switcher (Desktop) */}
          <div className="hidden sm:flex items-center rounded-xs bg-surface-raised border border-line p-0.5 ml-2">
            <button
              type="button"
              onClick={() => setWorkspaceView("triage")}
              className={`px-2.5 py-1 text-xs font-bold rounded-xs transition-colors ${
                workspaceView === "triage"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted hover:text-ink"
              }`}
            >
              Triage ({scenario.alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView("search")}
              className={`px-2.5 py-1 text-xs font-bold rounded-xs transition-colors flex items-center gap-1.5 ${
                workspaceView === "search"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>Log Search</span>
              <span
                className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                  workspaceView === "search"
                    ? "bg-cyan text-console font-bold"
                    : "bg-surface text-cyan border border-cyan/40"
                }`}
              >
                BladeQL
              </span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Briefing Button */}
          <button
            type="button"
            onClick={() => setIsBriefingOpen(true)}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-xs text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Briefing
          </button>

          {/* Investigation Workbench Launcher */}
          <button
            type="button"
            onClick={() => setIsEnrichmentOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xs border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-xs text-cyan hover:bg-cyan/20 font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            title="Open Investigation Workbench (i)"
          >
            <IconShield className="h-3.5 w-3.5" />
            <span>Investigate</span>
          </button>

          {/* Keyboard Shortcuts Dialog Button */}
          <button
            type="button"
            onClick={() => setIsKbdHelpOpen(true)}
            className="rounded-xs border border-line bg-surface-raised px-2 py-1 text-xs text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>

          {/* Status Indicator */}
          {attemptStatus === "submitted" ? (
            <button
              type="button"
              onClick={() => setIsResultsOpen(true)}
              className="rounded-xs border border-success/40 bg-success/15 px-3 py-1 text-xs font-bold text-success hover:bg-success/25"
            >
              View Scorecard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSubmitConfirmOpen(true)}
              className="rounded-xs border border-cyan bg-cyan/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              Submit Shift ({decidedCount}/{scenario.alerts.length})
            </button>
          )}

          {/* Exit / Reset */}
          {onExit && (
            <button
              type="button"
              onClick={handleAbandon}
              className="text-xs text-muted hover:text-danger px-2 py-1"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* Mobile Tab Switcher (Visible only below md: 768px) */}
      <div className="md:hidden flex border-b border-line bg-surface p-1 gap-1 text-xs shrink-0">
        <button
          type="button"
          onClick={() => {
            setMobileTab("queue");
            setWorkspaceView("triage");
          }}
          className={`flex-1 py-2 text-center rounded-xs font-bold min-h-[44px] ${
            mobileTab === "queue" && workspaceView === "triage"
              ? "bg-cyan/15 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          Queue ({scenario.alerts.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("detail");
            setWorkspaceView("triage");
          }}
          className={`flex-1 py-2 text-center rounded-xs font-bold min-h-[44px] ${
            mobileTab === "detail" && workspaceView === "triage"
              ? "bg-cyan/15 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          Alert
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("cases");
            setWorkspaceView("triage");
          }}
          className={`flex-1 py-2 text-center rounded-xs font-bold min-h-[44px] ${
            mobileTab === "cases" && workspaceView === "triage"
              ? "bg-cyan/15 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          Cases ({cases.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("search");
            setWorkspaceView("search");
          }}
          className={`flex-1 py-2 text-center rounded-xs font-bold min-h-[44px] ${
            workspaceView === "search"
              ? "bg-cyan/15 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("tools");
            setIsEnrichmentOpen(true);
          }}
          className={`flex-1 py-2 text-center rounded-xs font-bold min-h-[44px] ${
            mobileTab === "tools" || isEnrichmentOpen
              ? "bg-cyan/15 text-cyan border border-cyan/40"
              : "text-muted hover:text-ink"
          }`}
        >
          Tools
        </button>
      </div>

      {/* Main Workspace Body */}
      {workspaceView === "search" ? (
        <main className="flex-1 flex overflow-hidden">
          <SocSearchTab
            scenario={scenario}
            attemptId={session.attempt.id}
            seed={(scenario as any).seed ?? "scenario-seed"}
            onOpenEnrichment={(target) => {
              setEnrichmentTarget(target);
              setIsEnrichmentOpen(true);
            }}
            onAttachEvidence={(event) => {
              handleManageCase({
                action: "create",
                title: `Evidence: ${event.source} ${event.action ?? ""} (${event.id})`,
                severity: "MEDIUM",
                notes: `Log evidence from BladeQL search:\n${event._raw ?? JSON.stringify(event)}`,
              });
              setActionAnnouncement(`Evidence event ${event.id} attached to new case.`);
            }}
          />
        </main>
      ) : (
        <main className="flex-1 flex overflow-hidden">
          {/* Panel 1: Alert Queue (Left) */}
          <div
            className={`w-full md:w-[38%] lg:w-[34%] border-r border-line flex flex-col ${
              mobileTab === "queue" ? "flex" : "hidden md:flex"
            }`}
          >
            <AlertQueueTable
              alerts={scenario.alerts}
              decisions={decisions}
              selectedAlertId={selectedAlertId}
              onSelectAlert={(id) => {
                setSelectedAlertId(id);
                // Auto-switch tab on mobile for immediate triage ergonomics
                setMobileTab("detail");
              }}
            />
          </div>

          {/* Panel 2: Alert Detail & Evidence (Center) */}
          <div
            className={`w-full md:w-[62%] lg:w-[42%] flex flex-col border-r border-line ${
              mobileTab === "detail" ? "flex" : "hidden md:flex"
            }`}
          >
            {activeAlert ? (
              <AlertDetailPanel
                alert={activeAlert}
                scenario={scenario}
                existingDecision={decisions[activeAlert.id]}
                onSelectRelatedAlert={(id) => setSelectedAlertId(id)}
                onSaveDecision={handleSaveDecision}
                onOpenEnrichment={(target) => {
                  setEnrichmentTarget(target);
                  setIsEnrichmentOpen(true);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted text-xs">
                Select an alert from the queue to inspect evidence.
              </div>
            )}
          </div>

          {/* Panel 3: Cases & Notes (Right, Desktop default, Mobile Tab) */}
          <div
            className={`w-full lg:w-[24%] flex flex-col ${
              mobileTab === "cases" ? "flex" : "hidden lg:flex"
            }`}
          >
            <CaseManagementPanel
              cases={cases}
              activeAlert={activeAlert}
              onManageCase={handleManageCase}
            />
          </div>
        </main>
      )}

      {/* Submit Confirmation Modal */}
      {isSubmitConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-sm border border-line bg-console p-6 shadow-2xl space-y-4">
            <h2 id="confirm-submit-title" className="font-bold text-base text-ink">
              Submit Shift Evaluation?
            </h2>

            <div className="text-xs text-secondary space-y-2">
              <p>
                You are about to conclude this shift. Your triage decisions will be evaluated server-side against authoritative ground truth.
              </p>

              {untriagedCount > 0 && (
                <div className="rounded-xs border border-warning/40 bg-warning/10 p-3 text-warning">
                  ⚠️ <strong>{untriagedCount} alerts remain untriaged.</strong>
                  <br />
                  Untriaged alerts receive 0 points and their answer keys will remain unrevealed to preserve test integrity.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmitConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-xs border border-line bg-surface-raised px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
              >
                Continue Working
              </button>
              <button
                type="button"
                onClick={handleSubmitShift}
                disabled={isSubmitting}
                className="rounded-xs border border-cyan bg-cyan/20 px-5 py-2 text-xs font-bold text-cyan hover:bg-cyan/30 disabled:opacity-50"
              >
                {isSubmitting ? "Evaluating..." : "Confirm & Conclude Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ShiftBriefingModal
        isOpen={isBriefingOpen}
        scenario={scenario}
        onStart={() => setIsBriefingOpen(false)}
      />

      {results && (
        <ShiftResultsModal
          isOpen={isResultsOpen}
          result={results}
          onClose={() => setIsResultsOpen(false)}
          onReturnToLabs={onExit}
        />
      )}

      <KeyboardHelpDialog
        isOpen={isKbdHelpOpen}
        onClose={() => setIsKbdHelpOpen(false)}
      />

      {/* Simulated Investigation Workbench Drawer */}
      <EnrichmentWorkbenchDrawer
        attemptId={session.attempt.id}
        isOpen={isEnrichmentOpen}
        initialTarget={enrichmentTarget}
        onClose={() => {
          setIsEnrichmentOpen(false);
          setEnrichmentTarget(null);
        }}
        onAttachEvidenceToCase={async (evidenceSummary) => {
          if (cases.length > 0) {
            const firstCase = cases[0];
            const updatedNotes = firstCase.notes
              ? `${firstCase.notes}\n[Evidence] ${evidenceSummary}`
              : `[Evidence] ${evidenceSummary}`;
            await handleManageCase({
              action: "update",
              caseId: firstCase.id,
              notes: updatedNotes,
            });
            setActionAnnouncement(`Attached evidence to case ${firstCase.title}`);
          } else {
            await handleManageCase({
              action: "create",
              title: `Investigation: ${activeAlert?.ruleName ?? "Case"}`,
              notes: `[Evidence] ${evidenceSummary}`,
              alertIds: activeAlert ? [activeAlert.id] : [],
            });
            setActionAnnouncement("Created new case with attached evidence");
          }
        }}
      />
    </div>
  );
}
