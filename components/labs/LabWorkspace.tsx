"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { LabEnv } from "@/lib/lab-engine/env";
import { resetLabAction } from "@/app/(app)/labs/actions";
import { PacketLab } from "./packet/PacketLab";
import { WebAppLab } from "./webapp/WebAppLab";
import { SiemLab } from "./siem/SiemLab";
import { ObjectivesPanel, type Objective, type SubmitResult } from "./ObjectivesPanel";

const TerminalLab = dynamic(() => import("./terminal/TerminalLab"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] border border-line bg-console p-4 font-mono text-muted flex items-center justify-center">
      <span className="animate-pulse">Connecting to terminal engine…</span>
    </div>
  ),
});

const NetRangeLab = dynamic(() => import("./netrange/NetRangeLab"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] border border-line bg-console p-4 font-mono text-muted flex items-center justify-center">
      <span className="animate-pulse">Connecting to NetRange simulation engine…</span>
    </div>
  ),
});

const SocLabSessionLoader = dynamic(
  () => import("./soc/SocLabSessionLoader").then((m) => m.SocLabSessionLoader),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] border border-line bg-console p-4 font-mono text-muted flex items-center justify-center">
        <span className="animate-pulse">Connecting to SOC simulator…</span>
      </div>
    ),
  },
);

type Props = {
  env: LabEnv;
  objectives: Objective[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  doneMessage?: string;
  continueTo?: { href: string; label: string } | null;
  attemptId?: string;
  labId?: string;
};

/** Terminal, packet viewer, webapp or SIEM + objectives. Answers may come from either; this component owns what is solved. */
export function LabWorkspace({
  env,
  objectives,
  onSubmit,
  doneMessage = "Lab complete! XP added to your profile.",
  continueTo,
  attemptId,
  labId,
}: Props) {
  const router = useRouter();
  const [solved, setSolved] = useState(() => new Set(objectives.filter((o) => o.solved).map((o) => o.id)));
  const [status, setStatus] = useState(objectives.every((o) => o.solved) ? doneMessage : "");
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const handleReset = async () => {
    if (!attemptId || resetting) return;
    setResetting(true);
    setResetNotice(null);
    try {
      await resetLabAction(attemptId);
      setSolved(new Set());
      setStatus("");
      setResetNotice("Lab reset to clean initial state. New random seed and environment generated.");
      router.refresh();
    } catch (err: unknown) {
      setResetNotice((err as Error).message || "Failed to reset lab.");
    } finally {
      setResetting(false);
    }
  };

  const submit = useCallback(
    async (objectiveId: string, answer: string): Promise<SubmitResult> => {
      const r = await onSubmit(objectiveId, answer);
      if (r.expired) {
        setStatus("Time is up — this attempt has ended.");
        router.refresh();
        return r;
      }
      if (r.correct) setSolved((s) => new Set(s).add(objectiveId));
      if (r.labCompleted || r.passed) {
        setStatus(doneMessage);
        router.refresh();
      }
      return r;
    },
    [onSubmit, doneMessage, router],
  );

  const solvedCount = objectives.filter((o) => solved.has(o.id)).length;
  const isPentestOrRange = labId?.startsWith("pentest-") || env.kind === "netrange";

  return (
    <div className="space-y-6">
      {/* Scope Banner & Clean State Reset Control */}
      <div
        data-testid="lab-scope-banner"
        className="rounded-xs border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_15px_rgba(245,158,11,0.08)]"
      >
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-ui font-bold uppercase tracking-wider text-amber-300 block text-xs">
              ENGAGEMENT SCOPE // LAB-ONLY TARGETS
            </span>
            <span className="font-sans text-[11px] text-amber-200/90 block">
              {isPentestOrRange
                ? "Strict authorization rules: Offensive tooling must target only provisioned simulated lab systems. External or production infrastructure is strictly out-of-scope."
                : "Operational sandbox: Testing is restricted to the local exercise target space."}
            </span>
          </div>
        </div>
        {attemptId && (
          <button
            type="button"
            data-testid="reset-lab-btn"
            disabled={resetting}
            onClick={handleReset}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xs border border-amber-500/60 bg-amber-500/20 px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500 hover:text-void transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
          >
            {resetting ? "↻ Resetting..." : "↻ Clean State Reset"}
          </button>
        )}
      </div>

      {resetNotice && (
        <div
          role="status"
          data-testid="lab-reset-notice"
          className="rounded-xs border border-cyan/40 bg-cyan/10 px-4 py-2.5 font-mono text-xs text-cyan flex items-center justify-between gap-2 shadow-[0_0_12px_rgba(15,190,255,0.1)]"
        >
          <span>[SYSTEM] {resetNotice}</span>
          <button
            type="button"
            onClick={() => setResetNotice(null)}
            className="text-cyan/70 hover:text-cyan text-sm font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile Ergonomics Notice */}
      <div className="md:hidden border border-line/80 bg-surface/60 px-3.5 py-2 text-xs text-secondary rounded-xs flex items-center justify-between gap-2">
        <span>💡 Best experienced on a laptop or external keyboard.</span>
        <span className="font-mono text-[10px] text-cyan uppercase font-semibold">MOBILE_READY</span>
      </div>

      {/* Mobile Quick Navigation between stacked Workspace and Objectives */}
      <div className="md:hidden flex rounded-xs border border-line bg-surface p-1 gap-1 text-xs font-ui">
        <a
          href="#panel-workspace"
          className="flex-1 text-center py-2 min-h-[44px] flex items-center justify-center rounded-xs font-bold tracking-wider text-cyan bg-cyan/15 border border-cyan/40"
        >
          WORKSPACE [{env.kind.toUpperCase()}]
        </a>
        <a
          href="#panel-objectives"
          className="flex-1 text-center py-2 min-h-[44px] flex items-center justify-center rounded-xs font-bold tracking-wider text-muted hover:text-ink"
        >
          OBJECTIVES ({solvedCount}/{objectives.length})
        </a>
      </div>

      {/* Workspace Panel */}
      <div id="panel-workspace" className="space-y-4">
        {env.kind === "terminal" ? (
          <TerminalLab world={env.world} objectives={objectives} onSubmit={submit} />
        ) : env.kind === "packet" ? (
          <PacketLab capture={env.capture} />
        ) : env.kind === "webapp" ? (
          <WebAppLab env={env.app} attemptId={attemptId} />
        ) : env.kind === "siem" ? (
          <SiemLab env={env.siem} />
        ) : env.kind === "netrange" ? (
          <NetRangeLab
            env={env.network}
            attemptId={attemptId}
            onSubmit={submit}
            objectives={objectives}
          />
        ) : (
          <SocLabSessionLoader scenarioId={env.scenarioId} onExit={() => router.push("/labs")} />
        )}
      </div>

      {/* Objectives Panel */}
      <div id="panel-objectives" className="space-y-4">
        <ObjectivesPanel
          objectives={objectives}
          solved={solved}
          onSubmit={submit}
          status={status}
          continueTo={continueTo}
          attemptId={attemptId}
          labId={labId}
        />
      </div>
    </div>
  );
}
