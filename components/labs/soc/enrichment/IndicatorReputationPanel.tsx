"use client";

import { useState } from "react";
import type { ReputationResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconShield, IconAlertTriangle } from "@/components/ui/icons";

type Props = {
  data: ReputationResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function IndicatorReputationPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [copied, setCopied] = useState(false);

  const defangedValue = defangIndicator(data.entity.value);

  const handleCopy = () => {
    navigator.clipboard.writeText(defangedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data.hasData || data.sources.length === 0) {
    return (
      <div className="space-y-4 p-4 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider">Indicator</span>
            <div className="text-ink font-bold">{defangedValue}</div>
          </div>
          <Badge variant="outline" size="sm">{data.entity.type.toUpperCase()}</Badge>
        </div>

        <div className="rounded-sm border border-line bg-surface/50 p-6 text-center space-y-2">
          <IconShield className="h-8 w-8 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-ink">No Intelligence Records Found</h4>
          <p className="text-secondary max-w-sm mx-auto leading-relaxed">
            This indicator has not been indexed or reported by any simulated community feeds or commercial threat reputation repositories.
          </p>
          <div className="text-[11px] text-muted pt-2">
            Absence of reputation data does not guarantee the entity is benign. Cross-examine internal telemetry, endpoint activity, and network records.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header with defanged entity and copy */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Investigated Indicator</span>
          <div className="flex items-center gap-2">
            <span className="text-ink font-bold text-sm select-all">{defangedValue}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              title="Copy defanged indicator"
            >
              {copied ? <IconCheck className="h-3 w-3 text-success" /> : <IconCopy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="cyan" size="sm">{data.entity.type.toUpperCase()}</Badge>
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`Reputation lookup for ${defangedValue}: ${data.sources.length} sources examined`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Disagreement Highlight Banner without declaring single winner */}
      {data.disagreement && (
        <div className="rounded-xs border border-amber/40 bg-amber/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-amber font-bold">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>Conflicting Intelligence Signals</span>
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
            {data.disagreementSummary ??
              "External intelligence sources report divergent verdicts for this indicator. Tier-1 analysts must evaluate false-positive probability, source coverage, and internal telemetry."}
          </p>
        </div>
      )}

      {/* Observation Timeline */}
      {(data.firstSeen || data.lastSeen) && (
        <div className="grid grid-cols-2 gap-2 rounded-xs border border-line bg-surface/50 p-2.5 text-[11px]">
          <div>
            <span className="text-muted">First Observed Globally:</span>
            <div className="text-ink font-semibold">{data.firstSeen ? new Date(data.firstSeen).toLocaleDateString() : "Unknown"}</div>
          </div>
          <div>
            <span className="text-muted">Last Activity Recorded:</span>
            <div className="text-ink font-semibold">{data.lastSeen ? new Date(data.lastSeen).toLocaleDateString() : "Recent"}</div>
          </div>
        </div>
      )}

      {/* Source Reports Grid */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
          Threat Intelligence Sources ({data.sources.length})
        </h4>

        <div className="space-y-2.5">
          {data.sources.map((src) => {
            const verdictVariant =
              src.verdict === "malicious"
                ? "danger"
                : src.verdict === "suspicious"
                ? "amber"
                : src.verdict === "clean"
                ? "emerald"
                : "outline";

            return (
              <div
                key={src.id}
                className="rounded-xs border border-line bg-surface p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-ink">{src.name}</span>
                    <span className="text-[10px] text-muted ml-2">({src.category})</span>
                  </div>
                  <Badge variant={verdictVariant} size="sm">
                    {src.verdict.toUpperCase()}
                  </Badge>
                </div>

                {/* Score & Confidence meters */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="flex justify-between text-[10px] text-muted mb-1">
                      <span>Threat Score</span>
                      <span className="font-bold text-ink">{src.score}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          src.score >= 70
                            ? "bg-danger"
                            : src.score >= 35
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                        style={{ width: `${src.score}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-muted mb-1">
                      <span>Confidence</span>
                      <span className="font-bold text-ink">{src.confidence}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan"
                        style={{ width: `${src.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                {src.enginesFlagged !== undefined && src.totalEngines !== undefined && (
                  <div className="text-[11px] text-muted">
                    Engine detections: <strong className="text-ink">{src.enginesFlagged}/{src.totalEngines}</strong> vendors
                  </div>
                )}

                <p className="text-[11px] text-secondary border-t border-line/40 pt-1.5 leading-relaxed">
                  {src.notes}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Related Entities / Pivots */}
      {data.relatedEntities.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">
            Correlated Infrastructure & Pivots ({data.relatedEntities.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.relatedEntities.map((rel, idx) => (
              <button
                key={`${rel.value}-${idx}`}
                type="button"
                onClick={() => onPivot(rel.type, rel.value)}
                className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-surface px-2.5 py-1 text-[11px] text-cyan hover:bg-surface-hover hover:border-cyan/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                <span className="text-[9px] text-muted uppercase font-bold">{rel.type}:</span>
                <span className="font-semibold">{defangIndicator(rel.value)}</span>
                <span className="text-[9px] text-secondary italic">({rel.relationship})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
