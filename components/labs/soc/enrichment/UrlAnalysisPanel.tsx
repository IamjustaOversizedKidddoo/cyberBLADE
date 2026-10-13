"use client";

import { useState } from "react";
import type { UrlAnalysisResult, EntityType, UrlRedirectHop } from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconGlobe, IconAlertTriangle, IconArrowRight, IconLayers } from "@/components/ui/icons";

type Props = {
  data: UrlAnalysisResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function UrlAnalysisPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [copied, setCopied] = useState(false);

  const defangedUrl = defangIndicator(data.url);

  const handleCopy = () => {
    navigator.clipboard.writeText(defangedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pb = data.pageBehavior;
  const p = data.parsed;

  const verdictVariant: BadgeVariant =
    data.reputationVerdict === "malicious"
      ? "danger"
      : data.reputationVerdict === "suspicious"
      ? "amber"
      : data.reputationVerdict === "clean"
      ? "emerald"
      : "outline";

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">URL Forensic Breakdown</span>
          <div className="flex items-center gap-2">
            <span className="text-ink font-bold text-sm select-all truncate max-w-md">{defangedUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              title="Copy defanged URL"
            >
              {copied ? <IconCheck className="h-3 w-3 text-emerald-400" /> : <IconCopy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={verdictVariant} size="sm">
            {data.reputationVerdict.toUpperCase()}
          </Badge>
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`URL analysis for ${defangedUrl}: verdict=${data.reputationVerdict}`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* URL Structural Breakdown */}
      <div className="rounded-xs border border-line bg-surface p-3 space-y-2">
        <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
          <IconGlobe className="h-3.5 w-3.5 text-cyan" />
          Uniform Resource Identifier (URI) Component Breakdown
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-muted">Scheme:</span>
            <div className="text-ink font-mono">{p.scheme}</div>
          </div>
          <div>
            <span className="text-muted">Host:</span>
            <div className="flex items-center gap-2">
              <span className="text-ink font-semibold select-all">{defangIndicator(p.host)}</span>
              <button
                type="button"
                onClick={() => onPivot("domain", p.host)}
                className="text-[10px] text-cyan hover:underline"
              >
                [Pivot Domain]
              </button>
            </div>
          </div>
          <div>
            <span className="text-muted">Port:</span>
            <div className="text-ink">{p.port}</div>
          </div>
          <div>
            <span className="text-muted">Path:</span>
            <div className="text-ink font-mono select-all truncate">{p.path}</div>
          </div>
        </div>

        {Object.keys(p.queryParams).length > 0 && (
          <div className="border-t border-line/40 pt-2 space-y-1">
            <span className="text-muted text-[10px] uppercase font-bold">Query Parameters:</span>
            <div className="grid grid-cols-2 gap-1.5 bg-console p-2 rounded-xs border border-line">
              {Object.entries(p.queryParams).map(([k, v]) => (
                <div key={k} className="truncate">
                  <span className="text-cyan font-bold">{k}: </span>
                  <span className="text-ink select-all">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Simulated Redirect Chain */}
      {data.redirectChain.length > 0 && (
        <div className="rounded-xs border border-line bg-surface p-3 space-y-2">
          <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
            <IconLayers className="h-3.5 w-3.5 text-cyan" />
            Simulated Redirect Chain ({data.redirectChain.length} hops)
          </span>

          <div className="space-y-1.5">
            {data.redirectChain.map((hop: UrlRedirectHop, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                <Badge variant="outline" size="sm">HTTP {hop.status}</Badge>
                <span className="text-secondary truncate select-all">{hop.defangedUrl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulated Page Behavior & Neutral Wireframe Placeholder */}
      <div className="rounded-xs border border-line bg-surface p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <span className="font-bold text-ink">Simulated Webpage Behavior & DOM Inspection</span>
          <span className="text-[10px] text-muted">Title: &ldquo;{pb.title}&rdquo;</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className={`p-2 rounded-xs border ${pb.hasLoginForm ? "border-amber/50 bg-amber/10 text-amber" : "border-line bg-console text-muted"}`}>
            <strong>Login Form:</strong> {pb.hasLoginForm ? "DETECTED" : "None"}
          </div>
          <div className={`p-2 rounded-xs border ${pb.requestsCredentials ? "border-danger/50 bg-danger/10 text-danger" : "border-line bg-console text-muted"}`}>
            <strong>Credential Harvesting:</strong> {pb.requestsCredentials ? "SUSPECTED" : "None"}
          </div>
          <div className={`p-2 rounded-xs border ${pb.triggersScriptDownload ? "border-danger/50 bg-danger/10 text-danger" : "border-line bg-console text-muted"}`}>
            <strong>Script Download:</strong> {pb.triggersScriptDownload ? "TRIGGERS DROP" : "None"}
          </div>
        </div>

        <p className="text-[11px] text-secondary leading-relaxed bg-console p-2.5 rounded-xs border border-line">
          {pb.abstractSummary}
        </p>

        {/* Neutral Generated Wireframe Placeholder */}
        <div className="space-y-1">
          <div className="text-[10px] text-muted uppercase font-bold">Neutral Synthetic Wireframe Simulation:</div>
          <div
            tabIndex={0}
            aria-label="Neutral wireframe preview"
            className="rounded-xs border border-line/60 bg-console p-4 flex flex-col items-center justify-center min-h-[140px] text-center space-y-2 select-none"
          >
            <div className="w-12 h-1.5 bg-line rounded-full" />
            <div className="w-48 h-3 bg-line/80 rounded-xs" />
            <div className="w-36 h-2 bg-line/50 rounded-xs" />

            {pb.hasLoginForm ? (
              <div className="w-40 border border-line/80 bg-surface/80 p-2.5 rounded-xs space-y-1.5 mt-2">
                <div className="w-full h-2.5 bg-line/40 rounded-xs" />
                <div className="w-full h-2.5 bg-line/40 rounded-xs" />
                <div className="w-16 h-3 bg-cyan/40 rounded-xs mx-auto" />
              </div>
            ) : pb.triggersScriptDownload ? (
              <div className="border border-danger/30 bg-danger/10 p-2 rounded-xs text-[10px] text-danger">
                [ Automated .hta / .ps1 script download initiated ]
              </div>
            ) : (
              <div className="w-56 h-12 border border-line/40 bg-surface/40 rounded-xs mt-2" />
            )}

            <span className="text-[9px] text-muted uppercase tracking-wider">
              [ Neutral Sandbox DOM Wireframe • Synthetic Mockup ]
            </span>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {data.riskFactors.length > 0 && (
        <div className="space-y-1.5 border-t border-line pt-3">
          <h4 className="text-[11px] font-bold text-ink uppercase tracking-wider">Identified Risk Characteristics</h4>
          <ul className="list-disc list-inside text-[11px] text-secondary space-y-1">
            {data.riskFactors.map((rf: string, idx: number) => (
              <li key={idx}>{rf}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
