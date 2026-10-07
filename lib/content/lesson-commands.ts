import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";

/** A command from a ```console block and the output the lesson shows under it (up to the next `$ ` or the fence). */
export type ConsoleExample = { command: string; shown: string };

export function consoleExamples(body: string): ConsoleExample[] {
  const examples: { command: string; lines: string[] }[] = [];
  let inConsole = false;
  let current: { command: string; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const fence = line.trim().match(/^```(\S*)/);
    if (fence) {
      inConsole = !inConsole && fence[1] === "console";
      current = null;
      continue;
    }
    if (!inConsole) continue;
    if (line.startsWith("$ ")) examples.push((current = { command: line.slice(2), lines: [] }));
    else current?.lines.push(line);
  }
  return examples.map(({ command, lines }) => ({ command, shown: lines.join("\n") }));
}

/** `$ ` lines inside ```console blocks: the commands a lesson tells the learner to type. */
export function consoleCommands(body: string): string[] {
  return consoleExamples(body).map((e) => e.command);
}

/**
 * Runs the examples in order in one shell and reports those whose shown output is not exactly what
 * the lab shell prints, so a lesson can never show a learner output they will not see.
 */
export function outputMismatches(examples: ConsoleExample[], world: World): string[] {
  const shell = createShell(world);
  const problems: string[] = [];
  for (const { command, shown } of examples) {
    const r = shell.exec(command);
    const printed = (r.stdout + r.stderr).replace(/\n$/, "");
    if (printed !== shown) problems.push(`$ ${command} → lesson shows ${JSON.stringify(shown)}, the lab shell prints ${JSON.stringify(printed)}`);
  }
  return problems;
}

/**
 * Runs the commands in order in one shell (so `cd` carries over) and reports the ones the lab
 * shell cannot run: unknown commands and syntax errors. Ordinary failures (a missing file) are fine.
 */
export function runConsoleCommands(commands: string[], world: World): string[] {
  const shell = createShell(world);
  const problems: string[] = [];
  for (const cmd of commands) {
    const result = shell.exec(cmd);
    if (result.code === 127 || result.stderr.startsWith("bash: syntax error")) {
      problems.push(`$ ${cmd} → ${result.stderr.trim()}`);
    }
  }
  return problems;
}
