"use client";

import { useState } from "react";
import { saveSocExamDetectionRuleAction } from "@/app/(app)/labs/soc/exams/actions";
import type { DetectionRuleInput } from "@/lib/lab-engine/soc/rules/evaluator";

type Props = {
  examId: string;
  disabled?: boolean;
  initialRule?: Partial<DetectionRuleInput>;
};

export function DetectionRuleEditor({ examId, disabled, initialRule }: Props) {
  const [title, setTitle] = useState(initialRule?.title ?? "");
  const [description, setDescription] = useState(initialRule?.description ?? "");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">(
    initialRule?.severity ?? "high",
  );
  const [tactic, setTactic] = useState(initialRule?.tactic ?? "");
  const [technique, setTechnique] = useState(initialRule?.technique ?? "");
  const [query, setQuery] = useState(initialRule?.query ?? "");
  const [status, setStatus] = useState<string>("Not saved yet");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError("Rule title is required.");
      return;
    }
    if (!query.trim()) {
      setError("Detection query is required.");
      return;
    }
    setSaving(true);
    setStatus("Saving…");
    setError(null);
    try {
      await saveSocExamDetectionRuleAction(examId, {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        tactic: tactic.trim() || undefined,
        technique: technique.trim().toUpperCase() || undefined,
        query: query.trim(),
      });
      setStatus(`Saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save detection rule.";
      setStatus("Save failed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="detection-rule-editor-title"
      className="border-b border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="detection-rule-editor-title" className="font-ui text-base font-semibold text-ink">
          Detection Rule Challenge Specification
        </h2>
        <span className="font-ui text-xs text-muted" aria-live="polite">
          {status}
        </span>
      </div>
      <p className="mt-1 max-w-prose text-xs text-secondary">
        Author a high-fidelity detection rule for the investigated attack. On final submission, your
        rule is evaluated against unreleased attack hold-out variants and benign decoy twins.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-xs border border-danger/40 bg-danger/10 p-3 text-xs text-ink">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="rule-title" className="block font-ui text-xs font-medium text-ink">
            Rule Title <span className="text-danger">*</span>
          </label>
          <input
            id="rule-title"
            type="text"
            required
            maxLength={120}
            disabled={disabled || saving}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. PsExec Service Installation via Named Pipe"
            className="w-full rounded-xs border border-line bg-void px-3 py-2 font-sans text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="rule-severity" className="block font-ui text-xs font-medium text-ink">
            Severity <span className="text-danger">*</span>
          </label>
          <select
            id="rule-severity"
            disabled={disabled || saving}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
            className="w-full rounded-xs border border-line bg-void px-3 py-2 font-sans text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="rule-tactic" className="block font-ui text-xs font-medium text-ink">
            MITRE ATT&CK Tactic
          </label>
          <input
            id="rule-tactic"
            type="text"
            maxLength={64}
            disabled={disabled || saving}
            value={tactic}
            onChange={(e) => setTactic(e.target.value)}
            placeholder="e.g. Lateral Movement or Persistence"
            className="w-full rounded-xs border border-line bg-void px-3 py-2 font-sans text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="rule-technique" className="block font-ui text-xs font-medium text-ink">
            MITRE ATT&CK Technique ID
          </label>
          <input
            id="rule-technique"
            type="text"
            maxLength={64}
            disabled={disabled || saving}
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            placeholder="e.g. T1021.002 or T1059"
            className="w-full rounded-xs border border-line bg-void px-3 py-2 font-mono text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
          />
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <label htmlFor="rule-description" className="block font-ui text-xs font-medium text-ink">
          Description & Threat Context
        </label>
        <textarea
          id="rule-description"
          rows={2}
          maxLength={1000}
          disabled={disabled || saving}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief explanation of the adversary behavior, indicators, and triage expectations..."
          className="w-full rounded-xs border border-line bg-void p-2.5 font-sans text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
        />
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="rule-query" className="block font-ui text-xs font-medium text-ink">
            Detection Query (BladeQL) <span className="text-danger">*</span>
          </label>
          <span className="font-mono text-xs text-muted">{query.length}/4000</span>
        </div>
        <textarea
          id="rule-query"
          required
          rows={4}
          maxLength={4000}
          disabled={disabled || saving}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`severity == "HIGH" and (rule_name =~ "PsExec" or command_line =~ "\\\\pipe\\\\")`}
          className="w-full rounded-xs border border-line bg-void p-2.5 font-mono text-xs text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
        />
        <p className="font-sans text-[11px] text-muted">
          Use the SIEM Search panel below to explore telemetry and verify query syntax before saving.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xs border border-cyan bg-cyan/15 px-4 font-ui text-xs font-medium text-cyan hover:bg-cyan/25 focus-visible:outline-2 focus-visible:outline-cyan disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save detection rule draft"}
        </button>
      </div>
    </section>
  );
}
