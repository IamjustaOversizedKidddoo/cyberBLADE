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
import { IconTerminal, IconCheck } from "@/components/ui/icons";

const PINK = "\x1b[38;2;255;16;101m";
const CYAN = "\x1b[38;2;15;190;255m";
const RESET = "\x1b[0m";

// Strip ANSI codes for screen reader announcement & plain text export
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").trim();
}

type Props = {
  world: World;
  objectives: { id: string; prompt: string }[];
  onSubmit: (objectiveId: string, answer: string) => Promise<SubmitResult>;
};

export default function TerminalLab({ world, objectives, onSubmit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const feedInputRef = useRef<((data: string) => void) | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const exitTargetRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(14);
  const [screenReaderMode, setScreenReaderMode] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [showKeyBar, setShowKeyBar] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

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

  const toggleScreenReaderMode = () => {
    setScreenReaderMode((prev) => {
      const next = !prev;
      if (termRef.current) {
        termRef.current.options.screenReaderMode = next;
      }
      return next;
    });
  };

  const copyTranscript = async () => {
    const text = transcriptRef.current.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadTranscript = () => {
    const text = transcriptRef.current.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyberblade-terminal-${world.hostname || "node"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Focus out of terminal
  const leaveTerminal = () => {
    exitTargetRef.current?.focus();
  };

  const isWindows =
    world.hostname?.toLowerCase().includes("win") ||
    Boolean((world as unknown as { isPowerShell?: boolean }).isPowerShell);

  const initialFontSizeRef = useRef(fontSize);

  // Visual viewport resize handling on mobile devices (e.g. soft keyboard appearance)
  useEffect(() => {
    const handleViewportResize = () => {
      if (fitRef.current) {
        fitRef.current.fit();
      }
    };
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    window.addEventListener("orientationchange", handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("orientationchange", handleViewportResize);
    };
  }, []);

  useEffect(() => {
    const world: World = JSON.parse(worldJson);
    if (!host.current) return;
    const mono =
      getComputedStyle(document.body).getPropertyValue("--font-jbmono").trim() || "monospace";

    const term = new Terminal({
      convertEol: true,
      cursorBlink: document.documentElement.dataset.motion !== "reduce",
      fontFamily: mono,
      fontSize: initialFontSizeRef.current,
      lineHeight: 1.25,
      screenReaderMode,
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

    const banner1 = `Connected to ${world.hostname}. This machine is a simulation you are allowed to explore.`;
    const banner2 = `Type help to see commands. Send answers with submit <number> <answer>. (Press Esc+Tab to leave terminal)\n`;
    term.writeln(banner1);
    term.writeln(`Type ${CYAN}help${RESET} to see commands. Send answers with ${CYAN}submit <number> <answer>${RESET}.\n`);
    prompt();

    transcriptRef.current = [banner1, banner2, shell.prompt()];
    setLiveAnnouncement(banner1);

    let busy = false;

    async function sendAnswer(request: NonNullable<CmdResult["submit"]>) {
      const list = objectivesRef.current;
      const objective = list[request.objective - 1];
      if (!objective) {
        const msg = `submit: there is no objective ${request.objective} (this lab has ${list.length})\n`;
        term.write(`${PINK}${msg}${RESET}`);
        transcriptRef.current.push(msg);
        setLiveAnnouncement(`Error: there is no objective ${request.objective}`);
        return;
      }
      busy = true;
      term.write("checking…\r");
      try {
        const r = await onSubmitRef.current(objective.id, request.answer);
        term.write("\x1b[2K");
        if (r.expired) {
          term.write(`${PINK}Time is up — this attempt has ended.${RESET}\n`);
          setLiveAnnouncement("Time is up — this attempt has ended.");
        } else if (r.correct) {
          term.write(`${CYAN}✓ Correct — objective ${request.objective} solved.${RESET}\n`);
          setLiveAnnouncement(`Correct! Objective ${request.objective} solved.`);
        } else {
          term.write(`${PINK}✗ Not quite. Keep digging.${RESET}\n`);
          setLiveAnnouncement(`Not quite. Keep digging.`);
        }
      } catch {
        term.write(`\x1b[2K${PINK}Could not check that answer. Try again.${RESET}\n`);
        setLiveAnnouncement("Could not check that answer. Try again.");
      } finally {
        busy = false;
        prompt();
      }
    }

    const processInput = (data: string) => {
      if (busy) return;
      for (const ev of editor.feed(data)) {
        if (ev.type === "echo") {
          term.write(ev.text);
        } else if (ev.type === "clear") {
          term.clear();
          term.write("\x1b[2K\r");
          prompt();
          term.write(editor.buffer());
        } else if (ev.type === "interrupt") {
          prompt();
        } else if (ev.type === "history") {
          if (!history.length) continue;
          cursor =
            ev.direction === "prev" ? Math.max(0, cursor - 1) : Math.min(history.length, cursor + 1);
          term.write(editor.replace(history[cursor] ?? ""));
        } else if (ev.type === "submit") {
          if (ev.line.trim()) history.push(ev.line);
          cursor = history.length;
          transcriptRef.current.push(`${shell.prompt()}${ev.line}`);

          let result: CmdResult;
          try {
            result = shell.exec(ev.line);
          } catch {
            result = {
              stdout: "",
              stderr: "bash: internal error — please report this command\n",
              code: 1,
            };
          }
          if (result.clear) term.clear();
          if (result.stdout) {
            const out = result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`;
            term.write(out);
            transcriptRef.current.push(result.stdout);
            const clean = stripAnsi(result.stdout);
            if (clean) setLiveAnnouncement(clean.slice(0, 300));
          }
          if (result.stderr) {
            term.write(`${PINK}${result.stderr}${RESET}`);
            transcriptRef.current.push(result.stderr);
            const clean = stripAnsi(result.stderr);
            if (clean) setLiveAnnouncement(`Error: ${clean.slice(0, 300)}`);
          }
          if (result.submit) {
            void sendAnswer(result.submit).then(prompt);
            return;
          }
          prompt();
        }
      }
    };

    feedInputRef.current = processInput;
    const sub = term.onData(processInput);

    term.focus();
    return () => {
      resizeObserver.disconnect();
      sub.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      feedInputRef.current = null;
    };
  }, [worldJson, screenReaderMode]);

  const sendVirtualKey = (data: string) => {
    feedInputRef.current?.(data);
    termRef.current?.focus();
  };

  return (
    <div
      className={
        isMaximized
          ? "fixed inset-2 md:inset-6 z-[80] bg-console border-2 border-cyan shadow-[0_0_50px_rgba(15,190,255,0.3)] flex flex-col rounded-sm overflow-hidden"
          : "rounded-sm border border-line bg-console overflow-hidden shadow-2xl focus-within:ring-2 focus-within:ring-cyan relative"
      }
    >
      {/* Skip Past Terminal Link for Keyboard Users */}
      <a
        href="#terminal-exit"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 bg-cyan text-void px-3 py-1 font-mono text-xs font-bold rounded-xs shadow-lg"
      >
        Skip past terminal
      </a>

      {/* Screen Reader Aria-Live Polite Region */}
      <div
        aria-live="polite"
        aria-atomic="false"
        role="status"
        className="sr-only"
        aria-label="Terminal command output stream"
      >
        {liveAnnouncement}
      </div>

      {/* Terminal HUD Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line bg-surface px-3 py-2 text-xs font-mono gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>
          <div className="flex items-center gap-1.5">
            <IconTerminal className="h-3.5 w-3.5 text-cyan shrink-0" />
            <span className="font-ui text-xs font-bold tracking-wider uppercase text-ink">
              {isWindows ? "POWERSHELL 7 // WIN-NODE" : "BASH SHELL // LINUX-NODE"}
            </span>
            <span className="text-muted text-[10px] hidden sm:inline">
              ({world.hostname})
            </span>
          </div>
        </div>

        {/* Right HUD: Controls & Accessibility */}
        <div className="flex flex-wrap items-center gap-2 font-ui text-[11px]">
          {/* Screen Reader Toggle */}
          <button
            type="button"
            onClick={toggleScreenReaderMode}
            aria-pressed={screenReaderMode}
            className={`rounded-xs border px-2 py-0.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan ${
              screenReaderMode
                ? "border-cyan bg-cyan/20 text-cyan font-bold"
                : "border-line bg-surface-raised text-muted hover:text-ink"
            }`}
            aria-label="Toggle screen reader mode"
          >
            ♿ Screen Reader: {screenReaderMode ? "ON" : "OFF"}
          </button>

          {/* Copy Transcript */}
          <button
            type="button"
            onClick={copyTranscript}
            className="rounded-xs border border-line bg-surface-raised px-2 py-0.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan inline-flex items-center gap-1"
            aria-label="Copy terminal text output to clipboard"
          >
            {copiedNotice ? <IconCheck className="size-3 text-success" /> : null}
            <span>{copiedNotice ? "Copied" : "Copy Output"}</span>
          </button>

          {/* Download Transcript */}
          <button
            type="button"
            onClick={downloadTranscript}
            className="hidden sm:inline-block rounded-xs border border-line bg-surface-raised px-2 py-0.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Download terminal session transcript"
          >
            Download Log
          </button>

          {/* Font Controls */}
          <div className="flex items-center gap-1 text-muted">
            <span className="hidden sm:inline mr-0.5">TEXT:</span>
            <button
              type="button"
              onClick={() => adjustFontSize(-1)}
              disabled={fontSize <= 12}
              aria-label="Decrease terminal font size"
              className="rounded-xs border border-line bg-surface-raised px-1.5 py-0.5 text-muted hover:text-ink disabled:opacity-40"
            >
              A-
            </button>
            <span className="font-mono text-[10px] w-4 text-center">{fontSize}</span>
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

          {/* Maximize / Restore Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMaximized((m) => !m);
              setTimeout(() => fitRef.current?.fit(), 50);
            }}
            aria-label={isMaximized ? "Restore terminal window" : "Maximize terminal to full screen"}
            className="rounded-xs border border-line bg-surface-raised px-2 py-0.5 text-secondary hover:text-cyan hover:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan inline-flex items-center gap-1"
          >
            <span>{isMaximized ? "⤓ Restore" : "⤢ Maximize"}</span>
          </button>

          {/* Leave Terminal Button */}
          <button
            type="button"
            onClick={leaveTerminal}
            className="rounded-xs border border-line bg-surface-raised px-2 py-0.5 text-secondary hover:text-ink hover:border-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            aria-label="Leave terminal and move focus to next element"
          >
            Leave [Esc+Tab]
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={host}
        tabIndex={0}
        role="region"
        className={`${isMaximized ? "flex-1 min-h-[400px]" : "h-[380px] sm:h-[430px]"} w-full bg-console p-2.5 sm:p-3 overflow-hidden outline-none`}
        aria-label={`Interactive terminal connected to ${world.hostname}. Press Escape then Tab to leave.`}
      />

      {/* Mobile Virtual Key Bar (for phones & tablets lacking Esc, Ctrl, Tab, pipes) */}
      {showKeyBar && (
        <div
          className="border-t border-line/80 bg-surface px-2 py-1.5 flex items-center justify-between gap-1 overflow-x-auto text-xs font-mono"
          aria-label="Virtual key shortcuts"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => sendVirtualKey("\t")}
              className="min-h-[36px] min-w-[38px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-ink hover:border-cyan hover:text-cyan active:bg-cyan/20"
              aria-label="Tab key"
            >
              Tab
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("\x03")}
              className="min-h-[36px] min-w-[38px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-pink hover:border-pink active:bg-pink/20"
              aria-label="Ctrl+C interrupt"
            >
              ^C
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("\x1b")}
              className="min-h-[36px] min-w-[38px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-muted hover:border-cyan hover:text-ink"
              aria-label="Escape key"
            >
              Esc
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("\x1b[A")}
              className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-cyan hover:border-cyan"
              aria-label="History previous (Up arrow)"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("\x1b[B")}
              className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-cyan hover:border-cyan"
              aria-label="History next (Down arrow)"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("|")}
              className="min-h-[36px] min-w-[34px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-secondary hover:border-cyan hover:text-ink"
              aria-label="Pipe character"
            >
              |
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("~")}
              className="min-h-[36px] min-w-[34px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-secondary hover:border-cyan hover:text-ink"
              aria-label="Tilde character"
            >
              ~
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("/")}
              className="min-h-[36px] min-w-[34px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-secondary hover:border-cyan hover:text-ink"
              aria-label="Slash character"
            >
              /
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("-")}
              className="min-h-[36px] min-w-[34px] px-2 py-1 rounded-xs border border-line bg-surface-raised text-secondary hover:border-cyan hover:text-ink"
              aria-label="Hyphen character"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => sendVirtualKey("\x0c")}
              className="min-h-[36px] px-2.5 py-1 rounded-xs border border-line bg-surface-raised text-muted hover:border-cyan hover:text-ink"
              aria-label="Clear screen"
            >
              clear
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyBar(false)}
            className="text-[10px] text-muted hover:text-ink px-1 py-0.5"
            aria-label="Hide virtual key bar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Focus Anchor for Leaving the Terminal */}
      <div
        id="terminal-exit"
        ref={exitTargetRef}
        tabIndex={-1}
        className="sr-only"
      />
    </div>
  );
}
