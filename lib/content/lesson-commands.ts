import { createShell } from "@/lib/lab-engine/terminal/shell";
import type { World } from "@/lib/lab-engine/terminal/types";

/** `$ ` lines inside ```console blocks: the commands a lesson tells the learner to type. */
export function consoleCommands(body: string): string[] {
  const commands: string[] = [];
  let inConsole = false;
  for (const line of body.split("\n")) {
    const fence = line.trim().match(/^```(\S*)/);
    if (fence) {
      inConsole = !inConsole && fence[1] === "console";
      continue;
    }
    if (inConsole && line.startsWith("$ ")) commands.push(line.slice(2));
  }
  return commands;
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
