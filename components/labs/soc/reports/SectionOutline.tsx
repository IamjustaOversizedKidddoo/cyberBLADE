"use client";

import type { SocReportData, PreSubmitLintResult } from "@/lib/lab-engine/soc/reports/types";

export interface ReportSectionDef {
  id: string;
  label: string;
  required: boolean;
  isComplete: (data: SocReportData) => boolean;
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    id: "header",
    label: "Incident Header",
    required: true,
    isComplete: (d) => Boolean(d.header?.title && d.header.title.trim().length >= 5),
  },
  {
    id: "executive-summary",
    label: "Executive Summary",
    required: true,
    isComplete: (d) => Boolean(d.executiveSummary && d.executiveSummary.trim().length >= 30),
  },
  {
    id: "verdict-scope",
    label: "Verdict & Scope",
    required: true,
    isComplete: (d) =>
      Boolean(
        d.verdict?.disposition &&
          d.verdict?.severity &&
          d.scope?.affectedAssets?.length > 0,
      ),
  },
  {
    id: "iocs",
    label: "Indicators of Compromise",
    required: true,
    isComplete: (d) => (d.iocs?.length ?? 0) > 0,
  },
  {
    id: "timeline",
    label: "Investigation Timeline",
    required: true,
    isComplete: (d) => (d.timeline?.length ?? 0) > 0,
  },
  {
    id: "techniques-actions",
    label: "ATT&CK & Response Actions",
    required: true,
    isComplete: (d) => (d.techniques?.length ?? 0) > 0 && (d.actions?.length ?? 0) > 0,
  },
  {
    id: "narrative",
    label: "Attack Narrative & Escalation",
    required: true,
    isComplete: (d) => Boolean(d.attackNarrative && d.attackNarrative.trim().length >= 50),
  },
  {
    id: "evidence",
    label: "Evidence Appendix",
    required: false,
    isComplete: (d) => (d.evidenceAppendix?.length ?? 0) > 0,
  },
];

interface Props {
  data: SocReportData;
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  lintResult?: PreSubmitLintResult | null;
}

export function SectionOutline({
  data,
  activeSectionId,
  onSelectSection,
  lintResult,
}: Props) {
  return (
    <nav
      aria-label="Report section navigation"
      className="flex flex-col gap-1 text-xs font-mono"
    >
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
        Report Sections
      </div>

      {REPORT_SECTIONS.map((sec) => {
        const complete = sec.isComplete(data);
        const isActive = activeSectionId === sec.id;
        const sectionErrors = (lintResult?.errors ?? []).filter((e) => e.sectionId === sec.id);

        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => onSelectSection(sec.id)}
            className={`flex items-center justify-between rounded-xs px-2.5 py-1.5 text-left transition-colors ${
              isActive
                ? "bg-cyan/15 text-cyan border-l-2 border-cyan font-bold"
                : "text-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <span className="truncate">{sec.label}</span>
            <div className="flex items-center gap-1.5 ml-2">
              {sectionErrors.length > 0 ? (
                <span
                  title={`${sectionErrors.length} issue(s)`}
                  className="inline-flex h-2 w-2 rounded-full bg-error"
                />
              ) : complete ? (
                <span
                  title="Completed"
                  className="inline-flex h-2 w-2 rounded-full bg-success"
                />
              ) : sec.required ? (
                <span
                  title="Required section incomplete"
                  className="inline-flex h-2 w-2 rounded-full bg-warning"
                />
              ) : (
                <span
                  title="Optional"
                  className="inline-flex h-2 w-2 rounded-full bg-muted/40"
                />
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
