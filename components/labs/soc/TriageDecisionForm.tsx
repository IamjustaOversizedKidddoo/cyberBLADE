"use client";

import { useState } from "react";
import type { SocAlertClient, SocDisposition, SocSeverity, SocEscalationTier } from "@/lib/lab-engine/soc/schema";
import type { SocDecisionRecord } from "@/lib/lab-engine/soc/types";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconAlertTriangle } from "@/components/ui/icons";

const TAXONOMY_OPTIONS: Array<{
  id: SocDisposition;
  label: string;
  shortCode: string;
  badgeVariant: "danger" | "emerald" | "cyan" | "amber" | "outline";
  description: string;
}> = [
  {
    id: "true_positive",
    label: "True Positive",
    shortCode: "TP",
    badgeVariant: "danger",
    description: "Malicious adversary activity confirmed. Detection rule triggered on genuine threat.",
  },
  {
    id: "false_positive",
    label: "False Positive",
    shortCode: "FP",
    badgeVariant: "emerald",
    description: "Benign activity misidentified as malicious by rule logic or overly broad signatures.",
  },
  {
    id: "benign_true_positive",
    label: "Benign True Positive",
    shortCode: "BTP",
    badgeVariant: "cyan",
    description: "Rule triggered accurately, but the activity is authorized, expected, or approved IT maintenance.",
  },
  {
    id: "duplicate",
    label: "Duplicate / Related",
    shortCode: "DUP",
    badgeVariant: "amber",
    description: "Redundant alert belonging to an already identified parent alert or active case.",
  },
  {
    id: "needs_more_info",
    label: "Needs More Information",
    shortCode: "NMI",
    badgeVariant: "outline",
    description: "Inconclusive telemetry. Requires endpoint isolation, raw packet capture, or secondary triage.",
  },
];

type Props = {
  alert: SocAlertClient;
  existingDecision?: SocDecisionRecord;
  instantFeedbackEnabled?: boolean;
  onSaveDecision: (input: {
    disposition: SocDisposition;
    severity: SocSeverity;
    escalate: boolean;
    targetTier?: SocEscalationTier;
    rationale: string;
    evidenceRefs?: string[];
  }) => Promise<void>;
  onUndoDecision?: (alertId: string) => Promise<void>;
};

