"use client";

import { useState } from "react";
import type {
  EndpointTimelineResult,
  ProcessTreeNode as ProcessNodeType,
  EndpointEventRecord,
  EntityType,
} from "@/lib/lab-engine/soc/enrichment/types";
import { Badge } from "@/components/ui/Badge";
import {
  IconTerminal,
  IconChevronRight,
  IconChevronDown,
  IconAlertTriangle,
} from "@/components/ui/icons";

type Props = {
  data: EndpointTimelineResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

function TreeNodeComponent({
  node,
  level = 0,
  onPivot,
}: {
  node: ProcessNodeType;
  level?: number;
  onPivot: (type: EntityType, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected="false"
      className="space-y-1 text-[11px]"
      style={{ paddingLeft: `${level * 16}px` }}
    >
      <div className="flex items-center gap-2 py-1 px-2 rounded-xs bg-surface/70 border border-line/40 hover:border-cyan/40">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted hover:text-ink p-0.5"
            aria-label={expanded ? "Collapse process tree" : "Expand process tree"}
          >
            {expanded ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <IconTerminal className="h-3.5 w-3.5 text-cyan shrink-0" />

        <div className="flex-1 truncate">
          <span className="font-bold text-ink">{node.processName}</span>
          <span className="text-muted text-[10px] ml-2">PID: {node.pid}</span>
          <span className="text-secondary text-[10px] ml-2 font-mono truncate">
            {node.commandLine}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" size="sm">{node.user}</Badge>
          {node.integrityLevel && (
            <Badge
              variant={node.integrityLevel === "SYSTEM" ? "danger" : "outline"}
              size="sm"
            >
              {node.integrityLevel}
            </Badge>
          )}
          {node.hash && (
            <button
              type="button"
              onClick={() => onPivot("hash", node.hash!)}
              className="text-[10px] text-cyan hover:underline font-semibold ml-1"
            >
              Pivot Hash
            </button>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div role="group" className="space-y-1">
          {node.children.map((child: ProcessNodeType) => (
            <TreeNodeComponent
              key={`${child.pid}-${child.processName}`}
              node={child}
              level={level + 1}
              onPivot={onPivot}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EndpointTimelinePanel({ data, onPivot, onAttachEvidence }: Props) {
  const [activeTab, setActiveTab] = useState<"tree" | "events">("tree");
  const [eventFilter, setEventFilter] = useState<string>("ALL");

  const filteredEvents = data.timelineEvents.filter((e: EndpointEventRecord) => {
    if (eventFilter === "ALL") return true;
    return e.eventType.toLowerCase() === eventFilter.toLowerCase();
  });

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">EDR Endpoint Forensics</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">
            Host: {data.hostname} ({data.timelineEvents.length} chronological events)
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() =>
                onAttachEvidence(`Endpoint EDR timeline for host ${data.hostname}: inspected process tree and ${data.timelineEvents.length} events`)
              }
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Gaps Notice if present */}
      {data.telemetryGaps && data.telemetryGaps.length > 0 && (
        <div className="rounded-xs border border-amber/40 bg-amber/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-amber font-bold">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>Telemetry Blindspots / Gaps Detected</span>
          </div>
          <div className="space-y-1 text-[11px] text-secondary">
            {data.telemetryGaps.map((gap, idx: number) => (
              <p key={idx}>
                • {new Date(gap.startTime).toLocaleTimeString()} – {new Date(gap.endTime).toLocaleTimeString()} ({gap.durationMinutes}m): {gap.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* View Switcher */}
      <div className="flex border-b border-line gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("tree")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "tree" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Process Execution Hierarchy (Tree)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`pb-2 px-2.5 font-bold border-b-2 ${
            activeTab === "events" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Chronological EDR Event Stream ({data.timelineEvents.length})
        </button>
      </div>

      {/* Tab 1: Collapsible Tree View */}
      {activeTab === "tree" && (
        <div className="space-y-3">
          <div className="text-[10px] text-muted">
            Parent-child process lineage with execution integrity context and interactive node pivoting.
          </div>

          <div
            role="tree"
            aria-label="Process execution hierarchy"
            className="rounded-xs border border-line bg-console p-3 space-y-2 max-h-96 overflow-y-auto"
          >
            {data.processTree.length === 0 ? (
              <div className="text-[11px] text-muted italic">No active process execution trees recorded.</div>
            ) : (
              data.processTree.map((tree: ProcessNodeType) => (
                <TreeNodeComponent
                  key={`${tree.pid}-${tree.processName}`}
                  node={tree}
                  onPivot={onPivot}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Chronological Event Stream */}
      {activeTab === "events" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-surface/50 p-2 rounded-xs border border-line">
            <span className="text-muted text-[10px] uppercase font-bold">Event Type:</span>
            {(["ALL", "process_start", "process_end", "file_create", "file_delete", "registry_write", "net_connect", "logon"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEventFilter(t)}
                className={`px-2 py-0.5 text-[10px] rounded-xs font-semibold uppercase ${
                  eventFilter === t ? "bg-cyan/20 text-cyan border border-cyan/40" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xs border border-line bg-console max-h-96 divide-y divide-line/30">
            {filteredEvents.map((ev: EndpointEventRecord, idx: number) => (
              <div key={idx} className="p-2.5 hover:bg-surface-hover/50 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="text-muted">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    <Badge variant="outline" size="sm">{ev.eventType.toUpperCase()}</Badge>
                    {ev.pid && <span className="text-muted">PID {ev.pid}</span>}
                  </div>
                  <span className="text-secondary font-mono">{ev.user}</span>
                </div>

                <div className="text-[11px] text-ink font-mono select-all truncate">
                  {ev.details}
                </div>

                {ev.targetPath && (
                  <div className="text-[10px] text-muted truncate">
                    Target: {ev.targetPath}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
