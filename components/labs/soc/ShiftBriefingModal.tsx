"use client";

import type { SocScenarioClient } from "@/lib/lab-engine/soc/schema";
import { ModalFocusScope } from "@/components/ui/ModalFocusScope";
import { Badge } from "@/components/ui/Badge";
import { IconClock, IconShield, IconPlay } from "@/components/ui/icons";

type Props = {
  isOpen: boolean;
  scenario: SocScenarioClient;
  onStart: () => void;
};

export function ShiftBriefingModal({ isOpen, scenario, onStart }: Props) {
  if (!isOpen) return null;

  return (
    <ModalFocusScope onClose={onStart}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-sm border border-cyan/40 bg-console p-6 shadow-2xl space-y-5">
        <div className="border-b border-line pb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-cyan uppercase">
                SOC TIER-1 WORKSPACE • OPERATOR BRIEFING
              </span>
              <Badge variant="cyan" size="sm">{scenario.level}</Badge>
              <Badge variant="outline" size="sm">{scenario.difficulty}</Badge>
            </div>
            <h2 id="briefing-title" className="font-mono text-xl font-bold text-ink">
              {scenario.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
            <IconClock className="h-4 w-4 text-cyan" />
            <span>~{scenario.estimatedMinutes}m Shift</span>
          </div>
        </div>

        <div className="text-xs text-secondary leading-relaxed space-y-3">
          <p>{scenario.briefing}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xs border border-line bg-surface p-3 space-y-1.5">
            <span className="font-mono font-bold text-ink flex items-center gap-1.5">
              <IconShield className="h-4 w-4 text-cyan" />
              Your Role & Mission
            </span>
            <p className="text-muted text-[11px] leading-normal">
              Work the alert queue like a frontline SOC analyst. Review telemetry, inspect raw events, check asset criticality in the CMDB, and assign triage dispositions.
            </p>
          </div>

          <div className="rounded-xs border border-line bg-surface p-3 space-y-1.5">
            <span className="font-mono font-bold text-ink flex items-center gap-1.5">
              <span className="text-warning">⚖</span>
              Scoring & Integrity
            </span>
            <p className="text-muted text-[11px] leading-normal">
              You are evaluated on accuracy, noise reduction, and proper escalation. Alarmist blanket escalations and negligent dismissal of true threats are heavily penalized.
            </p>
          </div>
        </div>

        <div className="rounded-xs border border-line/60 bg-surface/50 p-3 space-y-1 text-xs">
          <span className="font-mono font-semibold text-ink">Environment Summary:</span>
          <div className="flex flex-wrap gap-4 text-[11px] text-muted font-mono pt-1">
            <span>Alerts in Queue: <strong className="text-ink">{scenario.alerts.length}</strong></span>
            <span>Monitored Assets: <strong className="text-ink">{scenario.environment.assets.length}</strong></span>
            <span>Tracked Users: <strong className="text-ink">{scenario.environment.users.length}</strong></span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted font-mono">
            Ground-truth debrief is provided upon shift submission.
          </span>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xs border border-cyan bg-cyan/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            <IconPlay className="h-3.5 w-3.5" />
            Commence Shift
          </button>
        </div>
      </div>
    </div>
    </ModalFocusScope>
  );
}
