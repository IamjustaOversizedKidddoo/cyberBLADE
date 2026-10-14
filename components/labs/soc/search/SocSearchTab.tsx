"use client";

import { useState, useCallback, useMemo } from "react";
import type { SocScenario, SocScenarioClient } from "@/lib/lab-engine/soc/schema";
import type { BladeQLEvent, QueryExecutionResult } from "@/lib/lab-engine/soc/query/types";
import { executeBladeQL } from "@/lib/lab-engine/soc/query/engine";
import { generateScenarioDataset, type ScenarioDataset } from "@/lib/lab-engine/soc/query/dataset-generator";
import { generateScenarioQuestions, type LearnerQuestion } from "@/lib/lab-engine/soc/query/questions";

import { BladeQLEditor } from "./BladeQLEditor";
import { QueryTimeControls, type TimeRangeConfig } from "./QueryTimeControls";
import { FieldSidebar } from "./FieldSidebar";
import { SearchResultsTable } from "./SearchResultsTable";
import { InvestigationQuestionsPanel } from "./InvestigationQuestionsPanel";
import { TeachingPanelsModal } from "./TeachingPanelsModal";
import type { InvestigationTarget } from "../enrichment/EnrichmentWorkbenchDrawer";

export interface SocSearchTabProps {
  scenario: SocScenarioClient;
  attemptId: string;
  seed?: string;
  onOpenEnrichment?: (target: InvestigationTarget) => void;
  onAttachEvidence?: (event: BladeQLEvent) => void;
}

