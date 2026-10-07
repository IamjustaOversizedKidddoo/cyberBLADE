"use client";

import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useMemo, useRef } from "react";
import type { CmdResult } from "@/lib/lab-engine/terminal/commands";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";
import type { SubmitResult } from "../ObjectivesPanel";
import { createLineEditor } from "./line-editor";

const PINK = "\x1b[38;2;255;16;101m";
const CYAN = "\x1b[38;2;15;190;255m";
const RESET = "\x1b[0m";

/** The simulated machine runs entirely in the browser; only answers are checked on the server. */
type Props = {
  world: World;
  objectives: { id: string; prompt: string }[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
};

export default function TerminalLab({ world, objectives, onSubmit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Latest values without rebuilding the terminal when they change.
  const objectivesRef = useRef(objectives);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    objectivesRef.current = objectives;
    onSubmitRef.current = onSubmit;
  });
  // Re-renders can hand us a new but identical world object; only a different machine should
  // rebuild the terminal (otherwise the learner's session would be wiped mid-lab).
  const worldJson = useMemo(() => JSON.stringify(world), [world]);

  useEffect(() => {
    const world: World = JSON.parse(worldJson);
    if (!host.current) return;
    const mono = getComputedStyle(document.body).getPropertyValue("--font-jbmono").trim() || "monospace";
    const term = new Terminal({
      convertEol: true,
      cursorBlink: document.documentElement.dataset.motion !== "reduce",
      fontFamily: mono,
      fontSize: 14,
      theme: { background: "#05070a", foreground: "#ffffff", cursor: "#0fbeff", selectionBackground: "#0fbeff55" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    // Fit whenever the container's size settles or changes (it can be 0×0 on the first frame).
    const safeFit = () => {
      if (host.current && host.current.clientWidth > 0 && host.current.clientHeight > 0) fit.fit();
    };
    safeFit();
    const resizeObserver = new ResizeObserver(safeFit);
    resizeObserver.observe(host.current);

    const shell = createShell(world);
    const editor = createLineEditor();
    const history: string[] = [];
    let cursor = 0;
    const prompt = () => term.write(`${CYAN}${shell.prompt()}${RESET}`);

    term.writeln(`Connected to ${world.hostname}. This machine is a simulation you are allowed to explore.`);
    term.writeln(`Type ${CYAN}help${RESET} to see the commands. Send answers with ${CYAN}submit <number> <answer>${RESET}.\n`);
    prompt();

    let busy = false;

    // `submit N answer` from the shell: check it on the server, print the verdict, then re-prompt.
    async function sendAnswer(request: NonNullable<CmdResult["submit"]>) {
      const list = objectivesRef.current;
      const objective = list[request.objective - 1];
      if (!objective) {
        term.write(`${PINK}submit: there is no objective ${request.objective} (this lab has ${list.length})${RESET}\n`);
        return;
      }
      busy = true;
      term.write("checking…\r");
      try {
        const r = await onSubmitRef.current(objective.id, request.answer);
        term.write("\x1b[2K");
        if (r.expired) term.write(`${PINK}Time is up — this attempt has ended.${RESET}\n`);
        else if (r.correct) term.write(`${CYAN}✓ Correct — objective ${request.objective} solved.${RESET}\n`);
        else term.write(`${PINK}✗ Not quite. Keep digging.${RESET}\n`);
      } catch {
        term.write(`\x1b[2K${PINK}Could not check that answer. Try again.${RESET}\n`);
      } finally {
        busy = false;
      }
    }

    const sub = term.onData((data) => {
      if (busy) return;
      for (const ev of editor.feed(data)) {
        if (ev.type === "echo") term.write(ev.text);
        else if (ev.type === "clear") {
          term.clear();
          term.write("\x1b[2K\r");
          prompt();
          term.write(editor.buffer());
        } else if (ev.type === "interrupt") prompt();
        else if (ev.type === "history") {
          if (!history.length) continue;
          cursor = ev.direction === "prev" ? Math.max(0, cursor - 1) : Math.min(history.length, cursor + 1);
          term.write(editor.replace(history[cursor] ?? ""));
        } else if (ev.type === "submit") {
          if (ev.line.trim()) history.push(ev.line);
          cursor = history.length;
          let result: CmdResult;
          try {
            result = shell.exec(ev.line);
          } catch {
            // Never leave the learner without a prompt, whatever the engine hits.
            result = { stdout: "", stderr: "bash: internal error — please report this command\n", code: 1 };
          }
          if (result.clear) term.clear();
          if (result.stdout) term.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
          if (result.stderr) term.write(`${PINK}${result.stderr}${RESET}`);
          if (result.submit) {
            void sendAnswer(result.submit).then(prompt);
            return;
          }
          prompt();
        }
      }
    });

    term.focus();
    return () => {
      resizeObserver.disconnect();
      sub.dispose();
      term.dispose();
    };
  }, [worldJson]);

  return <div ref={host} className="h-[420px] w-full border border-line bg-[#05070a] p-2" aria-label="Lab terminal" />;
}
