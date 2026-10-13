"use client";

import type { CmdbResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { Badge } from "@/components/ui/Badge";
import { IconShield, IconInfo, IconAlertTriangle, IconClock, IconKey } from "@/components/ui/icons";

type Props = {
  data: CmdbResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function CmdbDirectoryPanel({ data, onPivot, onAttachEvidence }: Props) {
  const record = data.record;
  const asset = record && record.kind === "asset" ? record : null;
  const user = record && record.kind === "user" ? record : null;
  const isStale = record?.isStale;
  const staleNotice = record?.staleNotice;

  return (
    <div className="space-y-4 p-4 text-xs font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <span className="text-[10px] text-muted uppercase tracking-wider">CMDB & Corporate Identity Directory (CorpHive)</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">
            Profile: {data.entity.value}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`CMDB verification for ${data.entity.value}: role=${asset?.role ?? user?.role ?? "unassigned"}`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Stale Record Notice if applicable */}
      {isStale && (
        <div className="rounded-xs border border-amber/40 bg-amber/10 p-3 space-y-1">
          <div className="flex items-center gap-2 text-amber font-bold">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            <span>Mildly Stale Directory Entry</span>
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
            {staleNotice ??
              "This record was last updated over 180 days ago during quarterly asset audits. Department transfers or IP reassignments may not be reflected in current inventory."}
          </p>
        </div>
      )}

      {/* Asset Profile Card */}
      {asset && (
        <div className="rounded-xs border border-line bg-surface p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-line/40 pb-2">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <IconShield className="h-3.5 w-3.5 text-cyan" />
              Host Asset Profile ({asset.hostname})
            </span>
            <Badge
              variant={asset.criticality === "CRITICAL" ? "danger" : "outline"}
              size="sm"
            >
              {asset.criticality} CRITICALITY
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted">Assigned IP / Network Zone:</span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onPivot("ip", asset.ip)}
                  className="text-cyan font-semibold hover:underline"
                >
                  {asset.ip}
                </button>
                <span className="text-muted">({asset.zone})</span>
              </div>
            </div>
            <div>
              <span className="text-muted">Asset Role & Purpose:</span>
              <div className="text-ink font-semibold">{asset.role}</div>
            </div>
            <div>
              <span className="text-muted">Operating System:</span>
              <div className="text-ink">{asset.os}</div>
            </div>
            <div>
              <span className="text-muted">Custodian / Business Owner:</span>
              <button
                type="button"
                onClick={() => onPivot("user", asset.owner)}
                className="text-cyan font-semibold hover:underline block pt-0.5"
              >
                {asset.owner}
              </button>
            </div>
          </div>

          {asset.maintenanceWindows && asset.maintenanceWindows.length > 0 && (
            <div className="border-t border-line/40 pt-2 space-y-1">
              <span className="text-muted text-[10px] uppercase font-bold flex items-center gap-1">
                <IconClock className="h-3 w-3 text-cyan" /> Approved Maintenance Windows:
              </span>
              <div className="space-y-1 text-[11px] text-secondary">
                {asset.maintenanceWindows.map((mw: string, idx: number) => (
                  <div key={idx} className="bg-console p-1.5 rounded-xs border border-line/40">
                    {mw}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Identity Profile Card */}
      {user && (
        <div className="rounded-xs border border-line bg-surface p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-line/40 pb-2">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <IconInfo className="h-3.5 w-3.5 text-cyan" />
              Identity & Directory Profile ({user.username})
            </span>
            <span className="text-muted text-[10px]">ID: {user.id}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted">Full Name:</span>
              <div className="text-ink font-semibold">{user.displayName}</div>
            </div>
            <div>
              <span className="text-muted">Department:</span>
              <div className="text-ink font-semibold">{user.department}</div>
            </div>
            <div>
              <span className="text-muted">Official Role:</span>
              <div className="text-ink font-semibold">{user.role}</div>
            </div>
            <div>
              <span className="text-muted">Reporting Manager:</span>
              <div className="text-ink">{user.manager}</div>
            </div>
            <div>
              <span className="text-muted">Standard Working Hours:</span>
              <div className="text-ink">{user.workingHours}</div>
            </div>
            <div>
              <span className="text-muted">Recent Sign-in Telemetry:</span>
              <div className="text-ink">
                {user.recentSignIns.length > 0
                  ? `${user.recentSignIns[0].timestamp} (${user.recentSignIns[0].location})`
                  : "No recent sign-ins recorded"}
              </div>
            </div>
          </div>

          {user.privilegedGroups && user.privilegedGroups.length > 0 && (
            <div className="border-t border-line/40 pt-2 space-y-1">
              <span className="text-muted text-[10px] uppercase font-bold flex items-center gap-1">
                <IconKey className="h-3 w-3 text-amber" /> Privileged Access & Security Groups:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {user.privilegedGroups.map((grp: string) => (
                  <Badge key={grp} variant="amber" size="sm">
                    {grp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!asset && !user && (
        <div className="rounded-sm border border-line bg-surface/50 p-6 text-center space-y-2">
          <IconShield className="h-8 w-8 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-ink">Entity Not Found in Corporate CMDB</h4>
          <p className="text-secondary max-w-sm mx-auto leading-relaxed">
            The queried host or username does not exist in CorpHive enterprise asset management or identity directory.
          </p>
        </div>
      )}
    </div>
  );
}
