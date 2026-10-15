"use client";

import { useState, useEffect } from "react";
import type { SocSessionClient } from "@/lib/lab-engine/soc/types";
import type { SocReportData, GradingResult } from "@/lib/lab-engine/soc/reports/types";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/defaults";
import { ReportEditor } from "./ReportEditor";
import { GradedResultsScorecard } from "./GradedResultsScorecard";
import { ModelReportComparison } from "./ModelReportComparison";
import { ReportExport } from "./ReportExport";
import { AiFeedbackSection } from "./ai/AiFeedbackSection";
import {
  saveSocReportDraftAction,
  submitSocReportAction,
  getSocReportDraftAction,
  getSocReportResultAction,
} from "@/app/(app)/labs/soc/actions";

interface Props {
  session: SocSessionClient;
  /** Exam mode: "submit" saves the draft; the latest saved draft is graded when the exam is submitted. */
  examMode?: boolean;
}

export function SocReportWorkspace({ session, examMode = false }: Props) {
  const { scenario, attempt } = session;
  const isSubmitted = attempt.status === "submitted";

  const [report, setReport] = useState<SocReportData | null>(null);
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null);
  const [viewMode, setViewMode] = useState<"editor" | "scorecard" | "comparison">("editor");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize or fetch report from server/local
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        // Try fetching saved draft or submission from server action
        const savedDraft = await getSocReportDraftAction(attempt.id);
        if (savedDraft?.reportData && mounted) {
          setReport(savedDraft.reportData);
          if (savedDraft.status === "submitted") {
            const res = await getSocReportResultAction(attempt.id, savedDraft.id);
            if (res && mounted) {
              setGradingResult(res);
              setViewMode("scorecard");
            }
          }
        } else if (mounted) {
          // Initialize new empty scaffold
          const initial = createEmptyReportData(
            "operator-analyst",
            `CASE-${scenario.id.slice(0, 8)}`,
            `Incident Report: ${scenario.title}`,
          );
          setReport(initial);
        }
      } catch {
        if (mounted) {
          const fallback = createEmptyReportData(
            "operator-analyst",
            `CASE-${scenario.id.slice(0, 8)}`,
            `Incident Report: ${scenario.title}`,
          );
          setReport(fallback);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [attempt.id, scenario.id, scenario.title]);

  const handleSaveDraft = async (data: SocReportData) => {
    setReport(data);
    try {
      const res = await saveSocReportDraftAction(attempt.id, data);
      return res.lintResults;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (data: SocReportData) => {
    setReport(data);
    if (examMode && !isSubmitted) {
      await saveSocReportDraftAction(attempt.id, data);
      return;
    }
    const subRes = await submitSocReportAction(attempt.id, data);
    setGradingResult(subRes.gradingResult);
    setViewMode("scorecard");
  };

  if (isLoading || !report) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-xs text-muted">
        Loading incident report workspace...
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 w-full flex-col font-mono text-xs bg-canvas text-ink">
      {examMode && !isSubmitted && (
        <p className="border-b border-line bg-surface px-4 py-2 font-sans text-sm text-secondary">
          Exam: save your draft as you go. Your latest saved draft is graded when you submit the exam; there is no separate report submission and no feedback before then.
        </p>
      )}
      {/* Sub-navigation bar when evaluated */}
      {gradingResult && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("scorecard")}
              className={`rounded-xs px-2.5 py-1 text-xs font-bold uppercase ${
                viewMode === "scorecard"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted hover:text-ink"
              }`}
            >
              Evaluation Scorecard
            </button>
            <button
              type="button"
              onClick={() => setViewMode("comparison")}
              className={`rounded-xs px-2.5 py-1 text-xs font-bold uppercase ${
                viewMode === "comparison"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted hover:text-ink"
              }`}
            >
              Compare with Model Report
            </button>
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`rounded-xs px-2.5 py-1 text-xs font-bold uppercase ${
                viewMode === "editor"
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "text-muted hover:text-ink"
              }`}
            >
              View Submitted Report
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            Export Report
          </button>
        </div>
      )}

      {/* Main Panel Routing */}
      <div className="min-w-0 flex-1 overflow-hidden">
        {viewMode === "editor" && (
          <ReportEditor
            initialReport={report}
            alerts={scenario.alerts}
            onSaveDraft={handleSaveDraft}
            onSubmitReport={handleSubmit}
            disabled={isSubmitted || Boolean(gradingResult)}
          />
        )}

        {viewMode === "scorecard" && gradingResult && (
          <div className="h-full overflow-y-auto p-4 max-w-5xl mx-auto">
            <GradedResultsScorecard
              result={gradingResult}
              onViewComparison={() => setViewMode("comparison")}
              onExportReport={() => setIsExportOpen(true)}
            />
            <div className="mt-6">
              <AiFeedbackSection submissionId={gradingResult.submissionId} report={report} />
            </div>
          </div>
        )}

        {viewMode === "comparison" && gradingResult?.modelReportReveal && (
          <div className="h-full overflow-y-auto p-4 max-w-5xl mx-auto">
            <ModelReportComparison
              studentReport={report}
              modelReport={gradingResult.modelReportReveal}
              onClose={() => setViewMode("scorecard")}
            />
          </div>
        )}
      </div>

      {isExportOpen && (
        <ReportExport report={report} onClose={() => setIsExportOpen(false)} />
      )}
    </div>
  );
}
