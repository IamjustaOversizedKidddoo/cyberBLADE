"use client";

import { useState, useMemo } from "react";
import type { PdnsResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconSearch, IconLayers, IconArrowRight } from "@/components/ui/icons";

type Props = {
  data: PdnsResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function PdnsResolutionPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [activeDirection, setActiveDirection] = useState<"forward" | "reverse">("forward");
  const [sortField, setSortField] = useState<"lastSeen" | "count">("lastSeen");
  const [copied, setCopied] = useState(false);

  const defangedValue = defangIndicator(data.entity.value);

  const handleCopy = () => {
    navigator.clipboard.writeText(defangedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resolutions = useMemo(() => {
    const list = activeDirection === "forward" ? [...data.forwardResolutions] : [...data.reverseResolutions];
    list.sort((a, b) => {
      if (sortField === "lastSeen") {
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      }
      return b.count - a.count;
    });
    return list;
  }, [data.forwardResolutions, data.reverseResolutions, activeDirection, sortField]);

  const totalCount = data.forwardResolutions.length + data.reverseResolutions.length;

  if (!data.hasData || totalCount === 0) {
    return (
      <div className="space-y-4 p-4 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider">Indicator</span>
            <div className="text-ink font-bold">{defangedValue}</div>
          </div>
          <Badge variant="outline" size="sm">PASSIVE DNS</Badge>
        </div>

        <div className="rounded-sm border border-line bg-surface/50 p-6 text-center space-y-2">
          <IconSearch className="h-8 w-8 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-ink">No Historical DNS Resolutions Found</h4>
          <p className="text-secondary max-w-sm mx-auto leading-relaxed">
            Passive DNS telemetry has recorded zero resolution records for this indicator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Passive DNS Resolution History</span>
          <div className="flex items-center gap-2">
            <span className="text-ink font-bold text-sm select-all">{defangedValue}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              title="Copy defanged indicator"
            >
              {copied ? <IconCheck className="h-3 w-3 text-emerald-400" /> : <IconCopy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="cyan" size="sm">{totalCount} RESOLUTIONS</Badge>
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`pDNS resolutions for ${defangedValue}: ${totalCount} records`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Shared Hosting Notice */}
      {data.sharedHostingInference && (
        <div className="rounded-xs border border-cyan/40 bg-cyan/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-cyan font-bold">
            <IconLayers className="h-4 w-4 shrink-0" />
            <span>Shared Hosting / Multi-Tenant Infrastructure</span>
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
            {data.sharedHostingInference}
          </p>
        </div>
      )}

      {/* Direction & Sort Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/50 p-2 rounded-xs border border-line">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveDirection("forward")}
            className={`px-2 py-0.5 text-[10px] rounded-xs font-semibold ${
              activeDirection === "forward" ? "bg-cyan/20 text-cyan border border-cyan/40" : "text-muted hover:text-ink"
            }`}
          >
            Forward (Domain → IP) ({data.forwardResolutions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveDirection("reverse")}
            className={`px-2 py-0.5 text-[10px] rounded-xs font-semibold ${
              activeDirection === "reverse" ? "bg-cyan/20 text-cyan border border-cyan/40" : "text-muted hover:text-ink"
            }`}
          >
            Reverse (IP → Domains) ({data.reverseResolutions.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted text-[10px] uppercase font-bold">Sort:</span>
          <button
            type="button"
            onClick={() => setSortField("lastSeen")}
            className={`px-2 py-0.5 text-[10px] rounded-xs font-semibold ${
              sortField === "lastSeen" ? "bg-cyan/20 text-cyan border border-cyan/40" : "text-muted hover:text-ink"
            }`}
          >
            Last Seen
          </button>
          <button
            type="button"
            onClick={() => setSortField("count")}
            className={`px-2 py-0.5 text-[10px] rounded-xs font-semibold ${
              sortField === "count" ? "bg-cyan/20 text-cyan border border-cyan/40" : "text-muted hover:text-ink"
            }`}
          >
            Hits
          </button>
        </div>
      </div>

      {/* Resolutions Table */}
      <div className="overflow-x-auto rounded-xs border border-line bg-console">
        <table className="w-full text-left border-collapse" role="table" aria-label="Passive DNS resolutions">
          <thead>
            <tr className="border-b border-line bg-surface text-[10px] text-muted uppercase tracking-wider">
              <th className="p-2.5">Domain</th>
              <th className="p-2.5">Resolved IP</th>
              <th className="p-2.5">First Seen</th>
              <th className="p-2.5">Last Seen</th>
              <th className="p-2.5 text-right">Hit Count</th>
              <th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/30 text-[11px]">
            {resolutions.map((res, idx) => (
              <tr key={`${res.domain}-${res.ip}-${idx}`} className="hover:bg-surface-hover/50">
                <td className="p-2.5 font-bold text-ink">
                  {defangIndicator(res.domain)}
                </td>
                <td className="p-2.5 text-secondary font-mono">
                  {defangIndicator(res.ip)}
                </td>
                <td className="p-2.5 text-muted text-[10px]">
                  {new Date(res.firstSeen).toLocaleDateString()}
                </td>
                <td className="p-2.5 text-muted text-[10px]">
                  {new Date(res.lastSeen).toLocaleDateString()}
                </td>
                <td className="p-2.5 text-right text-ink font-semibold">
                  {res.count.toLocaleString()}
                </td>
                <td className="p-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onPivot(activeDirection === "forward" ? "ip" : "domain", activeDirection === "forward" ? res.ip : res.domain)}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan hover:underline font-semibold"
                    title={`Pivot to ${activeDirection === "forward" ? res.ip : res.domain}`}
                  >
                    Pivot <IconArrowRight className="h-2.5 w-2.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
