"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { SocAlertClient } from "@/lib/lab-engine/soc/schema";
import type { SocDecisionRecord } from "@/lib/lab-engine/soc/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { IconSearch, IconAlertTriangle, IconCheck, IconChevronDown } from "@/components/ui/icons";

const ROW_HEIGHT = 42;
const OVERSCAN = 5;

type SortField = "timestamp" | "severity" | "source" | "ruleName" | "status";
type SortOrder = "asc" | "desc";

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

type Props = {
  alerts: SocAlertClient[];
  decisions: Record<string, SocDecisionRecord>;
  selectedAlertId: string | null;
  onSelectAlert: (alertId: string) => void;
  onBulkDecide?: (alertIds: string[]) => void;
};

export function AlertQueueTable({
  alerts,
  decisions,
  selectedAlertId,
  onSelectAlert,
  onBulkDecide,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);

  // Measure container height
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Distinct sources for dropdown
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const a of alerts) set.add(a.source);
    return Array.from(set).sort();
  }, [alerts]);

  // Alert status resolver
  const getAlertStatus = useCallback(
    (alertId: string): "untriaged" | "decided" | "escalated" => {
      const decision = decisions[alertId];
      if (!decision) return "untriaged";
      if (decision.escalate) return "escalated";
      return "decided";
    },
    [decisions],
  );

  // Filtered and sorted alerts
  const processedAlerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = alerts.filter((alert) => {
      // Source filter
      if (sourceFilter !== "ALL" && alert.source !== sourceFilter) return false;

      // Severity filter
      if (severityFilter !== "ALL" && alert.severity !== severityFilter) return false;

      // Status filter
      const status = getAlertStatus(alert.id);
      if (statusFilter !== "ALL") {
        if (statusFilter === "UNTRIAGED" && status !== "untriaged") return false;
        if (statusFilter === "DECIDED" && status !== "decided") return false;
        if (statusFilter === "ESCALATED" && status !== "escalated") return false;
      }

      // Search query
      if (q) {
        const matchesRule = alert.ruleName.toLowerCase().includes(q);
        const matchesSummary = alert.summary.toLowerCase().includes(q);
        const matchesAsset = alert.relatedAsset?.toLowerCase().includes(q);
        const matchesUser = alert.relatedUser?.toLowerCase().includes(q);
        const matchesSource = alert.source.toLowerCase().includes(q);
        if (!matchesRule && !matchesSummary && !matchesAsset && !matchesUser && !matchesSource) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === "timestamp") {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === "severity") {
        cmp = (SEVERITY_WEIGHT[a.severity] ?? 0) - (SEVERITY_WEIGHT[b.severity] ?? 0);
      } else if (sortField === "source") {
        cmp = a.source.localeCompare(b.source);
      } else if (sortField === "ruleName") {
        cmp = a.ruleName.localeCompare(b.ruleName);
      } else if (sortField === "status") {
        const sa = getAlertStatus(a.id);
        const sb = getAlertStatus(b.id);
        cmp = sa.localeCompare(sb);
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [
    alerts,
    searchQuery,
    sourceFilter,
    severityFilter,
    statusFilter,
    sortField,
    sortOrder,
    getAlertStatus,
  ]);

  // Virtual windowing calculations
  const totalCount = processedAlerts.length;
  const totalHeight = totalCount * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleAlerts = processedAlerts.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  // Sorting toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Quick navigation: next untriaged
  const handleSelectNextUntriaged = () => {
    const next = alerts.find((a) => !decisions[a.id]);
    if (next) {
      onSelectAlert(next.id);
      // Scroll to row
      const idx = processedAlerts.findIndex((a) => a.id === next.id);
      if (idx !== -1 && containerRef.current) {
        containerRef.current.scrollTop = Math.max(0, idx * ROW_HEIGHT - 100);
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Avoid triggering when focused in an input
    const targetTag = (e.target as HTMLElement).tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") return;

    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentIdx = processedAlerts.findIndex((a) => a.id === selectedAlertId);
      if (currentIdx < processedAlerts.length - 1) {
        const nextAlert = processedAlerts[currentIdx + 1];
        onSelectAlert(nextAlert.id);
      }
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentIdx = processedAlerts.findIndex((a) => a.id === selectedAlertId);
      if (currentIdx > 0) {
        const prevAlert = processedAlerts[currentIdx - 1];
        onSelectAlert(prevAlert.id);
      }
    } else if (e.key === "/" && searchInputRef.current) {
      e.preventDefault();
      searchInputRef.current.focus();
    } else if (e.key === "u") {
      e.preventDefault();
      handleSelectNextUntriaged();
    }
  };

  // Bulk selection toggles
  const toggleSelectAll = () => {
    if (selectedBulkIds.size === processedAlerts.length && processedAlerts.length > 0) {
      setSelectedBulkIds(new Set());
    } else {
      setSelectedBulkIds(new Set(processedAlerts.map((a) => a.id)));
    }
  };

  const toggleSelectRow = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(selectedBulkIds);
    if (updated.has(alertId)) updated.delete(alertId);
    else updated.add(alertId);
    setSelectedBulkIds(updated);
  };

  const severityBadge = (sev: string): { variant: BadgeVariant; icon: string } => {
    switch (sev) {
      case "CRITICAL":
        return { variant: "danger", icon: "🔴" };
      case "HIGH":
        return { variant: "amber", icon: "🟠" };
      case "MEDIUM":
        return { variant: "cyan", icon: "🟡" };
      case "LOW":
        return { variant: "outline", icon: "🔵" };
      default:
        return { variant: "outline", icon: "⚪" };
    }
  };

  const untriagedCount = alerts.filter((a) => !decisions[a.id]).length;
  const decidedCount = alerts.filter((a) => decisions[a.id] && !decisions[a.id].escalate).length;
  const escalatedCount = alerts.filter((a) => decisions[a.id]?.escalate).length;

  return (
    <div
      className="flex flex-col h-full border border-line bg-console rounded-sm select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Alert Queue Management"
    >
      {/* Top Filter and Search Bar */}
      <div className="p-3 border-b border-line bg-surface/80 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Metric Pills */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted">Queue:</span>
            <span className="px-2 py-0.5 rounded-xs bg-surface-raised border border-line font-bold text-ink">
              {alerts.length} Total
            </span>
            <span className="px-2 py-0.5 rounded-xs bg-warning/10 border border-warning/30 text-warning font-semibold">
              {untriagedCount} Untriaged
            </span>
            <span className="px-2 py-0.5 rounded-xs bg-danger/10 border border-danger/30 text-danger font-semibold">
              {escalatedCount} Escalated
            </span>
            <span className="px-2 py-0.5 rounded-xs bg-success/10 border border-success/30 text-success font-semibold">
              {decidedCount} Closed
            </span>
          </div>

          {/* Quick Untriaged Shortcut */}
          <button
            type="button"
            onClick={handleSelectNextUntriaged}
            disabled={untriagedCount === 0}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-[11px] font-mono font-semibold text-cyan hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            title="Jump to next untriaged alert (shortcut: u)"
          >
            Next Untriaged [u]
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <IconSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts... (/)"
              aria-label="Search alerts"
              className="w-full rounded-xs border border-line bg-console pl-8 pr-2.5 py-1.5 text-xs text-ink placeholder:text-muted focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
          </div>

          {/* Source Dropdown */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xs border border-line bg-console px-2 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Filter alerts by detection source"
          >
            <option value="ALL">All Sources ({alerts.length})</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Severity Dropdown */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xs border border-line bg-console px-2 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Filter alerts by severity"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Informational</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xs border border-line bg-console px-2 py-1.5 text-xs text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Filter alerts by triage status"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNTRIAGED">Untriaged Only</option>
            <option value="ESCALATED">Escalated Only</option>
            <option value="DECIDED">Decided Only</option>
          </select>
        </div>

        {/* Bulk Action Bar (when alerts are selected) */}
        {selectedBulkIds.size > 0 && (
          <div className="flex items-center justify-between rounded-xs border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs font-mono text-cyan">
            <span>{selectedBulkIds.size} alert(s) selected</span>
            {onBulkDecide && (
              <button
                type="button"
                onClick={() => onBulkDecide(Array.from(selectedBulkIds))}
                className="rounded-xs border border-cyan bg-cyan/20 px-2.5 py-1 text-[11px] font-bold uppercase hover:bg-cyan/30"
              >
                Batch Triage Selected
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sticky Table Header */}
      <div className="border-b border-line bg-surface-raised font-mono text-[11px] text-muted flex items-center px-2 py-2 select-none">
        <div className="w-8 flex justify-center">
          <label className="min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer">
            <span className="sr-only">Select all visible alerts</span>
            <input
              type="checkbox"
              checked={selectedBulkIds.size === processedAlerts.length && processedAlerts.length > 0}
              onChange={toggleSelectAll}
              className="h-6 w-6 sm:h-4 sm:w-4 rounded-xs border-line text-cyan focus:ring-cyan"
            />
          </label>
        </div>
        <div className="w-20">
          <button
            type="button"
            onClick={() => toggleSort("timestamp")}
            aria-label={`Sort by Time ${sortField === "timestamp" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
            className="w-full min-h-[24px] text-left font-semibold hover:text-ink flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Time {sortField === "timestamp" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
        <div className="w-24">
          <button
            type="button"
            onClick={() => toggleSort("severity")}
            aria-label={`Sort by Severity ${sortField === "severity" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
            className="w-full min-h-[24px] text-left font-semibold hover:text-ink flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Severity {sortField === "severity" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
        <div className="w-28 hidden md:block">
          <button
            type="button"
            onClick={() => toggleSort("source")}
            aria-label={`Sort by Source ${sortField === "source" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
            className="w-full min-h-[24px] text-left font-semibold hover:text-ink flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Source {sortField === "source" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => toggleSort("ruleName")}
            aria-label={`Sort by Detection Rule ${sortField === "ruleName" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
            className="w-full min-h-[24px] text-left font-semibold hover:text-ink flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Detection Rule {sortField === "ruleName" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
        <div className="w-28 text-left font-semibold hidden lg:block">Target Asset</div>
        <div className="w-24">
          <button
            type="button"
            onClick={() => toggleSort("status")}
            aria-label={`Sort by Status ${sortField === "status" ? (sortOrder === "asc" ? "ascending" : "descending") : ""}`}
            className="w-full min-h-[24px] text-right font-semibold hover:text-ink flex items-center justify-end gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Status {sortField === "status" && (sortOrder === "asc" ? "▲" : "▼")}
          </button>
        </div>
      </div>

      {/* Virtualized Table Scroll Body */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        tabIndex={0}
        aria-label="Alert queue list"
        className="flex-1 overflow-y-auto relative min-h-[300px] focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
      >
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted text-xs font-mono space-y-1">
            <span>No alerts matching current filters.</span>
            <span className="text-[11px]">Try clearing search query or broadening criteria.</span>
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleAlerts.map((alert) => {
                const isSelected = selectedAlertId === alert.id;
                const isChecked = selectedBulkIds.has(alert.id);
                const status = getAlertStatus(alert.id);
                const badge = severityBadge(alert.severity);

                return (
                  <div
                    key={alert.id}
                    data-testid={`alert-row-${alert.id}`}
                    onClick={() => onSelectAlert(alert.id)}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`flex items-center px-2 border-b border-line/30 cursor-pointer text-xs font-mono transition-colors ${
                      isSelected
                        ? "bg-cyan/15 text-cyan border-l-2 border-l-cyan font-semibold"
                        : "hover:bg-surface-hover/80 text-secondary"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="w-8 flex justify-center">
                      <label
                        className="min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleSelectRow(alert.id, e as unknown as React.MouseEvent)}
                          className="h-6 w-6 sm:h-4 sm:w-4 rounded-xs border-line text-cyan focus:ring-cyan"
                          aria-label={`Select alert ${alert.id}`}
                        />
                      </label>
                    </div>

                    {/* Timestamp */}
                    <div className="w-20 text-[11px] text-muted whitespace-nowrap overflow-hidden">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>

                    {/* Severity */}
                    <div className="w-24 flex items-center gap-1.5">
                      <Badge variant={badge.variant} size="sm">
                        <span className="mr-1">{badge.icon}</span>
                        {alert.severity}
                      </Badge>
                    </div>

                    {/* Source */}
                    <div className="w-28 text-[11px] text-muted truncate hidden md:block">
                      {alert.source}
                    </div>

                    {/* Rule Name & Summary snippet */}
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="truncate font-semibold text-ink">
                        {alert.ruleName}
                      </div>
                      <div className="text-[10px] text-muted truncate">
                        {alert.summary}
                      </div>
                    </div>

                    {/* Target Asset */}
                    <div className="w-28 text-[11px] text-muted truncate hidden lg:block">
                      {alert.relatedAsset ?? "—"}
                    </div>

                    {/* Status Pill */}
                    <div className="w-24 text-right">
                      {status === "escalated" ? (
                        <span className="text-[10px] font-bold text-danger uppercase bg-danger/10 border border-danger/30 px-1.5 py-0.5 rounded-xs">
                          Escalated
                        </span>
                      ) : status === "decided" ? (
                        <span className="text-[10px] font-bold text-success uppercase bg-success/10 border border-success/30 px-1.5 py-0.5 rounded-xs">
                          Decided
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted uppercase bg-surface-raised px-1.5 py-0.5 rounded-xs">
                          Untriaged
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Summary */}
      <div className="px-3 py-1.5 border-t border-line bg-surface text-[11px] font-mono text-muted flex items-center justify-between">
        <span>
          Showing {processedAlerts.length} of {alerts.length} alerts
        </span>
        <span className="hidden sm:inline">
          Use <strong className="text-ink">j/k</strong> to navigate, <strong className="text-ink">Enter</strong> to open
        </span>
      </div>
    </div>
  );
}
