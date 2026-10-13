"use client";

import { useState } from "react";
import type { SocAlertClient, SocScenarioClient, SocDisposition, SocSeverity, SocEscalationTier } from "@/lib/lab-engine/soc/schema";
import type { SocDecisionRecord } from "@/lib/lab-engine/soc/types";
import { Badge } from "@/components/ui/Badge";
import { IconCopy, IconCheck, IconShield, IconInfo } from "@/components/ui/icons";
import { TriageDecisionForm } from "./TriageDecisionForm";

type Props = {
  alert: SocAlertClient;
  scenario: SocScenarioClient;
  existingDecision?: SocDecisionRecord;
  onSelectRelatedAlert: (alertId: string) => void;
  onSaveDecision: (input: {
    disposition: SocDisposition;
    severity: SocSeverity;
    escalate: boolean;
    targetTier?: SocEscalationTier;
    rationale: string;
    evidenceRefs?: string[];
  }) => Promise<void>;
  onUndoDecision?: (alertId: string) => Promise<void>;
  onOpenEnrichment?: (target: {
    tool: "reputation" | "whois" | "pdns" | "email_headers" | "url_analysis" | "sandbox" | "pcap_flows" | "endpoint_timeline" | "cmdb" | "tickets";
    entityType: "ip" | "domain" | "url" | "hash" | "email" | "user" | "host";
    entityValue: string;
  }) => void;
};

