"use client";

import { useState, useEffect } from "react";
import { BLADEQL_SPEC } from "@/lib/lab-engine/soc/query/spec";
import { Parser } from "@/lib/lab-engine/soc/query/parser";

export interface TeachingPanelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuery?: string;
  onApplyQuery?: (query: string) => void;
  defaultTab?: "reference" | "examples" | "explain" | "concepts";
}

export function TeachingPanelsModal({
  isOpen,
  onClose,
  currentQuery = "",
  onApplyQuery,
  defaultTab = "reference",
}: TeachingPanelsModalProps) {
  const [activeTab, setActiveTab] = useState<"reference" | "examples" | "explain" | "concepts">(defaultTab);
  const [refSearch, setRefSearch] = useState("");

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  // Generate plain-language deterministic explanation for current query
  const queryExplanation = (() => {
    if (!currentQuery.trim()) {
      return ["No query provided. Type a query in the editor and click Explain."];
    }
    try {
      const parser = new Parser(currentQuery);
      const ast = parser.parse();
      const steps: string[] = [];

      // Base search
      if (ast.baseSearch) {
        steps.push(
          `1. Base Search: Scan log lake and filter records matching the initial search criteria (${currentQuery.split("|")[0].trim() || "all events"}).`,
        );
      }

      // Pipeline commands
      ast.commands.forEach((stage: any, idx: number) => {
        const num = idx + 2;
        switch (stage.type) {
          case "WhereCommand":
            steps.push(`${num}. Filter (where): Keep only rows satisfying the condition expression.`);
            break;
          case "StatsCommand":
            steps.push(
              `${num}. Aggregation (stats): Calculate aggregate metrics (${stage.aggregations.map((a: any) => `${a.fn}(${a.field || "*"})`).join(", ")}) grouped by (${stage.byFields.join(", ") || "entire dataset"}).`,
            );
            break;
          case "SortCommand":
            steps.push(
              `${num}. Ordering (sort): Sort stream by (${stage.fields.map((f: any) => `${f.field} ${f.direction}`).join(", ")}).`,
            );
            break;
          case "HeadCommand":
            steps.push(`${num}. Truncate (head): Restrict results to the top ${stage.limit} events.`);
            break;
          case "TailCommand":
            steps.push(`${num}. Tail: Keep only the last ${stage.limit} events of the stream.`);
            break;
          case "TopCommand":
            steps.push(`${num}. Top Talkers (top): Compute highest-frequency values for field ${stage.field} (limit ${stage.limit}).`);
            break;
          case "RareCommand":
            steps.push(`${num}. Anomaly Detection (rare): Compute lowest-frequency values for field ${stage.field} (limit ${stage.limit}).`);
            break;
          case "TableCommand":
            steps.push(`${num}. Projection (table): Restrict output columns strictly to (${stage.fields.join(", ")}).`);
            break;
          case "FieldsCommand":
            steps.push(
              `${num}. Column Selection (fields): ${stage.mode === "keep" ? "Keep" : "Drop"} fields (${stage.fields.join(", ")}).`,
            );
            break;
          case "EvalCommand":
            steps.push(`${num}. Compute (eval): Compute and assign calculated fields (${stage.assignments.map((a: any) => a.field).join(", ")}).`);
            break;
          case "DedupCommand":
            steps.push(`${num}. Deduplicate (dedup): Discard consecutive duplicates on fields (${stage.fields.join(", ")}).`);
            break;
          case "SessionCommand":
            steps.push(`${num}. Sessionization (session): Cluster events into distinct sessions by ${stage.byField} with maximum gap of ${stage.maxGapSeconds}s.`);
            break;
          default:
            steps.push(`${num}. Pipeline Stage: Execute ${(stage as any).type}.`);
        }
      });

      return steps;
    } catch (err) {
      return [`Unable to parse query for explanation: ${(err as Error).message}`];
    }
  })();

  const EXAMPLES_GALLERY = [
    {
      title: "Failed Authentication Spikes (Brute Force Hunting)",
      category: "Authentication",
      query: 'source="auth" outcome="failure" | stats count by user, src_ip | sort -count | head 10',
      description: "Aggregates failed logons by username and source IP to detect credential spraying.",
    },
    {
      title: "Rare Parent-Child Process Executions",
      category: "Endpoint",
      query: 'source="endpoint" | stats count by parent_process, process | sort count | head 15',
      description: "Hunts for anomalous process hierarchies (e.g. Word or Excel spawning cmd.exe or powershell).",
    },
    {
      title: "Top Outbound Talkers by Bandwidth",
      category: "Network",
      query: 'source="firewall" action="allow" | stats sum(bytes_out) by src_ip, dest_ip | sort -sum(bytes_out) | head 10',
      description: "Isolates hosts pushing large volumes of egress traffic to external IP addresses.",
    },
    {
      title: "Suspicious Script Interpreter Invocations",
      category: "Endpoint",
      query: 'source="endpoint" | where contains(command_line, "powershell") or contains(command_line, "-enc") | table timestamp, user, host, command_line',
      description: "Filters endpoint command-line arguments for encoded commands and script executions.",
    },
    {
      title: "High-Frequency Beaconing Detection",
      category: "Network",
      query: 'source="proxy" | stats count, dc(url) by domain | where count > 50 and "dc(url)" < 3 | sort -count',
      description: "Finds domains receiving repetitive requests with minimal URL diversity.",
    },
    {
      title: "Session Duration Clustering",
      category: "Identity",
      query: 'source="auth" outcome="success" | session by user maxgap=15m | table user, session_id, event_count, duration_seconds',
      description: "Reconstructs continuous user sign-in activity windows separated by 15 minutes of inactivity.",
    },
  ];

  const CONCEPT_MAPPINGS = [
    {
      concept: "Filter Events",
      bladeql: 'where outcome="failure" and bytes_out > 5000',
      spl: 'where outcome="failure" AND bytes_out > 5000',
      kql: 'where outcome == "failure" and bytes_out > 5000',
      notes: "BladeQL uses clean SQL/KQL-style equality and boolean operators.",
    },
    {
      concept: "Aggregate Metrics by Group",
      bladeql: "stats count, dc(user) by src_ip",
      spl: "stats count, dc(user) by src_ip",
      kql: "summarize count(), dcount(user) by src_ip",
      notes: "Equivalent to summarize in KQL and stats in SPL.",
    },
    {
      concept: "Sort Stream Descending",
      bladeql: "sort -count",
      spl: "sort -count",
      kql: "order by count desc",
      notes: "Prefix `-` signifies descending ordering in BladeQL and SPL.",
    },
    {
      concept: "Limit Results to Top N",
      bladeql: "head 10",
      spl: "head 10",
      kql: "take 10 / limit 10",
      notes: "BladeQL supports both `head N` and `limit N`.",
    },
    {
      concept: "Computed Field",
      bladeql: 'eval total_kb = round(bytes_out / 1024, 2)',
      spl: 'eval total_kb = round(bytes_out / 1024, 2)',
      kql: 'extend total_kb = round(bytes_out / 1024.0, 2)',
      notes: "Pure mathematical evaluation with safe built-in functions.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BladeQL Language & Reference Help"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="flex flex-col bg-surface border border-line rounded-xs shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">BladeQL Reference & Guidance</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface text-cyan border border-cyan/40 rounded-xs">
              v1.0.0
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink font-bold text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-line bg-surface px-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("reference")}
            className={`py-2 px-3 border-b-2 font-bold transition-colors ${
              activeTab === "reference"
                ? "border-cyan text-cyan"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Command Reference
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("examples")}
            className={`py-2 px-3 border-b-2 font-bold transition-colors ${
              activeTab === "examples"
                ? "border-cyan text-cyan"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Hunting Gallery
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("explain")}
            className={`py-2 px-3 border-b-2 font-bold transition-colors ${
              activeTab === "explain"
                ? "border-cyan text-cyan"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Explain Query
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("concepts")}
            className={`py-2 px-3 border-b-2 font-bold transition-colors ${
              activeTab === "concepts"
                ? "border-cyan text-cyan"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Concept Mapping
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 text-xs font-mono">
          {/* TAB 1: REFERENCE */}
          {activeTab === "reference" && (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                placeholder="Search commands and functions..."
                className="w-full px-3 py-1.5 bg-surface-raised border border-line rounded-xs text-xs font-mono outline-none focus:border-cyan text-ink"
              />

              <div className="flex flex-col gap-3">
                <div className="text-cyan font-bold uppercase tracking-wider text-[11px]">
                  Pipeline Commands
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(Object.entries(BLADEQL_SPEC.commands) as [string, any][])
                    .filter(
                      ([cmd, spec]) =>
                        cmd.toLowerCase().includes(refSearch.toLowerCase()) ||
                        spec.summary.toLowerCase().includes(refSearch.toLowerCase()),
                    )
                    .map(([cmd, spec]) => (
                      <div key={cmd} className="bg-surface-raised p-2.5 rounded-xs border border-line flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan text-sm">{cmd}</span>
                          <span className="text-[10px] text-muted">{spec.category}</span>
                        </div>
                        <div className="text-ink/80 text-[11px]">{spec.summary}</div>
                        <div className="bg-surface p-1.5 rounded-xs border border-line/40 text-[10px] text-amber-400 mt-1">
                          {spec.syntax}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] mt-2">
                  Built-in Eval & Aggregation Functions
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(Object.entries(BLADEQL_SPEC.functions) as [string, any][])
                    .filter(
                      ([fn, spec]) =>
                        fn.toLowerCase().includes(refSearch.toLowerCase()) ||
                        spec.summary.toLowerCase().includes(refSearch.toLowerCase()),
                    )
                    .map(([fn, spec]) => (
                      <div key={fn} className="bg-surface-raised p-2.5 rounded-xs border border-line flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400">{fn}()</span>
                          <span className="text-[10px] text-muted">{spec.returnType}</span>
                        </div>
                        <div className="text-ink/80 text-[11px]">{spec.summary}</div>
                        <div className="bg-surface p-1 rounded-xs border border-line/40 text-[10px] text-muted">
                          {spec.signature}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXAMPLES */}
          {activeTab === "examples" && (
            <div className="flex flex-col gap-3">
              <div className="text-muted text-[11px]">
                Pre-built scenario-agnostic hunting pipelines. Click "Apply" to load directly into the query editor.
              </div>
              {EXAMPLES_GALLERY.map((ex) => (
                <div key={ex.title} className="bg-surface-raised p-3 rounded-xs border border-line flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{ex.title}</span>
                    <span className="text-[10px] text-cyan px-1.5 py-0.5 bg-cyan/10 border border-cyan/30 rounded-xs">
                      {ex.category}
                    </span>
                  </div>
                  <div className="text-muted text-[11px]">{ex.description}</div>
                  <div className="flex items-center justify-between bg-surface p-2 rounded-xs border border-line/60">
                    <span className="text-cyan truncate text-[11px]">{ex.query}</span>
                    {onApplyQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyQuery(ex.query);
                          onClose();
                        }}
                        className="ml-2 px-2 py-0.5 rounded-xs border border-cyan bg-cyan/20 hover:bg-cyan/30 text-cyan text-[11px] font-bold shrink-0"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: EXPLAIN */}
          {activeTab === "explain" && (
            <div className="flex flex-col gap-3">
              <div className="text-muted text-[11px]">
                Deterministic step-by-step breakdown of current query pipeline:
              </div>
              <div className="bg-surface-raised p-3 rounded-xs border border-line font-mono text-cyan text-xs">
                {currentQuery || "<no query>"}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {queryExplanation.map((step, idx) => (
                  <div key={idx} className="bg-surface p-2.5 rounded-xs border border-line/70 text-ink leading-5">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CONCEPTS */}
          {activeTab === "concepts" && (
            <div className="flex flex-col gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xs text-amber-300 text-[11px]">
                <strong>Notice:</strong> Concept mappings are approximate pedagogical comparisons to assist learners with prior SPL or KQL background. BladeQL is an independent, original language designed specifically for CyberBLADE.
              </div>

              <div className="flex flex-col gap-3">
                {CONCEPT_MAPPINGS.map((item) => (
                  <div key={item.concept} className="bg-surface-raised p-3 rounded-xs border border-line flex flex-col gap-2">
                    <span className="font-bold text-ink">{item.concept}</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-surface p-2 rounded-xs border border-cyan/40">
                        <div className="text-cyan text-[10px] font-bold mb-1">BladeQL</div>
                        <div>{item.bladeql}</div>
                      </div>
                      <div className="bg-surface p-2 rounded-xs border border-line/60">
                        <div className="text-muted text-[10px] font-bold mb-1">Approx. SPL</div>
                        <div>{item.spl}</div>
                      </div>
                      <div className="bg-surface p-2 rounded-xs border border-line/60">
                        <div className="text-muted text-[10px] font-bold mb-1">Approx. KQL</div>
                        <div>{item.kql}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted italic">{item.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
