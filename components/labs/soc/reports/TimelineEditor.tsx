"use client";

import { useState } from "react";
import type { TimelineRowData } from "@/lib/lab-engine/soc/reports/types";

interface Props {
  timeline: TimelineRowData[];
  onChange: (updated: TimelineRowData[]) => void;
  disabled?: boolean;
}

export function TimelineEditor({ timeline, onChange, disabled }: Props) {
  const [newTimestamp, setNewTimestamp] = useState(
    () => new Date().toISOString().slice(0, 19) + "Z",
  );
  const [newDesc, setNewDesc] = useState("");
  const [newOrigin, setNewOrigin] = useState("SIEM / EDR Alert");
  const [newRef, setNewRef] = useState("");

  const handleAddEvent = () => {
    if (!newDesc.trim()) return;
    const newRow: TimelineRowData = {
      id: `tl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestampUtc: newTimestamp,
      rawTimestamp: newTimestamp,
      timezone: "UTC",
      description: newDesc.trim(),
      dataOrigin: newOrigin.trim() || "Endpoint Telemetry",
      evidenceRef: newRef.trim() || undefined,
    };
    onChange([...timeline, newRow]);
    setNewDesc("");
    setNewRef("");
  };

  const handleDelete = (id?: string) => {
    onChange(timeline.filter((t) => t.id !== id));
  };

  const handleSortChronologically = () => {
    const sorted = [...timeline].sort((a, b) => {
      const timeA = new Date(a.timestampUtc).getTime();
      const timeB = new Date(b.timestampUtc).getTime();
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });
    onChange(sorted);
  };

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider text-muted text-[11px]">
          Investigation Milestones ({timeline.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSortChronologically}
            disabled={disabled || timeline.length <= 1}
            className="rounded-xs border border-line bg-surface-raised px-2.5 py-1 text-[11px] text-muted hover:text-cyan hover:border-cyan/40 disabled:opacity-50"
            title="Sort timeline events chronologically ascending"
          >
            Sort Chronologically
          </button>
        </div>
      </div>

      {/* Timeline Table */}
      <div
        className="overflow-x-auto rounded-xs border border-line bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        // Scrollable table: focusable so keyboard users can scroll it (WCAG 2.1.1).
        tabIndex={0}
        role="region"
        aria-label="Timeline table (scrolls sideways)"
      >
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="border-b border-line bg-surface-raised text-[10px] uppercase tracking-wider text-muted">
              <th className="p-2 w-44">Timestamp (UTC)</th>
              <th className="p-2">Observed Activity / Description</th>
              <th className="p-2 w-44">Origin / Ref</th>
              <th className="p-2 w-16 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {timeline.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted italic">
                  No timeline milestones added yet. Record significant sequence events below.
                </td>
              </tr>
            ) : (
              timeline.map((row) => (
                <tr key={row.id} className="hover:bg-surface-raised/40">
                  <td className="p-2 font-mono text-[11px] text-cyan">
                    {row.timestampUtc}
                  </td>
                  <td className="p-2 text-ink">{row.description}</td>
                  <td className="p-2 text-[10px] text-muted">
                    <div>{row.dataOrigin}</div>
                    {row.evidenceRef && (
                      <span className="text-cyan">{row.evidenceRef}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={disabled}
                      className="text-error hover:underline px-1 py-0.5"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add New Milestone */}
      {!disabled && (
        <div className="flex flex-col gap-2 rounded-xs border border-line bg-surface-raised p-2.5">
          <div className="text-[10px] font-bold uppercase text-muted">Add Milestone Event</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              aria-label="Milestone Timestamp"
              placeholder="2026-10-12T08:15:00Z"
              className="w-44 rounded-xs border border-line bg-surface px-2 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
            <input
              type="text"
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              aria-label="Milestone Origin"
              placeholder="Origin (e.g. Sysmon / Firewall)"
              className="w-44 rounded-xs border border-line bg-surface px-2 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
            <input
              type="text"
              value={newRef}
              onChange={(e) => setNewRef(e.target.value)}
              aria-label="Milestone Evidence Reference"
              placeholder="Evidence ref (alert:alt-01)"
              className="w-44 rounded-xs border border-line bg-surface px-2 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddEvent();
                }
              }}
              aria-label="Milestone Description"
              placeholder="Describe adversary behavior or defensive trigger observed..."
              className="flex-1 rounded-xs border border-line bg-surface px-2.5 py-1 text-ink focus:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            />
            <button
              type="button"
              onClick={handleAddEvent}
              disabled={!newDesc.trim()}
              className="rounded-xs border border-cyan/40 bg-cyan/15 px-3 py-1 font-bold text-cyan hover:bg-cyan/25 disabled:opacity-50"
            >
              + Add Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
