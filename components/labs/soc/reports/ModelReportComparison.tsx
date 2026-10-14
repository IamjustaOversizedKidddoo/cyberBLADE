"use client";

import { useState } from "react";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

interface Props {
  studentReport: SocReportData;
  modelReport: SocReportData;
  onClose: () => void;
}

export function ModelReportComparison({ studentReport, modelReport, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"verdict" | "iocs" | "timeline" | "narrative">("verdict");

  return (
    <div className="flex flex-col gap-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            Model Report Comparative Review
          </h2>
          <p className="text-[11px] text-muted">
            Compare your investigation claims side-by-side against the expert model report
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-line bg-surface-raised px-3 py-1 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          Back to Scorecard
        </button>
      </div>

      {/* Comparison Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        {(["verdict", "iocs", "timeline", "narrative"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xs px-2.5 py-1 text-xs uppercase font-bold transition-colors ${
              activeTab === tab
                ? "bg-cyan/20 text-cyan border border-cyan/40"
                : "text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === "verdict" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xs border border-line bg-surface p-3 flex flex-col gap-2">
            <div className="text-[10px] uppercase font-bold text-muted border-b border-line pb-1">
              Your Submission
            </div>
            <div>
              <span className="text-muted mr-2">Disposition:</span>
              <span className="font-bold text-ink">{studentReport.verdict.disposition}</span>
            </div>
            <div>
              <span className="text-muted mr-2">Severity:</span>
              <span className="font-bold text-ink">{studentReport.verdict.severity}</span>
            </div>
            <div>
              <span className="text-muted mr-2">Confidence:</span>
              <span className="text-ink">{studentReport.verdict.confidence}</span>
            </div>
            <div className="pt-2 text-muted">
              <span className="block font-bold mb-1">Your Justification:</span>
              <p className="text-ink bg-surface-raised p-2 rounded-xs">
                {studentReport.verdict.justification || "No justification provided."}
              </p>
            </div>
            <div className="pt-2">
              <span className="block font-bold text-muted mb-1">Affected Assets Scoped:</span>
              <div className="flex flex-wrap gap-1">
                {(studentReport.scope.affectedAssets ?? []).map((a) => (
                  <span key={a} className="rounded-xs bg-surface-raised px-1.5 py-0.5 border border-line">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xs border border-success/40 bg-surface p-3 flex flex-col gap-2">
            <div className="text-[10px] uppercase font-bold text-success border-b border-success/30 pb-1">
              Exemplary Model Report
            </div>
            <div>
              <span className="text-muted mr-2">Disposition:</span>
              <span className="font-bold text-success">{modelReport.verdict.disposition}</span>
            </div>
            <div>
              <span className="text-muted mr-2">Severity:</span>
              <span className="font-bold text-success">{modelReport.verdict.severity}</span>
            </div>
            <div>
              <span className="text-muted mr-2">Confidence:</span>
              <span className="text-ink">{modelReport.verdict.confidence}</span>
            </div>
            <div className="pt-2 text-muted">
              <span className="block font-bold mb-1">Model Justification:</span>
              <p className="text-ink bg-surface-raised p-2 rounded-xs">
                {modelReport.verdict.justification}
              </p>
            </div>
            <div className="pt-2">
              <span className="block font-bold text-muted mb-1">True Affected Assets:</span>
              <div className="flex flex-wrap gap-1">
                {(modelReport.scope.affectedAssets ?? []).map((a) => (
                  <span key={a} className="rounded-xs bg-success/10 text-success px-1.5 py-0.5 border border-success/30 font-bold">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "iocs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xs border border-line bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-muted border-b border-line pb-1 mb-2">
              Your Indicators ({studentReport.iocs?.length ?? 0})
            </div>
            <ul className="space-y-1.5">
              {(studentReport.iocs ?? []).map((ioc) => (
                <li key={ioc.id} className="rounded-xs bg-surface-raised p-1.5 flex justify-between">
                  <span className="font-mono text-ink">{ioc.value}</span>
                  <span className="text-muted text-[10px]">{ioc.role}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xs border border-success/40 bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-success border-b border-success/30 pb-1 mb-2">
              Model Indicators ({modelReport.iocs?.length ?? 0})
            </div>
            <ul className="space-y-1.5">
              {(modelReport.iocs ?? []).map((ioc) => (
                <li key={ioc.id} className="rounded-xs bg-success/10 border border-success/30 p-1.5 flex justify-between">
                  <span className="font-mono text-success font-bold">{ioc.value}</span>
                  <span className="text-muted text-[10px]">{ioc.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xs border border-line bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-muted border-b border-line pb-1 mb-2">
              Your Timeline ({studentReport.timeline?.length ?? 0})
            </div>
            <div className="space-y-2">
              {(studentReport.timeline ?? []).map((row) => (
                <div key={row.id} className="rounded-xs bg-surface-raised p-2">
                  <div className="text-cyan text-[10px] font-bold">{row.timestampUtc}</div>
                  <div className="text-ink text-[11px] mt-0.5">{row.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xs border border-success/40 bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-success border-b border-success/30 pb-1 mb-2">
              Model Milestones ({modelReport.timeline?.length ?? 0})
            </div>
            <div className="space-y-2">
              {(modelReport.timeline ?? []).map((row) => (
                <div key={row.id} className="rounded-xs bg-success/5 border border-success/20 p-2">
                  <div className="text-success text-[10px] font-bold">{row.timestampUtc}</div>
                  <div className="text-ink text-[11px] mt-0.5">{row.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "narrative" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xs border border-line bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-muted border-b border-line pb-1 mb-2">
              Your Attack Narrative
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">
              {studentReport.attackNarrative || "No narrative provided."}
            </p>
          </div>

          <div className="rounded-xs border border-success/40 bg-surface p-3">
            <div className="text-[10px] uppercase font-bold text-success border-b border-success/30 pb-1 mb-2">
              Model Attack Narrative
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-wrap">
              {modelReport.attackNarrative}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
