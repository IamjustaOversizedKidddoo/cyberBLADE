"use client";

import { getLabDebrief, type LabDebrief } from "@/lib/content/debriefs";
import { IconCheck } from "@/components/ui/icons";

type Props = {
  labId: string;
};

export function LabDebriefCard({ labId }: Props) {
  const debrief = getLabDebrief(labId);
  if (!debrief) return null;

  return (
    <aside
      aria-label="Mission debrief"
      className="mt-6 rounded-sm border-2 border-cyan/60 bg-console p-3.5 sm:p-5 shadow-[0_0_25px_rgba(15,190,255,0.12)] space-y-4 max-w-full overflow-hidden break-words"
    >
      <div className="flex flex-wrap items-center justify-between border-b border-cyan/30 pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-cyan animate-pulse shrink-0" aria-hidden="true" />
          <h3 className="font-ui text-xs font-bold tracking-wider text-cyan uppercase truncate sm:whitespace-normal">
            MISSION DEBRIEF // OPERATIONAL SYNTHESIS
          </h3>
        </div>
        <span className="font-mono text-[11px] text-muted uppercase shrink-0">
          ID: {labId}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
        <div className="rounded-xs border border-line bg-surface/70 p-3 space-y-1">
          <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-cyan flex items-center gap-1.5">
            <IconCheck className="h-3.5 w-3.5 text-cyan" />
            <span>CORE SECURITY CONCEPT</span>
          </div>
          <p className="text-ink leading-relaxed">{debrief.concept}</p>
        </div>

        <div className="rounded-xs border border-line bg-surface/70 p-3 space-y-1">
          <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-purple flex items-center gap-1.5">
            <span>🌐 REAL-WORLD RELEVANCE</span>
          </div>
          <p className="text-ink leading-relaxed">{debrief.realWorld}</p>
        </div>

        <div className="rounded-xs border border-line bg-surface/70 p-3 space-y-1">
          <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>⚠️ COMMON OPERATOR PITFALL</span>
          </div>
          <p className="text-secondary leading-relaxed">{debrief.commonMistake}</p>
        </div>

        <div className="rounded-xs border border-line bg-surface/70 p-3 space-y-1">
          <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span>🚀 GO FURTHER // ADVANCED DRILL</span>
          </div>
          <p className="text-secondary leading-relaxed">{debrief.goFurther}</p>
        </div>
      </div>

      {debrief.defenderView && (
        <div
          data-testid="lab-debrief-defender-view"
          className="rounded-xs border border-emerald-500/50 bg-emerald-950/20 p-3.5 sm:p-4 space-y-1.5 shadow-[0_0_20px_rgba(16,185,129,0.06)] max-w-full overflow-hidden break-words"
        >
          <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden="true" />
            <span>🛡️ DEFENDER VIEW // DETECTION, TELEMETRY & HARDENING</span>
          </div>
          <p className="text-ink leading-relaxed font-sans text-xs break-words">
            {debrief.defenderView}
          </p>
        </div>
      )}
    </aside>
  );
}
