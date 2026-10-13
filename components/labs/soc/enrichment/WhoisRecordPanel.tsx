"use client";

import { useState } from "react";
import type { WhoisResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { defangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconGlobe, IconShield, IconLock } from "@/components/ui/icons";

type Props = {
  data: WhoisResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function WhoisRecordPanel({ data, onPivot, onAttachEvidence }: Props) {
  const [copied, setCopied] = useState(false);

  const defangedValue = defangIndicator(data.entity.value);

  const handleCopy = () => {
    navigator.clipboard.writeText(defangedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data.hasData || !data.registered) {
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
          <IconGlobe className="h-8 w-8 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-ink">No Registration Record Found</h4>
          <p className="text-secondary max-w-sm mx-auto leading-relaxed">
            The queried domain or IP space has no active registration or WHOIS record in the simulation registry.
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
          <span className="text-[10px] text-muted uppercase tracking-wider">Registration Record (WHOIS)</span>
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
          <Badge variant="outline" size="sm">SIMULATED REGISTRY</Badge>
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`WHOIS record for ${defangedValue}: registered ${data.registrationDate ?? "unknown"}`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Domain Lifecycle Card */}
      <div className="rounded-xs border border-line bg-surface p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-line/40 pb-2">
          <span className="font-bold text-ink flex items-center gap-1.5">
            <IconGlobe className="h-3.5 w-3.5 text-cyan" />
            Domain Lifecycle & Registrar
          </span>
          {data.privacyProtected && (
            <Badge variant="amber" size="sm" className="inline-flex items-center gap-1">
              <IconLock className="h-3 w-3" /> Privacy Protected
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-muted">Registrar:</span>
            <div className="text-ink font-semibold">{data.registrar || "Unknown"}</div>
          </div>
          <div>
            <span className="text-muted">Registrant Organization:</span>
            <div className="text-ink font-semibold">{data.registrantOrg || "Withheld for Privacy"}</div>
          </div>
          <div>
            <span className="text-muted">Creation Date:</span>
            <div className="text-ink font-semibold">{data.registrationDate ? new Date(data.registrationDate).toLocaleDateString() : "Unknown"}</div>
          </div>
          <div>
            <span className="text-muted">Expiration Date:</span>
            <div className="text-ink font-semibold">{data.expirationDate ? new Date(data.expirationDate).toLocaleDateString() : "Unknown"}</div>
          </div>
          <div>
            <span className="text-muted">Last Registry Update:</span>
            <div className="text-ink font-semibold">{data.updatedDate ? new Date(data.updatedDate).toLocaleDateString() : "Unknown"}</div>
          </div>
        </div>
      </div>

      {/* Network Infrastructure & ASN Card */}
      <div className="rounded-xs border border-line bg-surface p-3 space-y-2.5">
        <span className="font-bold text-ink flex items-center gap-1.5 border-b border-line/40 pb-2">
          <IconShield className="h-3.5 w-3.5 text-cyan" />
          Network & Routing Allocation
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-muted">Autonomous System (ASN):</span>
            <div className="text-ink font-semibold">{data.asn || "AS64512 (Simulated Transit)"}</div>
          </div>
          <div>
            <span className="text-muted">Hosting / Cloud Provider:</span>
            <div className="text-ink font-semibold">{data.hostingProvider || "Standard Hosting"}</div>
          </div>
          <div>
            <span className="text-muted">IP Network Block:</span>
            <div className="text-ink font-semibold">{data.cidr || "198.51.100.0/24"}</div>
          </div>
          <div>
            <span className="text-muted">Country / Geo:</span>
            <div className="text-ink font-semibold">{data.registrantCountry || "XX (Reserved)"}</div>
          </div>
        </div>

        {data.nameServers && data.nameServers.length > 0 && (
          <div className="border-t border-line/40 pt-2 space-y-1">
            <span className="text-muted text-[10px] uppercase font-bold">Authoritative Name Servers:</span>
            <div className="flex flex-wrap gap-1.5">
              {data.nameServers.map((ns: string) => (
                <span key={ns} className="rounded-xs border border-line bg-console px-2 py-0.5 text-[10px] text-ink font-mono">
                  {ns}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Raw record viewer */}
      {data.rawRecord && (
        <div className="space-y-1">
          <span className="text-[10px] text-muted uppercase font-bold">Raw Registration Record:</span>
          <pre className="p-2.5 rounded-xs border border-line bg-console text-[10px] text-secondary font-mono overflow-x-auto max-h-48 select-all">
            {data.rawRecord}
          </pre>
        </div>
      )}
    </div>
  );
}
