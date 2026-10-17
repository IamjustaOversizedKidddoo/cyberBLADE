"use client";

import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState, useCallback } from "react";
import type { NetRangeEnv, NetRangeState, NetRangeCmdResult } from "@/lib/lab-engine/netrange/types";
import { execNetRangeCommand, createInitialNetRangeState } from "@/lib/lab-engine/netrange/engine";
import { formatPrompt } from "@/lib/lab-engine/netrange/commands/util";
import { dispatchNetRangeCommandAction } from "@/app/(app)/labs/actions";
import type { SubmitResult, Objective } from "../ObjectivesPanel";
import { IconTerminal, IconCheck } from "@/components/ui/icons";

type Props = {
  env: NetRangeEnv;
  attemptId?: string;
  onSubmit?: (objectiveId: string, answer: string) => Promise<SubmitResult>;
  objectives?: Objective[];
};

export default function NetRangeLab({ env, attemptId, onSubmit, objectives }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef<string>("");
  const historyIndexRef = useRef<number>(-1);
  const localHistoryRef = useRef<string[]>([]);
  const stateRef = useRef<NetRangeState>(createInitialNetRangeState(env.scenario));
  const isExecutingRef = useRef<boolean>(false);

  const [state, setState] = useState<NetRangeState>(() => createInitialNetRangeState(env.scenario));
  const [fontSize, setFontSize] = useState<number>(14);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(8);
  const [showToolbar, setShowToolbar] = useState<boolean>(true);

  const sendTerminalLine = useCallback(
    async (rawCmd: string) => {
      const term = termRef.current;
      if (!term || isExecutingRef.current) return;

      const cmd = rawCmd.trim();
      const startTime = performance.now();
      isExecutingRef.current = true;

      if (cmd) {
        localHistoryRef.current.push(cmd);
        historyIndexRef.current = localHistoryRef.current.length;
      }

      term.write("\r\n");

      let result: NetRangeCmdResult;
      try {
        if (attemptId) {
          result = await dispatchNetRangeCommandAction(attemptId, cmd, stateRef.current);
        } else {
          result = execNetRangeCommand(cmd, stateRef.current, env.scenario);
        }
      } catch (err: unknown) {
        result = {
          stdout: "",
          stderr: `Error dispatching command: ${(err as Error).message}\n`,
          code: 1,
          nextState: stateRef.current,
          prompt: formatPrompt(stateRef.current, env.scenario),
        };
      }

      const elapsed = Math.round(performance.now() - startTime);
      setLastLatencyMs(elapsed);

      // Immediately sync state refs before writing or re-enabling input
      stateRef.current = result.nextState;
      setState(result.nextState);

      // Write stdout & stderr with proper CRLF
      if (result.stdout) {
        term.write(result.stdout.replace(/\r?\n/g, "\r\n"));
      }
      if (result.stderr) {
        term.write("\x1b[31m" + result.stderr.replace(/\r?\n/g, "\r\n") + "\x1b[0m");
      }

      // Redisplay prompt
      term.write("\x1b[36m" + result.prompt + "\x1b[0m");
      lineBufferRef.current = "";
      isExecutingRef.current = false;

      // If flag was submitted, trigger objective resolution
      if (result.submit && onSubmit && objectives) {
        const objIdx = result.submit.objective - 1;
        const target = objectives[objIdx] ?? objectives.find((o) => o.id === `obj_${result.submit?.objective}`) ?? objectives[0];
        if (target) {
          onSubmit(target.id, result.submit.answer);
        }
      }
    },
    [attemptId, env.scenario, onSubmit, objectives],
  );

  // Initialize xterm
  useEffect(() => {
    if (!host.current) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host.current);

    try {
      fitAddon.fit();
    } catch {
      // ignore initial fit error
    }

    termRef.current = term;
    fitRef.current = fitAddon;

    // Welcome banner
    term.writeln("\x1b[1;36m[ CyberBLADE NetRange Engine - Tactical Attack Console ]\x1b[0m");
    term.writeln(`Scenario: \x1b[33m${env.scenario.title}\x1b[0m | Gateway: \x1b[32m${env.attackerIp}\x1b[0m`);
    term.writeln("Type \x1b[32mhelp\x1b[0m for available commands, \x1b[32mnmap\x1b[0m to scan, or \x1b[32msubmit <flag>\x1b[0m to grade.\r\n");

    const prompt = formatPrompt(stateRef.current, env.scenario);
    term.write("\x1b[36m" + prompt + "\x1b[0m");

    // Key input listener
    const disposable = term.onData((data) => {
      if (isExecutingRef.current) return;

      // Enter
      if (data === "\r") {
        const cmd = lineBufferRef.current;
        sendTerminalLine(cmd);
        return;
      }

      // Backspace
      if (data === "\x7f" || data === "\b") {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }

      // Up Arrow (History Back)
      if (data === "\x1b[A") {
        if (localHistoryRef.current.length > 0 && historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const histCmd = localHistoryRef.current[historyIndexRef.current] ?? "";
          // Clear current line buffer in terminal
          while (lineBufferRef.current.length > 0) {
            term.write("\b \b");
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
          term.write(histCmd);
          lineBufferRef.current = histCmd;
        }
        return;
      }

      // Down Arrow (History Forward)
      if (data === "\x1b[B") {
        if (historyIndexRef.current < localHistoryRef.current.length - 1) {
          historyIndexRef.current++;
          const histCmd = localHistoryRef.current[historyIndexRef.current] ?? "";
          while (lineBufferRef.current.length > 0) {
            term.write("\b \b");
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
          term.write(histCmd);
          lineBufferRef.current = histCmd;
        } else if (historyIndexRef.current === localHistoryRef.current.length - 1) {
          historyIndexRef.current = localHistoryRef.current.length;
          while (lineBufferRef.current.length > 0) {
            term.write("\b \b");
            lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          }
        }
        return;
      }

      // Ctrl + C
      if (data === "\x03") {
        term.write("^C\r\n");
        lineBufferRef.current = "";
        term.write("\x1b[36m" + formatPrompt(stateRef.current, env.scenario) + "\x1b[0m");
        return;
      }

      // Ctrl + L (Clear)
      if (data === "\x0c") {
        term.clear();
        term.write("\x1b[36m" + formatPrompt(stateRef.current, env.scenario) + "\x1b[0m" + lineBufferRef.current);
        return;
      }

      // Printable chars
      if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) {
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposable.dispose();
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [env.attackerIp, env.scenario, fontSize, sendTerminalLine]);

  const insertSnippet = (snippet: string) => {
    const term = termRef.current;
    if (!term || isExecutingRef.current) return;
    term.focus();
    lineBufferRef.current += snippet;
    term.write(snippet);
  };

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(`NetRange Console - ${env.scenario.title}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const activeHostName = state.currentHostId
    ? env.scenario.hosts.find((h) => h.id === state.currentHostId)?.hostname ?? state.currentHostId
    : "kali (local)";

  return (
    <div className="flex flex-col border border-line bg-console rounded-xs overflow-hidden shadow-2xl">
      {/* Tactical Status Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-line bg-surface/80 px-3 py-2 text-xs font-mono text-secondary gap-2">
        <div className="flex items-center gap-2">
          <IconTerminal className="h-4 w-4 text-cyan" />
          <span className="font-bold text-ink">NETRANGE::SIMULATOR</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan border border-cyan/20">
            {env.scenario.id}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="hidden sm:inline">
            Target Host: <strong className="text-ink">{activeHostName}</strong>
          </span>
          <span>
            Sessions: <strong className="text-ink">{state.sessions.length}</strong>
          </span>
          <span>
            Routes: <strong className="text-ink">{state.routes.length}</strong>
          </span>
          <span className="text-emerald-400 font-semibold">
            ⚡ {lastLatencyMs}ms
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFontSize((f) => Math.max(12, f - 1))}
            className="px-2 py-1 min-h-[32px] text-xs border border-line rounded hover:bg-white/5"
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize((f) => Math.min(18, f + 1))}
            className="px-2 py-1 min-h-[32px] text-xs border border-line rounded hover:bg-white/5"
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
          <button
            onClick={copyTranscript}
            className="px-2.5 py-1 min-h-[32px] text-xs border border-line rounded hover:bg-white/5 text-ink flex items-center gap-1"
            title="Copy output"
          >
            {isCopied ? <IconCheck className="h-3 w-3 text-emerald-400" /> : "Copy"}
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={host}
        className="w-full h-[460px] p-2 bg-console overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan/40"
        tabIndex={0}
      />

      {/* Mobile-First Ergonomic Tactical Keyboard Toolbar */}
      {showToolbar && (
        <div className="border-t border-line bg-surface/90 p-2 space-y-2">
          {/* Quick Command Snippets (>= 44px touch targets on mobile) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
            <span className="text-[10px] text-muted uppercase font-bold shrink-0 mr-1">SNIPPETS:</span>
            <button
              onClick={() => insertSnippet("nmap -sV -sC ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-cyan text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              nmap -sV -sC
            </button>
            <button
              onClick={() => insertSnippet("searchsploit ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-ink text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              searchsploit
            </button>
            <button
              onClick={() => insertSnippet("msfconsole")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-ink text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              msfconsole
            </button>
            <button
              onClick={() => insertSnippet("curl -i ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-ink text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              curl -i
            </button>
            <button
              onClick={() => insertSnippet("smbclient -L ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-ink text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              smbclient
            </button>
            <button
              onClick={() => insertSnippet("route add ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-line/80 bg-console/60 hover:border-cyan/50 text-ink text-xs font-medium shrink-0 active:scale-95 transition-transform"
            >
              route add
            </button>
            <button
              onClick={() => insertSnippet("submit ")}
              className="px-3 min-h-[44px] flex items-center justify-center rounded border border-cyan/60 bg-cyan/15 hover:bg-cyan/25 text-cyan text-xs font-bold shrink-0 active:scale-95 transition-transform"
            >
              submit flag
            </button>
          </div>

          {/* Ergonomic Control Keys */}
          <div className="flex items-center justify-between gap-1.5 text-xs font-mono">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => {
                  const term = termRef.current;
                  if (term) term.write("\t");
                }}
                className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-line bg-console hover:bg-white/5 text-ink font-semibold active:bg-cyan/20"
                title="Tab autocomplete"
              >
                TAB
              </button>
              <button
                onClick={() => {
                  const term = termRef.current;
                  if (term) {
                    term.write("^C\r\n");
                    lineBufferRef.current = "";
                    term.write("\x1b[36m" + formatPrompt(stateRef.current, env.scenario) + "\x1b[0m");
                  }
                }}
                className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-line bg-console hover:bg-white/5 text-rose-400 font-semibold active:bg-rose-900/30"
                title="Interrupt signal"
              >
                CTRL+C
              </button>
              <button
                onClick={() => {
                  const term = termRef.current;
                  if (term) {
                    term.clear();
                    term.write("\x1b[36m" + formatPrompt(stateRef.current, env.scenario) + "\x1b[0m");
                  }
                }}
                className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-line bg-console hover:bg-white/5 text-ink font-semibold active:bg-cyan/20"
                title="Clear screen"
              >
                CLEAR
              </button>
              <button
                onClick={() => {
                  if (localHistoryRef.current.length > 0 && historyIndexRef.current > 0) {
                    historyIndexRef.current--;
                    const histCmd = localHistoryRef.current[historyIndexRef.current] ?? "";
                    const term = termRef.current;
                    if (term) {
                      while (lineBufferRef.current.length > 0) {
                        term.write("\b \b");
                        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
                      }
                      term.write(histCmd);
                      lineBufferRef.current = histCmd;
                    }
                  }
                }}
                className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-line bg-console hover:bg-white/5 text-cyan font-bold active:bg-cyan/20"
                title="Previous command"
              >
                ↑
              </button>
              <button
                onClick={() => {
                  const term = termRef.current;
                  if (!term) return;
                  if (historyIndexRef.current < localHistoryRef.current.length - 1) {
                    historyIndexRef.current++;
                    const histCmd = localHistoryRef.current[historyIndexRef.current] ?? "";
                    while (lineBufferRef.current.length > 0) {
                      term.write("\b \b");
                      lineBufferRef.current = lineBufferRef.current.slice(0, -1);
                    }
                    term.write(histCmd);
                    lineBufferRef.current = histCmd;
                  }
                }}
                className="px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-line bg-console hover:bg-white/5 text-cyan font-bold active:bg-cyan/20"
                title="Next command"
              >
                ↓
              </button>
            </div>

            <button
              onClick={() => sendTerminalLine(lineBufferRef.current)}
              className="px-4 min-h-[44px] rounded border border-cyan/50 bg-cyan text-black font-bold tracking-wider hover:bg-cyan/90 active:scale-95 transition-transform flex items-center gap-1.5"
            >
              <span>EXEC</span>
              <span>⏎</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
