"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { LabEnv } from "@/lib/lab-engine/env";
import { PacketLab } from "./packet/PacketLab";
import { WebAppLab } from "./webapp/WebAppLab";
import { SiemLab } from "./siem/SiemLab";
import { ObjectivesPanel, type Objective, type SubmitResult } from "./ObjectivesPanel";

// xterm.js needs the DOM: render the terminal in the browser only.
const TerminalLab = dynamic(() => import("./terminal/TerminalLab"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] border border-line bg-console p-4 font-mono text-muted flex items-center justify-center">
      <span className="animate-pulse">Connecting to terminal engine…</span>
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

  return (
    <div className="space-y-6">
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
