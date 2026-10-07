"use client";

import dynamic from "next/dynamic";
import type { World } from "@/lib/lab-engine/terminal/types";
import { ObjectivesPanel, type Objective, type SubmitResult } from "./ObjectivesPanel";

// xterm.js needs the DOM: render the terminal in the browser only.
const TerminalLab = dynamic(() => import("./terminal/TerminalLab"), {
  ssr: false,
  loading: () => <div className="h-[420px] border border-line bg-[#05070a] p-4 font-mono text-muted">Connecting…</div>,
});

type Props = {
  world: World;
  objectives: Objective[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  doneMessage?: string;
};

export function LabWorkspace({ world, objectives, onSubmit, doneMessage }: Props) {
  return (
    <div className="space-y-8">
      <p className="border border-line px-3 py-2 text-sm text-muted md:hidden">
        Labs work best on a laptop. You can still type here, but a keyboard helps.
      </p>
      <TerminalLab world={world} />
      <ObjectivesPanel objectives={objectives} onSubmit={onSubmit} doneMessage={doneMessage} />
    </div>
  );
}
