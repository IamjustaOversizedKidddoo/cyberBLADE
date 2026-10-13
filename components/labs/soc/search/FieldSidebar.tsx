"use client";

import { useState, useMemo } from "react";
import type { BladeQLEvent } from "@/lib/lab-engine/soc/query/types";

export interface FieldSidebarProps {
  events: BladeQLEvent[];
  availableFields: string[];
  onAddFilter: (field: string, value: string, negate?: boolean) => void;
}

export function FieldSidebar({
  events,
  availableFields,
  onAddFilter,
}: FieldSidebarProps) {
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  // Calculate field coverage and top values dynamically across the current result set
  const fieldStats = useMemo(() => {
    const stats: Record<string, { coveragePct: number; topValues: Array<{ val: string; count: number }> }> = {};
    const total = events.length || 1;

    for (const field of availableFields) {
      if (field.startsWith("_") && field !== "_raw") continue;

      let presentCount = 0;
      const valCounts = new Map<string, number>();

      for (const evt of events) {
        const val = evt[field];
        if (val !== undefined && val !== null && val !== "") {
          presentCount++;
          const str = String(val);
          valCounts.set(str, (valCounts.get(str) ?? 0) + 1);
        }
      }

      const coveragePct = Math.round((presentCount / total) * 100);
      const sorted = Array.from(valCounts.entries())
        .map(([val, count]) => ({ val, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      stats[field] = { coveragePct, topValues: sorted };
    }

    return stats;
  }, [events, availableFields]);

  const filteredFields = availableFields.filter((f) => {
    if (f.startsWith("_") && f !== "_raw") return false;
    return f.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-surface border-r border-line text-xs w-56 shrink-0">
      {/* Sidebar Header */}
      <div className="p-2 border-b border-line bg-surface-raised flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ink uppercase tracking-wider text-[11px]">Fields</span>
          <span className="font-mono text-muted text-[10px]">{filteredFields.length} available</span>
        </div>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter fields..."
          className="w-full px-2 py-1 bg-surface border border-line rounded-xs text-[11px] font-mono outline-none focus:border-cyan text-ink"
        />
      </div>

      {/* Field List */}
      <div className="flex-1 overflow-y-auto divide-y divide-line/40 font-mono text-[11px]">
        {filteredFields.map((field) => {
          const stat = fieldStats[field];
          const isSelected = selectedField === field;

          return (
            <div key={field} className="flex flex-col">
              <button
                type="button"
                onClick={() => setSelectedField(isSelected ? null : field)}
                className={`flex items-center justify-between px-2.5 py-1.5 text-left transition-colors ${
                  isSelected ? "bg-cyan/15 text-cyan" : "hover:bg-surface-raised text-ink"
                }`}
              >
                <span className="truncate font-semibold">{field}</span>
                <span className="text-[10px] text-muted shrink-0 ml-1">
                  {stat?.coveragePct ?? 0}%
                </span>
              </button>

              {/* Coverage mini bar */}
              <div className="h-[2px] w-full bg-line/20">
                <div
                  className="h-full bg-cyan/60"
                  style={{ width: `${stat?.coveragePct ?? 0}%` }}
                />
              </div>

              {/* Expanded Top Values Drawer */}
              {isSelected && stat && (
                <div className="bg-surface-raised/80 p-2 flex flex-col gap-1 border-y border-cyan/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-bold">
                    Top Values:
                  </div>
                  {stat.topValues.length === 0 ? (
                    <div className="text-[10px] text-muted italic">No values recorded</div>
                  ) : (
                    stat.topValues.map(({ val, count }) => (
                      <div
                        key={val}
                        className="flex items-center justify-between group hover:bg-surface px-1 py-0.5 rounded-xs"
                      >
                        <span className="truncate max-w-[120px] text-ink" title={val}>
                          {val}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted">{count}</span>
                          <button
                            type="button"
                            onClick={() => onAddFilter(field, val, false)}
                            className="text-cyan hover:text-cyan-bright font-bold px-1 text-[11px]"
                            title={`Filter matching ${field}="${val}"`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddFilter(field, val, true)}
                            className="text-danger hover:text-danger-bright font-bold px-1 text-[11px]"
                            title={`Exclude ${field}!="${val}"`}
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
