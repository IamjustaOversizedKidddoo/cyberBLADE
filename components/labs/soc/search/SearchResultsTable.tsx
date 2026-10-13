"use client";

import { useState, useMemo } from "react";
import type { BladeQLEvent } from "@/lib/lab-engine/soc/query/types";

export interface SearchResultsTableProps {
  events: BladeQLEvent[];
  fields: string[];
  totalScanned: number;
  totalMatched: number;
  truncated: boolean;
  executionDurationMs: number;
  onAddFilter: (field: string, value: string, negate?: boolean) => void;
  onOpenEnrichment?: (target: { type: "ip" | "domain" | "hash" | "user" | "host"; value: string }) => void;
  onAttachEvidence?: (event: BladeQLEvent) => void;
}

export function SearchResultsTable({
  events,
  fields,
  totalScanned,
  totalMatched,
  truncated,
  executionDurationMs,
  onAddFilter,
  onOpenEnrichment,
  onAttachEvidence,
}: SearchResultsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [showChart, setShowChart] = useState<boolean>(true);
  const pageSize = 50;

  // Detect if output is timechart-like (has _time or timestamp bucket and count/sum)
  const isTimechart = useMemo(() => {
    return (
      fields.includes("_time") ||
      (fields.includes("timestamp") && fields.some((f) => f.startsWith("count") || f.startsWith("sum")))
    );
  }, [fields]);

  // Display columns (default subset, prioritize core columns)
  const displayColumns = useMemo(() => {
    const priority = ["timestamp", "source", "action", "outcome", "user", "host", "src_ip", "dest_ip", "count"];
    const ordered = priority.filter((p) => fields.includes(p));
    for (const f of fields) {
      if (!ordered.includes(f) && f !== "_raw" && !f.startsWith("__")) {
        ordered.push(f);
      }
    }
    return ordered.slice(0, 10);
  }, [fields]);

  // Sorting
  const sortedEvents = useMemo(() => {
    if (!sortField) return events;
    return [...events].sort((a, b) => {
      const vA = a[sortField];
      const vB = b[sortField];
      if (vA === vB) return 0;
      if (vA === undefined || vA === null) return 1;
      if (vB === undefined || vB === null) return -1;
      if (typeof vA === "number" && typeof vB === "number") {
        return sortAsc ? vA - vB : vB - vA;
      }
      return sortAsc
        ? String(vA).localeCompare(String(vB))
        : String(vB).localeCompare(String(vA));
    });
  }, [events, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedEvents.length / pageSize) || 1;
  const pagedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, page, pageSize]);

  const handleSort = (col: string) => {
    if (sortField === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(col);
      setSortAsc(true);
    }
  };

  // Safe CSV export with formula injection mitigation
  const handleExportCsv = () => {
    if (events.length === 0) return;

    const sanitizeCsv = (val: any): string => {
      let str = String(val ?? "");
      // Prefix formula injection vectors with single quote
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = displayColumns.map(sanitizeCsv).join(",");
    const rows = events.slice(0, 5000).map((evt) => {
      return displayColumns.map((c) => sanitizeCsv(evt[c])).join(",");
    });

    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bladeql-investigation-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden">
      {/* Table Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line bg-surface-raised text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="font-bold text-ink">
            {events.length.toLocaleString()} results
          </span>
          <span className="text-muted text-[11px]">
            (scanned {totalScanned.toLocaleString()} events in {executionDurationMs}ms)
          </span>
          {truncated && (
            <span className="text-amber-400 font-bold text-[11px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-xs">
              Truncated at budget limit
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isTimechart && (
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink text-[11px]"
            >
              {showChart ? "Hide Visualization" : "Show Visualization"}
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={events.length === 0}
            className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised text-muted hover:text-ink text-[11px] disabled:opacity-40"
            title="Download CSV export with formula-injection escaping"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Timechart Visualization Bar (if applicable) */}
      {isTimechart && showChart && events.length > 0 && (
        <div className="p-3 border-b border-line bg-surface-raised/40 flex flex-col gap-1.5">
          <div className="text-[11px] font-mono text-muted uppercase tracking-wider font-bold">
            Timeline Distribution
          </div>
          <div className="flex items-end gap-1 h-20 w-full overflow-x-auto pt-2">
            {events.slice(0, 30).map((evt, idx) => {
              const val = Number(evt.count ?? evt._count ?? 1);
              const maxVal = Math.max(...events.map((e) => Number(e.count ?? e._count ?? 1))) || 1;
              const heightPct = Math.max(10, Math.round((val / maxVal) * 100));
              const label = String(evt._time ?? evt.timestamp ?? "").slice(11, 16);

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center flex-1 min-w-[24px] group"
                  title={`${label}: ${val} events`}
                >
                  <div
                    className="w-full bg-cyan/70 hover:bg-cyan rounded-t-xs transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] font-mono text-muted truncate mt-1">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Virtualized Table Body */}
      <div className="flex-1 overflow-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted text-xs font-mono">
            <span>No events matched your search pipeline.</span>
            <span className="text-[11px] mt-1 text-muted/80">
              Try widening the time bounds or relaxing field filters.
            </span>
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-xs text-left">
            <thead className="sticky top-0 bg-surface-raised border-b border-line z-10 select-none">
              <tr>
                <th className="w-8 px-2 py-1.5 text-muted text-center">#</th>
                {displayColumns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-2.5 py-1.5 text-muted hover:text-ink cursor-pointer font-bold uppercase tracking-wider text-[11px]"
                    aria-sort={sortField === col ? (sortAsc ? "ascending" : "descending") : "none"}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortField === col && (
                        <span className="text-cyan text-[10px]">{sortAsc ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/30">
              {pagedEvents.map((evt, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                const rowKey = evt.id !== undefined ? String(evt.id) : String(idx);
                const isExpanded = expandedRowId === rowKey;

                return (
                  <tr
                    key={rowKey}
                    className={`hover:bg-surface-raised/60 transition-colors ${
                      isExpanded ? "bg-cyan/5 border-l-2 border-cyan" : ""
                    }`}
                  >
                    <td
                      onClick={() => setExpandedRowId(isExpanded ? null : rowKey)}
                      className="px-2 py-1.5 text-center text-muted/60 cursor-pointer hover:text-cyan text-[11px]"
                    >
                      {isExpanded ? "▼" : rowNum}
                    </td>

                    {displayColumns.map((col) => {
                      const val = evt[col];
                      const valStr = val === undefined || val === null ? "—" : String(val);

                      return (
                        <td
                          key={col}
                          onClick={() => setExpandedRowId(isExpanded ? null : rowKey)}
                          className="px-2.5 py-1.5 truncate max-w-[240px] text-ink cursor-pointer"
                          title={valStr}
                        >
                          {col === "timestamp" ? valStr.replace("T", " ").replace("Z", "") : valStr}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Expanded Row Detail Drawer */}
      {expandedRowId && (() => {
        const selected = events.find((e) => e.id === expandedRowId || String(events.indexOf(e)) === expandedRowId);
        if (!selected) return null;

        return (
          <div className="border-t border-cyan/40 bg-surface-raised p-3 flex flex-col gap-2 max-h-56 overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-line">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan">Event ID: {selected.id}</span>
                <span className="text-muted text-[11px]">{selected.timestamp}</span>
              </div>

              <div className="flex items-center gap-2">
                {onAttachEvidence && (
                  <button
                    type="button"
                    onClick={() => onAttachEvidence(selected)}
                    className="px-2 py-0.5 rounded-xs border border-cyan/40 bg-cyan/15 hover:bg-cyan/25 text-cyan text-[11px] font-bold"
                  >
                    Attach as Evidence
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedRowId(null)}
                  className="text-muted hover:text-ink text-[11px] px-1"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Raw Message View */}
            {selected._raw && (
              <div className="p-2 bg-surface border border-line rounded-xs font-mono text-[11px] text-ink/90 whitespace-pre-wrap break-all">
                {selected._raw}
              </div>
            )}

            {/* Structured Fields Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {Object.entries(selected)
                .filter(([k]) => k !== "_raw" && !k.startsWith("__"))
                .map(([key, val]) => (
                  <div key={key} className="flex flex-col bg-surface p-1.5 rounded-xs border border-line/60">
                    <span className="text-[10px] text-muted uppercase tracking-wider">{key}</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-ink truncate font-semibold" title={String(val)}>
                        {String(val)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => onAddFilter(key, String(val), false)}
                          className="text-cyan hover:text-cyan-bright font-bold text-[11px]"
                          title="Add filter"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddFilter(key, String(val), true)}
                          className="text-danger hover:text-danger-bright font-bold text-[11px]"
                          title="Exclude filter"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })()}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-line bg-surface-raised text-xs font-mono">
          <span className="text-muted text-[11px]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised disabled:opacity-40 text-[11px]"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-0.5 rounded-xs border border-line bg-surface hover:bg-surface-raised disabled:opacity-40 text-[11px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
