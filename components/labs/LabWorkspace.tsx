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
  loading: () => <div className="h-[420px] border border-line bg-console p-4 font-mono text-muted">Connecting…</div>,
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

  return (
    <div className="space-y-8">
      {env.kind === "terminal" ? (
        <>
          <p className="border border-line px-3 py-2 text-sm text-muted md:hidden">
            Labs work best on a laptop. You can still type here, but a keyboard helps.
          </p>
          <TerminalLab world={env.world} objectives={objectives} onSubmit={submit} />
        </>
      ) : env.kind === "packet" ? (
        <PacketLab capture={env.capture} />
      ) : env.kind === "webapp" ? (
        <WebAppLab env={env.app} attemptId={attemptId} />
      ) : (
        <SiemLab env={env.siem} />
      )}
      <ObjectivesPanel
        objectives={objectives}
        solved={solved}
        onSubmit={submit}
        status={status}
        continueTo={continueTo}
        attemptId={attemptId}
      />
    </div>
  );
}