export function AlertDetailPanel({
  alert,
  scenario,
  existingDecision,
  onSelectRelatedAlert,
  onSaveDecision,
  onUndoDecision,
  onOpenEnrichment,
}: Props) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [copied, setCopied] = useState(false);

  // Look up asset in environment inventory
  const asset = scenario.environment.assets.find(
    (a) => a.hostname === alert.relatedAsset || a.ip === alert.relatedAsset,
  );

  // Look up user in environment inventory
  const user = scenario.environment.users.find(
    (u) => u.username === alert.relatedUser || u.id === alert.relatedUser,
  );

  // Find other alerts correlated by same asset or user
  const relatedAlerts = scenario.alerts.filter((a) => {
    if (a.id === alert.id) return false;
    if (alert.relatedAsset && a.relatedAsset === alert.relatedAsset) return true;
    if (alert.relatedUser && a.relatedUser === alert.relatedUser) return true;
    return false;
  });

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(alert, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      tabIndex={0}
      aria-label="Alert Details and Triage Panel"
      className="flex flex-col h-full overflow-y-auto space-y-4 p-4 font-mono text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
    >
      {/* Alert Header Box */}
      <div className="rounded-sm border border-line bg-console p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-cyan">{alert.id}</span>
            <Badge variant="cyan" size="sm">{alert.source}</Badge>
            <Badge
              variant={
                alert.severity === "CRITICAL"
                  ? "danger"
                  : alert.severity === "HIGH"
                  ? "amber"
                  : "outline"
              }
              size="sm"
            >
              {alert.severity}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>{new Date(alert.timestamp).toISOString()}</span>
            {onOpenEnrichment && (
              <button
                type="button"
                onClick={() => {
                  const targetVal =
                    (alert.relatedIocs && alert.relatedIocs[0]?.value) ||
                    (alert.rawFields.sourceIp as string) ||
                    (alert.rawFields.destinationIp as string) ||
                    (alert.rawFields.hash as string) ||
                    alert.relatedAsset ||
                    alert.id;
                  let tool: "reputation" | "whois" | "pdns" | "email_headers" | "url_analysis" | "sandbox" | "pcap_flows" | "endpoint_timeline" | "cmdb" | "tickets" = "reputation";
                  let type: "ip" | "domain" | "url" | "hash" | "email" | "user" | "host" = "ip";
                  if (alert.source === "Email Gateway") {
                    tool = "email_headers";
                    type = "domain";
                  } else if (alert.source === "EDR") {
                    tool = "endpoint_timeline";
                    type = "host";
                  } else if (alert.source === "Network IDS" || alert.source === "Firewall") {
                    tool = "pcap_flows";
                    type = "ip";
                  }
                  onOpenEnrichment({ tool, entityType: type, entityValue: targetVal });
                }}
                className="inline-flex items-center gap-1 rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-[10px] text-cyan hover:bg-cyan/20 font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                <IconShield className="h-3 w-3" /> Investigate
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-2 py-0.5 text-[10px] text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              title="Copy alert JSON"
            >
              {copied ? (
                <>
                  <IconCheck className="h-3 w-3 text-success" /> Copied
                </>
              ) : (
                <>
                  <IconCopy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink mb-1">{alert.ruleName}</h2>
          <p className="text-secondary leading-normal">{alert.summary}</p>
        </div>
      </div>

      {/* Asset Inventory CMDB & User Context Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Asset Details */}
        <div className="rounded-xs border border-line bg-surface p-3 space-y-1.5">
          <span className="text-[11px] font-bold text-ink flex items-center gap-1.5">
            <IconShield className="h-3.5 w-3.5 text-cyan" />
            CMDB Asset Profile
          </span>
          {asset ? (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Host:</span>
                <span className="text-ink font-semibold">{asset.hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">IP / Zone:</span>
                <span className="text-ink">{asset.ip} ({asset.zone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Role & OS:</span>
                <span className="text-ink">{asset.role} • {asset.os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Criticality:</span>
                <span className={`font-bold ${asset.criticality === "CRITICAL" ? "text-danger" : "text-ink"}`}>
                  {asset.criticality}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Custodian:</span>
                <span className="text-ink">{asset.owner}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted italic">
              {alert.relatedAsset ? `Unindexed Host: ${alert.relatedAsset}` : "No specific host referenced."}
            </div>
          )}
        </div>

        {/* User Details */}
        <div className="rounded-xs border border-line bg-surface p-3 space-y-1.5">
          <span className="text-[11px] font-bold text-ink flex items-center gap-1.5">
            <IconInfo className="h-3.5 w-3.5 text-cyan" />
            User Identity Profile
          </span>
          {user ? (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">User:</span>
                <span className="text-ink font-semibold">{user.username} ({user.displayName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Dept & Role:</span>
                <span className="text-ink">{user.department} • {user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email:</span>
                <span className="text-ink">{user.email}</span>
              </div>
              {user.riskScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted">Risk Score:</span>
                  <span className="text-ink font-bold">{user.riskScore}/100</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted italic">
              {alert.relatedUser ? `User ID: ${alert.relatedUser}` : "System / machine-level process."}
            </div>
          )}
        </div>
      </div>

      {/* Raw Event & Field Inspector */}
      <div className="rounded-sm border border-line bg-console p-3 space-y-2">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <span className="text-xs font-bold text-ink">
            Telemetry Inspector ({Object.keys(alert.rawFields).length} fields)
          </span>
          <div className="flex items-center rounded-xs border border-line bg-surface p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode("formatted")}
              className={`px-2 py-0.5 rounded-xs ${
                viewMode === "formatted" ? "bg-cyan/20 text-cyan font-bold" : "text-muted hover:text-ink"
              }`}
            >
              Key-Value
            </button>
            <button
              type="button"
              onClick={() => setViewMode("raw")}
              className={`px-2 py-0.5 rounded-xs ${
                viewMode === "raw" ? "bg-cyan/20 text-cyan font-bold" : "text-muted hover:text-ink"
              }`}
            >
              Raw JSON
            </button>
          </div>
        </div>

        {viewMode === "formatted" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {Object.entries(alert.rawFields).map(([key, val]) => (
              <div
                key={key}
                className="rounded-xs border border-line/40 bg-surface/50 p-2 overflow-hidden flex flex-col"
              >
                <span className="text-muted text-[10px] font-semibold">{key}</span>
                <span className="text-ink truncate font-mono select-all">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <pre
            tabIndex={0}
            aria-label="Raw event JSON payload"
            className="p-2.5 rounded-xs bg-surface/80 border border-line/40 text-[11px] text-ink overflow-x-auto max-h-56 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            {JSON.stringify(alert.rawFields, null, 2)}
          </pre>
        )}
      </div>

      {/* Correlated Entities & Related Alerts */}
      {relatedAlerts.length > 0 && (
        <div className="rounded-sm border border-line bg-surface p-3 space-y-2">
          <span className="text-xs font-bold text-ink flex items-center justify-between">
            <span>Correlated Alerts ({relatedAlerts.length})</span>
            <span className="text-[10px] text-muted font-normal">Same Host or User</span>
          </span>
          <div
            tabIndex={0}
            aria-label="Correlated alerts list"
            className="divide-y divide-line/30 max-h-40 overflow-y-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            {relatedAlerts.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectRelatedAlert(rel.id)}
                className="py-1.5 flex items-center justify-between cursor-pointer hover:bg-surface-hover/80 px-1 rounded-xs transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="text-[10px] text-cyan font-bold">{rel.id}</span>
                  <span className="text-[11px] text-ink truncate">{rel.ruleName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                  <Badge variant="outline" size="sm">{rel.severity}</Badge>
                  <span className="text-muted">{new Date(rel.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Decision Form */}
      <TriageDecisionForm
        key={alert.id}
        alert={alert}
        existingDecision={existingDecision}
        instantFeedbackEnabled={Boolean(scenario.instantFeedback)}
        onSaveDecision={onSaveDecision}
        onUndoDecision={onUndoDecision}
      />
    </div>
  );
}
