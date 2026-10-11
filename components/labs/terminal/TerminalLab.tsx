"use client";

import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CmdResult } from "@/lib/lab-engine/terminal/commands";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";
import type { SubmitResult } from "../ObjectivesPanel";
import { createLineEditor } from "./line-editor";
import { IconTerminal } from "@/components/ui/icons";

const PINK = "\x1b[38;2;255;16;101m";
const CYAN = "\x1b[38;2;15;190;255m";
const GREEN = "\x1b[38;2;16;185;129m";
const RESET = "\x1b[0m";

type Props = {
  world: World;
  objectives: { id: string; prompt: string }[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
};

export default function TerminalLab({ world, objectives, onSubmit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [fontSize, setFontSize] = useState(14);

  // Latest values without rebuilding the terminal when they change.
  const objectivesRef = useRef(objectives);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    objectivesRef.current = objectives;
    onSubmitRef.current = onSubmit;
  });

  const worldJson = useMemo(() => JSON.stringify(world), [world]);

  // Handle font size change
  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.max(12, Math.min(18, prev + delta));
      if (termRef.current && fitRef.current) {
        termRef.current.options.fontSize = next;
        setTimeout(() => fitRef.current?.fit(), 10);
      }
      return next;
    });
  };

  const isWindows = world.hostname?.toLowerCase().includes("win") || Boolean((world as unknown as { isPowerShell?: boolean }).isPowerShell);

  useEffect(() => {
    const world: World = JSON.parse(worldJson);
    if (!host.current) return;
    const mono = getComputedStyle(document.body).getPropertyValue("--font-jbmono").trim() || "monospace";

    const term = new Terminal({
      convertEol: true,
      cursorBlink: document.documentElement.dataset.motion !== "reduce",
      fontFamily: mono,
      fontSize,
      lineHeight: 1.25,
      theme: {
        background: "#05070a",
        foreground: "#f3f6f9",
        cursor: "#0fbeff",
        cursorAccent: "#05070a",
        selectionBackground: "rgba(15, 190, 255, 0.35)",
        black: "#0a0f18",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#c084fc",
        cyan: "#0fbeff",
        white: "#f3f6f9",
        brightBlack: "#62758d",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#e879f9",
        brightCyan: "#38bdf8",
        brightWhite: "#ffffff",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    termRef.current = term;
    fitRef.current = fit;

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

    term.writeln(`Connected to ${world.hostname}. Environment simulation verified.`);
    term.writeln(`Type ${CYAN}help${RESET} for available tools. Submit flags with ${CYAN}submit <number> <answer>${RESET}.\n`);
    prompt();

    let busy = false;

    async function sendAnswer(request: NonNullable<CmdResult["submit"]>) {
      const list = objectivesRef.current;
      const objective = list[request.objective - 1];
      if (!objective) {
        term.write(`${PINK}submit: there is no objective ${request.objective} (this lab has ${list.length})${RESET}\n`);
        return;
      }
      busy = true;
      term.write("verifying answer...\r");
      try {
        const r = await onSubmitRef.current(objective.id, request.answer);
        term.write("\x1b[2K");
        if (r.expired) term.write(`${PINK}Time is up — this attempt has ended.${RESET}\n`);
        else if (r.correct) term.write(`${GREEN}✓ Correct — objective ${request.objective} solved.${RESET}\n`);
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
      termRef.current = null;
      fitRef.current = null;
    };
  }, [worldJson]);

  return (
    <div className="rounded-sm border border-line bg-console overflow-hidden shadow-2xl focus-within:ring-2 focus-within:ring-cyan">
      {/* Terminal HUD Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line bg-surface px-4 py-2 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>
          <div className="flex items-center gap-2">
            <IconTerminal className="h-3.5 w-3.5 text-cyan" />
            <span className="font-ui text-xs font-bold tracking-wider uppercase text-ink">
              {isWindows ? "POWERSHELL 7 // WIN-NODE" : "BASH SHELL // LINUX-NODE"}
            </span>
            <span className="text-muted/60 text-[10px]">
              ({world.hostname})
            </span>
          </div>
        </div>

        {/* Font Controls & Quick Shortcuts */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-ui text-[11px] text-muted">
            <span className="mr-1">TEXT:</span>
            <button
              type="button"
              onClick={() => adjustFontSize(-1)}
              disabled={fontSize <= 12}
              aria-label="Decrease terminal font size"
              className="rounded-xs border border-line bg-surface-raised px-1.5 py-0.5 text-muted hover:text-ink disabled:opacity-40"
            >
              A-
            </button>
            <span className="font-mono text-[10px] w-5 text-center">{fontSize}</span>
            <button
              type="button"
              onClick={() => adjustFontSize(1)}
              disabled={fontSize >= 18}
              aria-label="Increase terminal font size"
              className="rounded-xs border border-line bg-surface-raised px-1.5 py-0.5 text-muted hover:text-ink disabled:opacity-40"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={host}
        className="h-[430px] w-full bg-console p-3"
        aria-label="Lab terminal"
      />
    </div>
  );
}
