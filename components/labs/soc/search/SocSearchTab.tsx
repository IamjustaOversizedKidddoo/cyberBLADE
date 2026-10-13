"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import type { SocScenario } from "@/lib/lab-engine/soc/schema";
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

export interface SocSearchTabProps {
  scenario: SocScenario;
  attemptId: string;
  seed?: string;
  onOpenEnrichment?: (target: { type: "ip" | "domain" | "hash" | "user" | "host"; value: string }) => void;
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
  const [dataset, setDataset] = useState<ScenarioDataset | null>(null);
  const [questions, setQuestions] = useState<LearnerQuestion[]>([]);
  const [searchResult, setSearchResult] = useState<QueryExecutionResult | null>(null);
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

  // Initialize dataset & investigation questions
  useEffect(() => {
    try {
      const ds = generateScenarioDataset(scenario, seed, 5000);
      setDataset(ds);

      const qs = generateScenarioQuestions(scenario, seed);
      setQuestions(qs.learnerQuestions);

      // Run initial default query
      const initialRes = executeBladeQL('source="auth" | stats count by outcome', ds.events);
      setSearchResult(initialRes);
    } catch (err) {
      console.error("Failed to initialize BladeQL log search:", err);
    }
  }, [scenario, seed]);

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
            onOpenEnrichment={onOpenEnrichment}
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
