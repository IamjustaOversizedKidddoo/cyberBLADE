"use client";

import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

interface Props {
  report: SocReportData;
  onClose: () => void;
}

export function generateMarkdownReport(report: SocReportData): string {
  const lines: string[] = [];

  lines.push(`# ${report.header.title || "INCIDENT INVESTIGATION REPORT"}`);
  lines.push(`**Case ID:** ${report.header.caseId || "N/A"}`);
  lines.push(`**Analyst:** ${report.header.analystHandle || "Tier-1 Analyst"}`);
  lines.push(`**Date:** ${report.header.createdAt || new Date().toISOString()}`);
  lines.push(`**Classification:** ${report.header.classification || "TLP:AMBER"}`);
  lines.push("\n---\n");

  lines.push("## 1. Executive Summary");
  lines.push(report.executiveSummary || "_No executive summary provided._");
  lines.push("");

  lines.push("## 2. Verdict & Scoping");
  lines.push(`- **Disposition:** ${report.verdict.disposition}`);
  lines.push(`- **Severity:** ${report.verdict.severity}`);
  lines.push(`- **Confidence:** ${report.verdict.confidence}`);
  lines.push(`- **Justification:** ${report.verdict.justification || "N/A"}`);
  lines.push(`- **Affected Assets:** ${(report.scope.affectedAssets ?? []).join(", ") || "None specified"}`);
  lines.push(`- **Affected Users:** ${(report.scope.affectedUsers ?? []).join(", ") || "None specified"}`);
  lines.push("");

  lines.push("## 3. Indicators of Compromise (IoCs)");
  if ((report.iocs?.length ?? 0) === 0) {
    lines.push("_No indicators recorded._");
  } else {
    lines.push("| Type | Indicator Value | Role | Notes |");
    lines.push("| :--- | :--- | :--- | :--- |");
    for (const ioc of report.iocs ?? []) {
      lines.push(`| ${ioc.type} | \`${ioc.value}\` | ${ioc.role} | ${ioc.notes || ""} |`);
    }
  }
  lines.push("");

  lines.push("## 4. Investigation Timeline");
  if ((report.timeline?.length ?? 0) === 0) {
    lines.push("_No milestones recorded._");
  } else {
    lines.push("| Timestamp (UTC) | Description | Origin | Evidence Ref |");
    lines.push("| :--- | :--- | :--- | :--- |");
    for (const row of report.timeline ?? []) {
      lines.push(
        `| ${row.timestampUtc} | ${row.description} | ${row.dataOrigin} | ${row.evidenceRef || ""} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 5. Attack Narrative");
  lines.push(report.attackNarrative || "_No detailed attack narrative provided._");
  lines.push("");

  lines.push("## 6. Escalation & Response Actions");
  lines.push(`- **Escalation Required:** ${report.escalation.requiresEscalation ? "YES" : "NO"}`);
  lines.push(`- **Target Team:** ${report.escalation.targetTeam || "N/A"}`);
  lines.push(`- **Urgency:** ${report.escalation.urgency}`);
  lines.push(`- **Handoff Summary:** ${report.escalation.handoffSummary || "N/A"}`);
  lines.push("");

  if ((report.actions?.length ?? 0) > 0) {
    lines.push("### Response Actions Taken / Recommended");
    for (const act of report.actions ?? []) {
      lines.push(`- **[${act.category}]** ${act.actionName} (Priority: ${act.priority})`);
    }
    lines.push("");
  }

  if (report.lessonsLearned) {
    lines.push("## 7. Lessons Learned & Preventive Recommendations");
    lines.push(report.lessonsLearned);
    lines.push("");
  }

  return lines.join("\n");
}

export function ReportExport({ report, onClose }: Props) {
  const markdownText = generateMarkdownReport(report);

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-report-${report.header.caseId || "export"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report Export"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-mono text-xs"
    >
      <div className="flex w-full max-w-2xl flex-col rounded-xs border border-line bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
              Export Incident Report
            </h2>
            <p className="text-[10px] text-muted">
              Download as standard Markdown or print corporate PDF report
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-sm px-1"
          >
            ✕
          </button>
        </div>

        <div className="my-4">
          <div className="text-[10px] uppercase font-bold text-muted mb-1.5">
            Markdown Preview
          </div>
          <textarea
            readOnly
            value={markdownText}
            className="w-full h-72 rounded-xs border border-line bg-surface-raised p-3 font-mono text-[11px] text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          />
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line bg-surface-raised px-3 py-1 text-muted hover:text-ink"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xs border border-line bg-surface-raised px-3 py-1 font-bold text-ink hover:border-cyan/40"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="rounded-xs border border-cyan bg-cyan/20 px-3.5 py-1 font-bold text-cyan hover:bg-cyan/30"
            >
              Download Markdown (.md)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
