"use client";

import { useState, useEffect, useRef } from "react";
import type { SocCaseRecord } from "@/lib/lab-engine/soc/types";
import type { SocAlertClient, SocSeverity } from "@/lib/lab-engine/soc/schema";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconShield, IconCross } from "@/components/ui/icons";

type Props = {
  cases: SocCaseRecord[];
  activeAlert: SocAlertClient | null;
  onManageCase: (input: {
    action: "create" | "update" | "delete" | "add_alert" | "remove_alert";
    caseId?: string;
    title?: string;
    severity?: SocSeverity;
    status?: SocCaseRecord["status"];
    notes?: string;
    alertId?: string;
    alertIds?: string[];
  }) => Promise<void>;
};

export function CaseManagementPanel({
  cases,
  activeAlert,
  onManageCase,
}: Props) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    cases.length > 0 ? cases[0].id : null,
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeverity, setNewSeverity] = useState<SocSeverity>("MEDIUM");

  const [notes, setNotes] = useState("");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  // Sync active case notes
  useEffect(() => {
    if (activeCase) {
      setNotes(activeCase.notes);
    } else {
      setNotes("");
    }
  }, [selectedCaseId, activeCase]);

  // Debounced autosave for case notes
  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    if (!activeCase) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await onManageCase({
          action: "update",
          caseId: activeCase.id,
          notes: newNotes,
        });
        setLastSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Autosave failed", err);
      }
    }, 600);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await onManageCase({
      action: "create",
      title: newTitle.trim(),
      severity: newSeverity,
      alertIds: activeAlert ? [activeAlert.id] : [],
    });

    setNewTitle("");
    setIsCreatingNew(false);
  };

  const insertMarkdown = (prefix: string, suffix = "") => {
    setNotes((prev) => `${prev}\n${prefix} ${suffix}`);
  };

  const generateHandoffText = (): string => {
    if (!activeCase) return "";
    return `========================================
SOC ESCALATION HANDOFF SUMMARY
========================================
Case: ${activeCase.title}
Severity: ${activeCase.severity}
Status: ${activeCase.status.toUpperCase()}
Associated Alerts: ${activeCase.alertIds.join(", ") || "None"}
Created At: ${activeCase.createdAt}

INVESTIGATION NOTES:
${notes || "No notes recorded."}
========================================`;
  };

  const handleCopyHandoff = () => {
    navigator.clipboard.writeText(generateHandoffText());
    setCopiedHandoff(true);
    setTimeout(() => setCopiedHandoff(false), 2000);
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 font-mono text-xs select-none">
      {/* Case Selector Header */}
      <div className="rounded-sm border border-line bg-console p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
            <IconShield className="h-4 w-4 text-cyan" />
            Case Investigations ({cases.length})
          </span>

          <button
            type="button"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="rounded-xs border border-cyan/40 bg-cyan/15 px-2.5 py-1 text-[11px] font-bold text-cyan hover:bg-cyan/25"
          >
            {isCreatingNew ? "Cancel" : "+ New Case"}
          </button>
        </div>

        {/* Create Case Form */}
        {isCreatingNew && (
          <form onSubmit={handleCreateCase} className="p-2.5 rounded-xs bg-surface border border-line space-y-2">
            <input
              type="text"
              aria-label="New Case Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Case title (e.g. Credential Phishing Campaign)..."
              className="w-full rounded-xs border border-line bg-console px-2.5 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
            <div className="flex items-center justify-between">
              <select
                aria-label="New Case Severity"
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value as SocSeverity)}
                className="rounded-xs border border-line bg-console px-2 py-1 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>

              <button
                type="submit"
                className="rounded-xs border border-cyan bg-cyan/20 px-3 py-1 font-bold text-cyan hover:bg-cyan/30"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Case Dropdown */}
        {cases.length > 0 ? (
          <div className="space-y-2">
            <select
              aria-label="Active Case Selection"
              value={selectedCaseId ?? ""}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full rounded-xs border border-line bg-surface px-2.5 py-1.5 text-xs text-ink font-semibold focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.severity}] {c.title} ({c.alertIds.length} alerts)
                </option>
              ))}
            </select>

            {/* Case Quick Metadata */}
            {activeCase && (
              <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                <div className="flex items-center gap-2">
                  <Badge variant={activeCase.severity === "CRITICAL" ? "danger" : "amber"} size="sm">
                    {activeCase.severity}
                  </Badge>
                  <span className="uppercase text-[10px] text-cyan font-bold">
                    {activeCase.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onManageCase({ action: "delete", caseId: activeCase.id })}
                  className="text-muted hover:text-danger text-[10px] underline"
                >
                  Delete Case
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-muted italic text-center py-2">
            No active cases. Create a case to group correlated incident alerts.
          </div>
        )}
      </div>

      {/* Linked Alerts in Active Case */}
      {activeCase && (
        <div className="rounded-sm border border-line bg-console p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="font-bold text-ink text-xs">
              Linked Alerts ({activeCase.alertIds.length})
            </span>
            {activeAlert && (
              <button
                type="button"
                onClick={() => {
                  if (activeCase.alertIds.includes(activeAlert.id)) {
                    onManageCase({
                      action: "remove_alert",
                      caseId: activeCase.id,
                      alertId: activeAlert.id,
                    });
                  } else {
                    onManageCase({
                      action: "add_alert",
                      caseId: activeCase.id,
                      alertId: activeAlert.id,
                    });
                  }
                }}
                className={`rounded-xs border px-2 py-0.5 text-[10px] font-bold ${
                  activeCase.alertIds.includes(activeAlert.id)
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : "border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/25"
                }`}
              >
                {activeCase.alertIds.includes(activeAlert.id)
                  ? "- Remove Current Alert"
                  : "+ Add Current Alert"}
              </button>
            )}
          </div>

          <div
            tabIndex={0}
            aria-label="Linked alert IDs list"
            className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            {activeCase.alertIds.map((aid) => (
              <span
                key={aid}
                className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-2 py-0.5 text-[10px] text-ink"
              >
                {aid}
                <button
                  type="button"
                  onClick={() =>
                    onManageCase({
                      action: "remove_alert",
                      caseId: activeCase.id,
                      alertId: aid,
                    })
                  }
                  className="text-muted hover:text-danger"
                >
                  <IconCross className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Case Notes & Analyst Log */}
      {activeCase && (
        <div className="flex-1 flex flex-col rounded-sm border border-line bg-console p-3 space-y-2 min-h-[220px]">
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <span className="font-bold text-ink text-xs">Investigation Notes</span>
            <span className="text-[10px] text-muted">
              {lastSavedTime ? `Autosaved at ${lastSavedTime}` : "Autosave enabled"}
            </span>
          </div>

          {/* Markdown Quick Formatting Toolbar */}
          <div className="flex items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => insertMarkdown("###")}
              className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-muted hover:text-ink"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown("-")}
              className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-muted hover:text-ink"
            >
              List
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown("**", "**")}
              className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-muted hover:text-ink"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown("```\n", "\n```")}
              className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-muted hover:text-ink"
            >
              Code
            </button>
          </div>

          <textarea
            aria-label="Investigation Notes"
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Record timeline observations, host triage findings, lateral movement traces..."
            className="flex-1 w-full rounded-xs border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-muted focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan resize-none font-mono"
          />

          {/* Escalation Handoff Summary Export */}
          <div className="pt-2 border-t border-line/40 flex items-center justify-between">
            <span className="text-[10px] text-muted">Handoff summary:</span>
            <button
              type="button"
              onClick={handleCopyHandoff}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-[10px] font-bold text-ink hover:bg-surface-hover"
            >
              {copiedHandoff ? (
                <>
                  <IconCheck className="h-3 w-3 text-success" /> Copied Handoff
                </>
              ) : (
                <>
                  <IconCopy className="h-3 w-3 text-cyan" /> Copy Handoff Briefing
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
