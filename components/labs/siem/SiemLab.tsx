"use client";

import { useId, useMemo, useState, useEffect } from "react";
import type { SiemEnv, SiemSeverity } from "@/lib/lab-engine/siem/types";
import { SeverityBadge } from "@/components/ui/Badge";
import { Kbd } from "@/components/ui/Kbd";

export function SiemLab({ env }: { env: SiemEnv }) {
  const searchInputId = useId();
  const [search, setSearch] = useState(env.defaultQuery ?? "");
  const [sevFilter, setSevFilter] = useState<SiemSeverity | "ALL">("ALL");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        document.getElementById(searchInputId)?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchInputId]);

  // Compute severity counts
  const counts = useMemo(() => {
    const map = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const e of env.events) {
      if (e.severity in map) map[e.severity]++;
    }
    return map;
  }, [env.events]);

  // Available event IDs for fast filtering
  const distinctEventIds = useMemo(() => {
    return Array.from(new Set(env.events.map((e) => e.eventId))).slice(0, 8);
  }, [env.events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return env.events.filter((e) => {
      if (sevFilter !== "ALL" && e.severity !== sevFilter) return false;
      if (!q) return true;
      return (
        e.message.toLowerCase().includes(q) ||
        e.eventId.toLowerCase().includes(q) ||
        e.sourceIp.toLowerCase().includes(q) ||
        (e.destIp && e.destIp.toLowerCase().includes(q)) ||
        (e.user && e.user.toLowerCase().includes(q)) ||
        e.action.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.raw.toLowerCase().includes(q)
      );
    });
  }, [env.events, search, sevFilter]);

  const selectedEvent = useMemo(() => {
    return env.events.find((e) => e.id === selectedEventId) ?? null;
  }, [env.events, selectedEventId]);

  const copyRawLog = async (raw: string) => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="border border-line bg-console font-mono text-xs text-ink shadow-2xl">
      {/* ── TOP HUD / BAR ──────────────────────────────────────────────────── */}
      <div className="border-b border-line bg-void/80 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
            </span>
            <span className="font-ui text-sm font-bold tracking-wider text-cyan uppercase">
              SIEM Event Monitor // {env.title}
            </span>
          </div>
          <div className="flex items-center gap-2 font-ui text-[11px] text-muted">
            <span>
              LOGS: <strong className="text-ink font-mono">{filteredEvents.length}</strong> / {env.events.length}
            </span>
            <span className="text-line">|</span>
            <span className="text-pink">CRIT: {counts.CRITICAL}</span>
            <span className="text-orange-400">HIGH: {counts.HIGH}</span>
            <span className="text-yellow-300">MED: {counts.MEDIUM}</span>
          </div>
        </div>

        {/* Search & Query Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px] flex-1">
            <label htmlFor={searchInputId} className="sr-only">
              Search events, IPs, usernames, EventIDs, or messages
            </label>
            <span className="absolute left-3 top-2 text-cyan font-bold select-none">&gt;</span>
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, IPs, usernames, EventIDs, or messages..."
              className="w-full border border-line bg-console-deep py-1.5 pl-8 pr-12 text-ink placeholder:text-muted/60 focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
            <div className="absolute right-2.5 top-2 pointer-events-none hidden sm:flex items-center">
              <Kbd>/</Kbd>
            </div>
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="border border-line px-2.5 py-1.5 text-muted hover:border-pink hover:text-pink"
            >
              Clear
            </button>
          )}
        </div>

        {/* Severity Filters & Quick Event ID Pills */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/40">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-ui text-[10px] text-muted uppercase mr-1">Severity:</span>
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSevFilter(s)}
                className={`border px-2 py-0.5 text-[11px] transition-colors ${
                  sevFilter === s
                    ? "border-cyan bg-cyan/20 text-cyan font-bold"
                    : "border-line bg-void/40 text-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="font-ui text-[10px] text-muted uppercase mr-1">EventID:</span>
            {distinctEventIds.map((eid) => (
              <button
                key={eid}
                type="button"
                onClick={() => setSearch(eid)}
                className="border border-line/60 bg-void/30 px-1.5 py-0.5 text-[10px] text-muted hover:border-cyan hover:text-cyan"
              >
                {eid}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: LOG TABLE + INSPECTOR DRAWER ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-[460px]">
        {/* LOG EVENT STREAM */}
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto border-r border-line">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p className="text-base text-ink">No log events match query &quot;{search}&quot;</p>
              <p className="mt-1 text-xs">Try clearing search terms or selecting another severity filter.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0 bg-void/95 border-b border-line z-10 select-none">
                <tr className="text-muted tracking-wider uppercase font-ui text-[10px]">
                  <th className="p-2.5">Time (UTC)</th>
                  <th className="p-2.5">Sev</th>
                  <th className="p-2.5">Event ID</th>
                  <th className="p-2.5">Source IP</th>
                  <th className="p-2.5">User</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredEvents.map((evt) => {
                  const isSelected = evt.id === selectedEventId;
                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-cyan/15 text-ink font-semibold"
                          : "hover:bg-cyan/5 text-muted hover:text-ink"
                      }`}
                    >
                      <td className="p-2.5 whitespace-nowrap font-mono text-[10px] text-muted/90">
                        {evt.timestamp}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <SeverityBadge severity={evt.severity} />
                      </td>
                      <td className="p-2.5 whitespace-nowrap font-bold text-ink">
                        {evt.eventId}
                      </td>
                      <td className="p-2.5 whitespace-nowrap text-cyan font-mono">
                        {evt.sourceIp}
                      </td>
                      <td className="p-2.5 whitespace-nowrap text-purple">
                        {evt.user ?? "—"}
                      </td>
                      <td className="p-2.5 whitespace-nowrap text-ink">
                        {evt.action}
                      </td>
                      <td className="p-2.5 truncate max-w-xs text-muted/90">
                        {evt.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* EVENT INSPECTOR DRAWER */}
        <div className="bg-void/95 p-4 flex flex-col justify-between border-t lg:border-t-0 border-line">
          {selectedEvent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <span className="font-ui text-xs font-bold text-cyan tracking-wider uppercase">
                  EVENT DETAILS // {selectedEvent.id}
                </span>
                <SeverityBadge severity={selectedEvent.severity} />
              </div>

              {/* Parsed Fields */}
              <div className="space-y-2 text-xs">
                <div className="border border-line/60 bg-console p-2.5 space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted font-ui text-[10px]">ACTION:</span>
                    <span className="text-ink font-bold">{selectedEvent.action}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted font-ui text-[10px]">EVENT ID:</span>
                    <span className="text-cyan font-bold">{selectedEvent.eventId}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted font-ui text-[10px]">TIMESTAMP:</span>
                    <span className="text-muted font-mono">{selectedEvent.timestamp}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted font-ui text-[10px]">SOURCE IP:</span>
                    <button
                      type="button"
                      onClick={() => setSearch(selectedEvent.sourceIp)}
                      className="text-cyan underline hover:text-cyan/80"
                      title="Filter on this IP"
                    >
                      {selectedEvent.sourceIp}
                    </button>
                  </div>
                  {selectedEvent.destIp && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted font-ui text-[10px]">DEST IP:</span>
                      <span className="text-ink">{selectedEvent.destIp}</span>
                    </div>
                  )}
                  {selectedEvent.user && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted font-ui text-[10px]">USER ACCOUNT:</span>
                      <button
                        type="button"
                        onClick={() => setSearch(selectedEvent.user!)}
                        className="text-purple underline hover:text-purple/80 font-bold"
                        title="Filter on this user"
                      >
                        {selectedEvent.user}
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted font-ui text-[10px]">SOURCE:</span>
                    <span className="text-muted">{selectedEvent.source}</span>
                  </div>
                </div>

                {/* Additional Metadata */}
                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <div className="border border-line/60 bg-console p-2.5 space-y-1">
                    <span className="font-ui text-[10px] text-muted uppercase block border-b border-line/40 pb-1 mb-1">
                      EXTRACTED ATTRIBUTES:
                    </span>
                    {Object.entries(selectedEvent.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-baseline text-[11px]">
                        <span className="text-muted/70">{k}:</span>
                        <span className="text-ink font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw Log Excerpt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-ui text-[10px] text-muted uppercase">RAW LOG STRING:</span>
                    <button
                      type="button"
                      onClick={() => copyRawLog(selectedEvent.raw)}
                      className="border border-line/60 px-1.5 py-0.5 text-[10px] text-cyan hover:border-cyan"
                    >
                      {copiedRaw ? "✓ Copied" : "Copy Raw"}
                    </button>
                  </div>
                  <pre className="max-h-36 overflow-y-auto border border-line bg-console-deep p-2 text-[10px] text-muted whitespace-pre-wrap break-all leading-tight">
                    {selectedEvent.raw}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-muted">
              <p className="font-ui text-xs uppercase tracking-wider text-muted/60">
                NO EVENT SELECTED
              </p>
              <p className="mt-2 text-[11px] leading-relaxed">
                Click any log event from the stream on the left to inspect parsed security fields, extracted attributes, and raw audit strings.
              </p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[10px] font-ui text-muted">
            <span>SHORTCUT: CLICK ROW TO INSPECT</span>
            {selectedEventId && (
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="text-pink hover:underline"
              >
                [CLOSE INSPECTOR]
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
