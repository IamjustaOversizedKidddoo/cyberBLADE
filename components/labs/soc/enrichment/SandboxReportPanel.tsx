"use client";

import { useState } from "react";
import type { SandboxReportResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconFile, IconTerminal } from "@/components/ui/icons";

type Props = {
  data: SandboxReportResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function SandboxReportPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [activeCategory, setActiveCategory] = useState<"process" | "filesystem" | "registry" | "network" | "persistence">("process");
  const [copied, setCopied] = useState(false);

  const file = data.file;
  const beh = data.behavior;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(file.hashSha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const threatVariant: BadgeVariant =
    data.threatScore >= 70
      ? "danger"
      : data.threatScore >= 35
      ? "amber"
      : "emerald";

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">Dynamic Sandbox Detonation Report</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">{file.filename}</div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={threatVariant} size="sm">
            THREAT SCORE: {data.threatScore}/100
          </Badge>
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`Sandbox report for ${file.filename} (SHA256: ${file.hashSha256}): score=${data.threatScore}`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* File Metadata Card */}
      <div className="rounded-xs border border-line bg-surface p-3 space-y-2">
        <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
          <IconFile className="h-3.5 w-3.5 text-cyan" />
          Sample Identification & Static Hashes
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-muted">MIME / File Type:</span>
            <div className="text-ink font-semibold">{file.mimeType} ({file.fileTypeDescription})</div>
          </div>
          <div>
            <span className="text-muted">File Size:</span>
            <div className="text-ink font-semibold">{(file.sizeBytes / 1024).toFixed(1)} KB</div>
          </div>
          <div>
            <span className="text-muted">Entropy:</span>
            <div className="text-ink font-semibold">{file.entropy.toFixed(2)} / 8.0</div>
          </div>
          <div>
            <span className="text-muted">Detonation Duration:</span>
            <div className="text-ink font-semibold">{data.analysisDurationSeconds}s (Automated run)</div>
          </div>
        </div>

        <div className="border-t border-line/40 pt-2 flex items-center justify-between">
          <div className="truncate max-w-sm">
            <span className="text-muted text-[10px] block">Synthetic SHA-256 Hash:</span>
            <span className="text-ink font-mono text-[11px] select-all truncate">{file.hashSha256}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyHash}
            className="inline-flex items-center gap-1 rounded-xs border border-line bg-console px-2 py-1 text-[10px] text-muted hover:text-ink shrink-0"
          >
            {copied ? <IconCheck className="h-3 w-3 text-emerald-400" /> : <IconCopy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy Hash"}
          </button>
        </div>
      </div>

      {/* Imperfect Truth / Evasion Disclaimer */}
      <div className="rounded-xs border border-line/60 bg-surface/40 p-2.5 text-[10px] text-secondary leading-relaxed">
        <strong>Detonation Forensics Notice:</strong> {data.sandboxNotes || "Automated sandboxes execute samples for a fixed time window and may fail to observe dormant, VM-aware, or command-line-dependent payloads. Always cross-reference with endpoint EDR telemetry."}
      </div>

      {/* Behavioral Activity Categories Toolbar */}
      <div className="flex border-b border-line gap-1 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveCategory("process")}
          className={`pb-2 px-2 font-bold border-b-2 ${
            activeCategory === "process" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Processes ({beh.processCreation.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("filesystem")}
          className={`pb-2 px-2 font-bold border-b-2 ${
            activeCategory === "filesystem" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          File Writes ({beh.fileWrites.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("registry")}
          className={`pb-2 px-2 font-bold border-b-2 ${
            activeCategory === "registry" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Registry ({beh.registryModifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("network")}
          className={`pb-2 px-2 font-bold border-b-2 ${
            activeCategory === "network" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Network ({beh.networkConnections.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("persistence")}
          className={`pb-2 px-2 font-bold border-b-2 ${
            activeCategory === "persistence" ? "border-cyan text-cyan" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          Persistence ({beh.persistenceMechanisms.length})
        </button>
      </div>

      {/* Behavioral Activity Content */}
      <div className="rounded-xs border border-line bg-console p-3 space-y-2">
        {activeCategory === "process" && (
          <div>
            <h5 className="text-[10px] font-bold text-muted uppercase mb-2">Process Spawning & Execution Tree</h5>
            {beh.processCreation.length === 0 ? (
              <div className="text-[11px] text-muted italic">No secondary process executions observed.</div>
            ) : (
              <div className="space-y-1.5">
                {beh.processCreation.map((cmd: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 bg-surface p-2 rounded-xs border border-line/40">
                    <IconTerminal className="h-3.5 w-3.5 text-cyan shrink-0 mt-0.5" />
                    <code className="text-[11px] text-ink select-all break-all">{cmd}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === "filesystem" && (
          <div>
            <h5 className="text-[10px] font-bold text-muted uppercase mb-2">Dropped Files & File System Writes</h5>
            {beh.fileWrites.length === 0 ? (
              <div className="text-[11px] text-muted italic">No file writes or temporary payload staging recorded.</div>
            ) : (
              <div className="space-y-1.5">
                {beh.fileWrites.map((fw: string, idx: number) => (
                  <div key={idx} className="bg-surface p-2 rounded-xs border border-line/40 text-[11px] text-ink select-all break-all">
                    {fw}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === "registry" && (
          <div>
            <h5 className="text-[10px] font-bold text-muted uppercase mb-2">Registry & Configuration Modifications</h5>
            {beh.registryModifications.length === 0 ? (
              <div className="text-[11px] text-muted italic">No registry key alterations recorded.</div>
            ) : (
              <div className="space-y-1.5">
                {beh.registryModifications.map((reg: string, idx: number) => (
                  <div key={idx} className="bg-surface p-2 rounded-xs border border-line/40 text-[11px] text-ink select-all break-all">
                    {reg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === "network" && (
          <div>
            <h5 className="text-[10px] font-bold text-muted uppercase mb-2">Outbound Network Telemetry & DNS</h5>
            {beh.networkConnections.length === 0 ? (
              <div className="text-[11px] text-muted italic">No outbound sockets or remote connections established.</div>
            ) : (
              <div className="space-y-1.5">
                {beh.networkConnections.map((net, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-surface p-2 rounded-xs border border-line/40 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" size="sm">{net.proto}</Badge>
                      <span className="text-ink font-mono select-all">
                        {defangIndicator(net.destination)}:{net.port}
                      </span>
                      <span className="text-secondary text-[10px]">({net.summary})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPivot("ip", net.destination)}
                      className="text-[10px] text-cyan hover:underline shrink-0 font-semibold"
                    >
                      Pivot IP →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === "persistence" && (
          <div>
            <h5 className="text-[10px] font-bold text-muted uppercase mb-2">Persistence Mechanisms & Scheduled Tasks</h5>
            {beh.persistenceMechanisms.length === 0 ? (
              <div className="text-[11px] text-muted italic">No persistence staging detected.</div>
            ) : (
              <div className="space-y-1.5">
                {beh.persistenceMechanisms.map((pst: string, idx: number) => (
                  <div key={idx} className="bg-surface p-2 rounded-xs border border-danger/30 text-[11px] text-danger select-all break-all">
                    {pst}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
