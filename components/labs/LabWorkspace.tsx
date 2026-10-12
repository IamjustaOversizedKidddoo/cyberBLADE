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

type Props = {
  env: LabEnv;
  objectives: Objective[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  doneMessage?: string;
  continueTo?: { href: string; label: string } | null;
  attemptId?: string;
};

/** Terminal, packet viewer, webapp or SIEM + objectives. Answers may come from either; this component owns what is solved. */
export function LabWorkspace({
  env,
  objectives,
  onSubmit,
  doneMessage = "Lab complete! XP added to your profile.",
  continueTo,
  attemptId,
}: Props) {
  const router = useRouter();
  const [solved, setSolved] = useState(() => new Set(objectives.filter((o) => o.solved).map((o) => o.id)));
  const [status, setStatus] = useState(objectives.every((o) => o.solved) ? doneMessage : "");
  const [mobileTab, setMobileTab] = useState<"workspace" | "objectives">("workspace");

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

      {/* Mobile Segmented View Selector (preserves state in both DOM branches) */}
      <div
        role="tablist"
        aria-label="Lab Views"
        className="md:hidden grid grid-cols-2 rounded-xs border border-line bg-surface p-1 text-xs font-ui"
      >
        <button
          type="button"
          role="tab"
          id="tab-workspace"
          aria-selected={mobileTab === "workspace"}
          aria-controls="panel-workspace"
          onClick={() => setMobileTab("workspace")}
          className={`min-h-[44px] rounded-xs font-bold tracking-wider transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
            mobileTab === "workspace"
              ? "bg-cyan/20 text-cyan border border-cyan/40 shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          WORKSPACE [{env.kind.toUpperCase()}]
        </button>
        <button
          type="button"
          role="tab"
          id="tab-objectives"
          aria-selected={mobileTab === "objectives"}
          aria-controls="panel-objectives"
          onClick={() => setMobileTab("objectives")}
          className={`min-h-[44px] rounded-xs font-bold tracking-wider transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
            mobileTab === "objectives"
              ? "bg-cyan/20 text-cyan border border-cyan/40 shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          OBJECTIVES ({solvedCount}/{objectives.length})
        </button>
      </div>

      {/* Workspace Panel (stays mounted at all times to prevent resetting engine state) */}
      <div
        id="panel-workspace"
        role="tabpanel"
        aria-labelledby="tab-workspace"
        className={mobileTab === "workspace" ? "block" : "hidden md:block"}
      >
        {env.kind === "terminal" ? (
          <TerminalLab world={env.world} objectives={objectives} onSubmit={submit} />
        ) : env.kind === "packet" ? (
          <PacketLab capture={env.capture} />
        ) : env.kind === "webapp" ? (
          <WebAppLab env={env.app} attemptId={attemptId} />
        ) : (
          <SiemLab env={env.siem} />
        )}
      </div>

      {/* Objectives Panel (stays mounted at all times) */}
      <div
        id="panel-objectives"
        role="tabpanel"
        aria-labelledby="tab-objectives"
        className={mobileTab === "objectives" ? "block" : "hidden md:block"}
      >
        <ObjectivesPanel
          objectives={objectives}
          solved={solved}
          onSubmit={submit}
          status={status}
          continueTo={continueTo}
          attemptId={attemptId}
        />
      </div>
    </div>
  );
}
