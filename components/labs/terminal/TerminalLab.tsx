"use client";

import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";
import { createLineEditor } from "./line-editor";

const PINK = "\x1b[38;2;255;16;101m";
const CYAN = "\x1b[38;2;15;190;255m";
const RESET = "\x1b[0m";

/** The simulated machine runs entirely in the browser; only answers are checked on the server. */
export default function TerminalLab({ world }: { world: World }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    fit.fit();

    const shell = createShell(world);
    const editor = createLineEditor();
    const history: string[] = [];
    let cursor = 0;
    const prompt = () => term.write(`${CYAN}${shell.prompt()}${RESET}`);

    term.writeln(`Connected to ${world.hostname}. This machine is a simulation you are allowed to explore.`);
    term.writeln(`Type ${CYAN}help${RESET} to see the commands.\n`);
    prompt();

    const sub = term.onData((data) => {
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
          const result = shell.exec(ev.line);
          if (result.clear) term.clear();
          if (result.stdout) term.write(result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`);
          if (result.stderr) term.write(`${PINK}${result.stderr}${RESET}`);
          prompt();
        }
      }
    });

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    term.focus();
    return () => {
      window.removeEventListener("resize", onResize);
      sub.dispose();
      term.dispose();
    };
  }, [world]);

  return <div ref={host} className="h-[420px] w-full border border-line bg-[#05070a] p-2" aria-label="Lab terminal" />;
}