export function TriageDecisionForm({
  alert,
  existingDecision,
  instantFeedbackEnabled = false,
  onSaveDecision,
  onUndoDecision,
}: Props) {
  const [disposition, setDisposition] = useState<SocDisposition>(
    existingDecision?.disposition ?? "false_positive",
  );
  const [severity, setSeverity] = useState<SocSeverity>(
    existingDecision?.severity ?? alert.severity,
  );
  const [escalate, setEscalate] = useState<boolean>(
    existingDecision?.escalate ?? false,
  );
  const [targetTier, setTargetTier] = useState<SocEscalationTier>(
    existingDecision?.targetTier ?? "tier2",
  );
  const [rationale, setRationale] = useState<string>(
    existingDecision?.rationale ?? "",
  );
  const [evidenceInput, setEvidenceInput] = useState<string>(
    existingDecision?.evidenceRefs?.join(", ") ?? alert.id,
  );

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rationale.trim().length < 10) {
      setErrorMessage("Rationale must be at least 10 characters explaining your triage decision.");
      return;
    }

    try {
      setSaveStatus("saving");
      setErrorMessage("");

      const evidenceRefs = evidenceInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await onSaveDecision({
        disposition,
        severity,
        escalate,
        targetTier: escalate ? targetTier : undefined,
        rationale: rationale.trim(),
        evidenceRefs,
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to record decision");
    }
  };

  const selectedTaxonomy = TAXONOMY_OPTIONS.find((t) => t.id === disposition);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-line bg-console p-4 space-y-4 font-mono text-xs"
      aria-label="Triage Decision Form"
    >
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink uppercase tracking-wider">
            Triage Decision & Escalation
          </span>
          {existingDecision && (
            <Badge variant="emerald" size="sm">
              Triaged ✓
            </Badge>
          )}
        </div>

        {existingDecision && onUndoDecision && (
          <button
            type="button"
            onClick={() => onUndoDecision(alert.id)}
            className="text-[11px] text-muted hover:text-danger underline"
          >
            Reset Decision
          </button>
        )}
      </div>

      {/* Disposition Selection */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold text-secondary">
          1. Disposition Verdict:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TAXONOMY_OPTIONS.map((opt) => {
            const isSelected = disposition === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setDisposition(opt.id);
                  // Auto-suggest escalation for true positives
                  if (opt.id === "true_positive") setEscalate(true);
                  if (opt.id === "false_positive" || opt.id === "benign_true_positive") {
                    setEscalate(false);
                  }
                }}
                className={`rounded-xs border p-2 text-left transition-colors flex flex-col justify-between ${
                  isSelected
                    ? "border-cyan bg-cyan/15 text-cyan font-bold"
                    : "border-line bg-surface hover:bg-surface-hover text-muted"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[11px]">{opt.label}</span>
                  <Badge variant={opt.badgeVariant} size="sm">
                    {opt.shortCode}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Definition Callout */}
        {selectedTaxonomy && (
          <div className="rounded-xs border border-line/60 bg-surface/60 p-2 text-[11px] text-secondary leading-normal">
            <span className="font-bold text-ink">{selectedTaxonomy.label}: </span>
            {selectedTaxonomy.description}
          </div>
        )}
      </div>

      {/* Severity & Escalation Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Severity Assessment */}
        <div className="space-y-1">
          <label htmlFor="analyst-severity-select" className="block text-[11px] font-semibold text-secondary">
            2. Analyst Severity Rating:
          </label>
          <select
            id="analyst-severity-select"
            aria-label="Analyst Severity Rating"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SocSeverity)}
            className="w-full rounded-xs border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            <option value="CRITICAL">CRITICAL (Active Breach / Ransomware)</option>
            <option value="HIGH">HIGH (Adversary Execution / Credential Theft)</option>
            <option value="MEDIUM">MEDIUM (Suspicious Behavior / Reconnaissance)</option>
            <option value="LOW">LOW (Policy Deviation / Low Risk Event)</option>
            <option value="INFO">INFORMATIONAL (Contextual Telemetry)</option>
          </select>
        </div>

        {/* Escalation Toggle */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-secondary">
            3. Escalate to Higher Tier?
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEscalate(true)}
              className={`flex-1 rounded-xs border py-1.5 font-bold text-center transition-colors ${
                escalate
                  ? "border-danger bg-danger/20 text-danger"
                  : "border-line bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              YES (Escalate)
            </button>
            <button
              type="button"
              onClick={() => setEscalate(false)}
              className={`flex-1 rounded-xs border py-1.5 font-bold text-center transition-colors ${
                !escalate
                  ? "border-success bg-success/20 text-success"
                  : "border-line bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              NO (Close at L1)
            </button>
          </div>
        </div>
      </div>

      {/* Target Escalation Tier */}
      {escalate && (
        <div className="space-y-1 pt-1 border-t border-line/40">
          <label htmlFor="target-tier-select" className="block text-[11px] font-semibold text-secondary">
            Target Escalation Team:
          </label>
          <select
            id="target-tier-select"
            aria-label="Target Escalation Team"
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as SocEscalationTier)}
            className="w-full rounded-xs border border-danger/40 bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-danger focus:outline-none focus-visible:ring-1 focus-visible:ring-danger"
          >
            <option value="tier2">Tier-2 Advanced SOC Investigation</option>
            <option value="incident_response">Incident Response (Active Containment)</option>
            <option value="threat_intel">Threat Intelligence (Attribution / Campaign)</option>
            <option value="engineering">Detection Engineering (Rule Tuning)</option>
          </select>
        </div>
      )}

      {/* Rationale Textarea */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <label htmlFor="triage-rationale-input" className="font-semibold text-secondary">
            4. Triage Rationale & Justification:
          </label>
          <span className={`font-mono ${rationale.length < 10 ? "text-warning" : "text-muted"}`}>
            {rationale.length} / 1000 chars (min 10)
          </span>
        </div>
        <textarea
          id="triage-rationale-input"
          aria-label="Triage Rationale & Justification"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="State: WHAT occurred • WHY you chose this disposition • Corroborating evidence..."
          className="w-full rounded-xs border border-line bg-surface p-2.5 text-xs text-ink placeholder:text-muted focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        />
        <p className="text-[10px] text-muted leading-tight">
          💡 Good rationale example: &quot;Scheduled task executed certutil.exe from temp directory with URL parameter; parent process cmd.exe by unauthorized user.&quot;
        </p>
      </div>

      {/* Evidence References */}
      <div className="space-y-1">
        <label htmlFor="evidence-references-input" className="block text-[11px] font-semibold text-secondary">
          5. Evidence References (Alert or Event IDs):
        </label>
        <input
          id="evidence-references-input"
          aria-label="Evidence References"
          type="text"
          value={evidenceInput}
          onChange={(e) => setEvidenceInput(e.target.value)}
          placeholder="e.g. alt-001, alt-002, ev-104"
          className="w-full rounded-xs border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        />
      </div>

      {/* Generic Training Feedback (if enabled) */}
      {instantFeedbackEnabled && (
        <div className="rounded-xs border border-cyan/40 bg-cyan/10 p-2.5 text-[11px] text-cyan">
          ℹ️ Coaching Hint: Check the CMDB asset role and user department before concluding.
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xs border border-danger/40 bg-danger/15 p-2.5 text-xs text-danger flex items-center gap-2">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit Action Button */}
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === "saving" && (
            <span className="text-cyan animate-pulse">Recording to immutable log…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-success flex items-center gap-1">
              <IconCheck className="h-4 w-4" /> Decision Confirmed
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-1.5 rounded-xs border border-cyan bg-cyan/20 px-5 py-2 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/30 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          {saveStatus === "saving" ? "Saving..." : existingDecision ? "Update Decision" : "Save Decision"}
        </button>
      </div>
    </form>
  );
}
