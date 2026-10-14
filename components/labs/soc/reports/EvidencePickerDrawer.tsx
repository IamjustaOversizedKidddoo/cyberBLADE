"use client";

import type { EvidenceAppendixItem } from "@/lib/lab-engine/soc/reports/types";
import type { SocAlertClient } from "@/lib/lab-engine/soc/schema";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alerts: SocAlertClient[];
  onAddEvidence: (item: EvidenceAppendixItem) => void;
}

let evidenceCounter = 0;

function createEvidenceId(alertId: string): string {
  evidenceCounter += 1;
  return `ev-${alertId}-${evidenceCounter}`;
}

export function EvidencePickerDrawer({ isOpen, onClose, alerts, onAddEvidence }: Props) {
  if (!isOpen) return null;

  const handleAddAlert = (alert: SocAlertClient) => {
    const item: EvidenceAppendixItem = {
      id: createEvidenceId(alert.id),
      type: "alert",
      targetId: alert.id,
      label: `${alert.ruleName} [${alert.severity}]`,
      timestamp: alert.timestamp,
      annotation: alert.summary,
    };
    onAddEvidence(item);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidence Picker Drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs font-mono text-xs"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-line bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="font-bold uppercase tracking-wider text-ink text-sm">
              Evidence Selector
            </h2>
            <p className="text-[10px] text-muted">
              Attach alerts and telemetry artifacts to your report appendix
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xs border border-line px-2 py-1 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          <div className="text-[10px] font-bold uppercase text-muted tracking-wider">
            Available Session Alerts ({alerts.length})
          </div>

          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col gap-1.5 rounded-xs border border-line bg-surface-raised p-2.5 hover:border-cyan/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{alert.ruleName}</span>
                <span className="rounded-xs bg-surface border border-line px-1.5 py-0.5 text-[10px] text-cyan">
                  {alert.id}
                </span>
              </div>
              <p className="text-[11px] text-muted line-clamp-2">{alert.summary}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted">{alert.timestamp}</span>
                <button
                  type="button"
                  onClick={() => handleAddAlert(alert)}
                  className="rounded-xs border border-cyan/40 bg-cyan/15 px-2 py-0.5 text-[11px] font-bold text-cyan hover:bg-cyan/25"
                >
                  + Attach to Report
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
