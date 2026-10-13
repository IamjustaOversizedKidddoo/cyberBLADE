"use client";

import type { TicketHistoryResult, EntityType } from "@/lib/lab-engine/soc/enrichment/types";
import { Badge } from "@/components/ui/Badge";
import { IconCheck, IconClock, IconAlertTriangle, IconFile } from "@/components/ui/icons";

type Props = {
  data: TicketHistoryResult;
  onPivot: (type: EntityType, value: string) => void;
  onAttachEvidence?: (summary: string) => void;
};

export function ServiceTicketsPanel({ data, onPivot, onAttachEvidence }: Props) {
  if (!data.hasData || data.tickets.length === 0) {
    return (
      <div className="space-y-4 p-4 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <span className="text-[10px] text-muted uppercase tracking-wider">Indicator / Asset</span>
            <div className="text-ink font-bold">{data.entity.value}</div>
          </div>
          <Badge variant="outline" size="sm">SERVICEDESK</Badge>
        </div>

        <div className="rounded-sm border border-line bg-surface/50 p-6 text-center space-y-2">
          <IconFile className="h-8 w-8 text-muted mx-auto" />
          <h4 className="text-sm font-bold text-ink">No ServiceDesk Tickets or Change Authorizations</h4>
          <p className="text-secondary max-w-sm mx-auto leading-relaxed">
            There are no documented IT change requests, scheduled maintenance windows, access grants, or authorized security penetration test notices associated with this entity.
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
          <span className="text-[10px] text-muted uppercase tracking-wider">Internal IT ServiceDesk & Change Management Records</span>
          <div className="text-ink font-bold text-sm truncate max-w-md">
            Target Entity: {data.entity.value} ({data.tickets.length} tickets found)
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAttachEvidence && (
            <button
              type="button"
              onClick={() => onAttachEvidence(`ServiceDesk ticket check for ${data.entity.value}: ${data.tickets.length} tickets reviewed`)}
              className="rounded-xs border border-cyan/40 bg-cyan/10 px-2 py-1 text-[11px] text-cyan hover:bg-cyan/20 font-semibold"
            >
              + Attach to Case
            </button>
          )}
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-3">
        {data.tickets.map((t) => {
          const statusBadge =
            t.status === "approved"
              ? "emerald"
              : t.status === "in_progress"
              ? "cyan"
              : t.status === "rejected"
              ? "danger"
              : "outline";

          return (
            <div
              key={t.id}
              className="rounded-xs border border-line bg-surface p-3 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-cyan font-bold">{t.id}</span>
                  <Badge variant="outline" size="sm">
                    {t.category.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>
                <Badge variant={statusBadge} size="sm">
                  {t.status.toUpperCase()}
                </Badge>
              </div>

              <div>
                <h5 className="font-bold text-ink text-[12px]">{t.title}</h5>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted pt-1">
                  <div>
                    <span>Submitter:</span> <strong className="text-ink">{t.submitter}</strong>
                  </div>
                  <div>
                    <span>Approver:</span> <strong className="text-ink">{t.approver}</strong>
                  </div>
                </div>
              </div>

              {/* Time Window */}
              <div className="bg-console p-2 rounded-xs border border-line/40 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-secondary">
                  <IconClock className="h-3.5 w-3.5 text-cyan shrink-0" />
                  <span>
                    {new Date(t.scheduledStart).toLocaleString()} – {new Date(t.scheduledEnd).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details & Relevance Explanation */}
              <p className="text-[11px] text-secondary leading-relaxed bg-surface/50 p-2 rounded-xs border border-line/30">
                {t.notes}
              </p>

              {t.relevanceExplanation && (
                <div className="text-[10px] text-muted italic border-t border-line/30 pt-1">
                  Context: {t.relevanceExplanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