export function SocSearchTab({
  scenario,
  attemptId,
  seed = "demo-seed-1",
  onOpenEnrichment,
  onAttachEvidence,
}: SocSearchTabProps) {
  const [query, setQuery] = useState('source="auth" | stats count by outcome');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [queriedResult, setSearchResult] = useState<QueryExecutionResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTeachingOpen, setIsTeachingOpen] = useState(false);
  const [teachingTab, setTeachingTab] = useState<"reference" | "examples" | "explain" | "concepts">("reference");
  const [mobileSubTab, setMobileSubTab] = useState<"editor" | "fields" | "questions">("editor");
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(true);

  const [timeConfig, setTimeConfig] = useState<TimeRangeConfig>({
    preset: "all",
    useUtc: true,
  });

  const scenarioNowIso = scenario.rawEvents[scenario.rawEvents.length - 1]?.timestamp ?? "2026-10-12T16:00:00Z";

  // Dataset, questions and the default query result are pure functions of (scenario, seed).
  const initial = useMemo((): {
    dataset: ScenarioDataset;
    questions: LearnerQuestion[];
    result: QueryExecutionResult;
  } | null => {
    try {
      // shortcut: generates from the client view in the browser, so question truths ship to the client
      // (handoff-status S7); move dataset + questions server-side before beta.
      const full = scenario as unknown as SocScenario;
      const ds = generateScenarioDataset(full, seed, 5000);
      const qs = generateScenarioQuestions(full, seed);
      const initialRes = executeBladeQL('source="auth" | stats count by outcome', ds.events);
      return { dataset: ds, questions: qs.learnerQuestions, result: initialRes };
    } catch (err) {
      console.error("Failed to initialize BladeQL log search:", err);
      return null;
    }
  }, [scenario, seed]);
  const dataset = initial?.dataset ?? null;
  const questions = useMemo(() => initial?.questions ?? [], [initial]);

  // A new (scenario, seed) resets the shown result back to the default query.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSearchResult(null);
  }
  const searchResult = queriedResult ?? initial?.result ?? null;

  // Execute current query
  const handleExecuteQuery = useCallback(() => {
    if (!dataset) return;
    setIsLoading(true);
    setQueryError(null);

    try {
      // Filter by time config if specified
      let eventsToScan = dataset.events;
      if (timeConfig.earliestEpochMs !== undefined) {
        eventsToScan = eventsToScan.filter((e) => {
          const t = new Date(String(e.timestamp)).getTime();
          return t >= timeConfig.earliestEpochMs!;
        });
      }

      const res = executeBladeQL(query, eventsToScan, {
        scenarioNowEpochMs: new Date(scenarioNowIso).getTime(),
      });

      setSearchResult(res);
      setQueryHistory((prev) => (prev.includes(query) ? prev : [...prev, query]));
    } catch (err) {
      setQueryError((err as Error).message || "Query execution failed.");
    } finally {
      setIsLoading(false);
    }
  }, [dataset, query, timeConfig, scenarioNowIso]);

  // Add field filter to query string
  const handleAddFilter = useCallback((field: string, value: string, negate = false) => {
    setQuery((prev) => {
      const cleanVal = value.includes(" ") ? `"${value}"` : `"${value}"`;
      const op = negate ? "!=" : "=";
      const clause = `where ${field}${op}${cleanVal}`;

      if (prev.includes("|")) {
        return `${prev} | ${clause}`;
      } else {
        return `${prev} ${clause}`;
      }
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
      {/* Search Header Bar & Teaching Shortcuts */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line bg-surface text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold text-cyan">BladeQL Hunting Engine</span>
          <span className="text-muted text-[11px] hidden sm:inline">
            ({dataset?.eventCount.toLocaleString() ?? "..."} raw events indexed)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTeachingTab("reference");
              setIsTeachingOpen(true);
            }}
            className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink text-[11px]"
          >
            Language Reference
          </button>
          <button
            type="button"
            onClick={() => {
              setTeachingTab("examples");
              setIsTeachingOpen(true);
            }}
            className="px-2 py-0.5 rounded-xs border border-cyan/40 bg-cyan/10 hover:bg-cyan/20 text-cyan text-[11px] font-bold"
          >
            Examples Gallery
          </button>
          <button
            type="button"
            onClick={() => setShowQuestionsPanel(!showQuestionsPanel)}
            className={`px-2 py-0.5 rounded-xs border text-[11px] font-bold ${
              showQuestionsPanel
                ? "border-cyan/50 bg-cyan/20 text-cyan"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            Objectives ({questions.filter((q) => q.status === "correct").length}/{questions.length})
          </button>
        </div>
      </div>

      {/* Time Controls Bar */}
      <QueryTimeControls
        timeConfig={timeConfig}
        onChange={setTimeConfig}
        scenarioNowIso={scenarioNowIso}
      />

      {/* Query Monospace Editor */}
      <div className="p-2 border-b border-line bg-surface shrink-0">
        <BladeQLEditor
          value={query}
          onChange={setQuery}
          onExecute={handleExecuteQuery}
          onExplain={() => {
            setTeachingTab("explain");
            setIsTeachingOpen(true);
          }}
          availableFields={dataset?.fields || []}
          isLoading={isLoading}
          error={queryError}
          history={queryHistory}
        />
      </div>

      {/* Mobile Subtab Switcher (Visible only below md) */}
      <div className="md:hidden flex border-b border-line bg-surface p-1 gap-1 text-xs shrink-0">
        <button
          type="button"
          onClick={() => setMobileSubTab("editor")}
          className={`flex-1 py-1.5 text-center font-bold rounded-xs ${
            mobileSubTab === "editor" ? "bg-cyan/15 text-cyan" : "text-muted"
          }`}
        >
          Results ({searchResult?.events.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setMobileSubTab("fields")}
          className={`flex-1 py-1.5 text-center font-bold rounded-xs ${
            mobileSubTab === "fields" ? "bg-cyan/15 text-cyan" : "text-muted"
          }`}
        >
          Fields ({dataset?.fields.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setMobileSubTab("questions")}
          className={`flex-1 py-1.5 text-center font-bold rounded-xs ${
            mobileSubTab === "questions" ? "bg-cyan/15 text-cyan" : "text-muted"
          }`}
        >
          Questions ({questions.length})
        </button>
      </div>

      {/* Main Multi-Pane Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Field Sidebar */}
        <div className={`md:flex ${mobileSubTab === "fields" ? "flex w-full" : "hidden md:flex"}`}>
          <FieldSidebar
            events={searchResult?.events || []}
            availableFields={dataset?.fields || []}
            onAddFilter={handleAddFilter}
          />
        </div>

        {/* Center Pane: Results Table */}
        <div className={`flex-1 flex flex-col ${mobileSubTab === "editor" ? "flex" : "hidden md:flex"}`}>
          <SearchResultsTable
            events={searchResult?.events || []}
            fields={searchResult?.fields || []}
            totalScanned={searchResult?.totalScanned || 0}
            totalMatched={searchResult?.totalMatched || 0}
            truncated={searchResult?.truncated || false}
            executionDurationMs={searchResult?.executionDurationMs || 0}
            onAddFilter={handleAddFilter}
            onOpenEnrichment={
              onOpenEnrichment &&
              ((t) =>
                onOpenEnrichment({
                  tool: t.type === "hash" ? "sandbox" : t.type === "user" || t.type === "host" ? "cmdb" : "reputation",
                  entityType: t.type,
                  entityValue: t.value,
                }))
            }
            onAttachEvidence={onAttachEvidence}
          />
        </div>

        {/* Right Pane: Investigation Questions */}
        {showQuestionsPanel && (
          <div className={`md:flex ${mobileSubTab === "questions" ? "flex w-full" : "hidden md:flex"}`}>
            <InvestigationQuestionsPanel
              questions={questions}
              attemptId={attemptId}
              scenarioId={scenario.id}
              seed={seed}
              onApplyReferenceQuery={(refQ) => setQuery(refQ)}
            />
          </div>
        )}
      </div>

      {/* Teaching & Reference Modal */}
      <TeachingPanelsModal
        isOpen={isTeachingOpen}
        onClose={() => setIsTeachingOpen(false)}
        currentQuery={query}
        onApplyQuery={(q) => setQuery(q)}
        defaultTab={teachingTab}
      />
    </div>
  );
}
