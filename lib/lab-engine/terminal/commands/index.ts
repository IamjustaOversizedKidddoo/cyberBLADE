import { cat } from "./cat";
import { cd } from "./cd";
import { echo } from "./echo";
import { grep } from "./grep";
import { head, tail } from "./head-tail";
import { ls } from "./ls";
import { mkdir } from "./mkdir";
import { pwd } from "./pwd";
import { clear, history, hostname, whoami } from "./simple";
import { touch } from "./touch";
import type { Command } from "./types";
import { ok } from "./util";
import { wc } from "./wc";

export type { CmdContext, CmdResult, Command } from "./types";

const help: Command = {
  name: "help",
  summary: "list the commands this lab understands",
  run() {
    const list = Object.values(COMMANDS).sort((a, b) => a.name.localeCompare(b.name));
    const width = Math.max(...list.map((c) => c.name.length));
    return ok(list.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}\n`).join(""));
  },
};

/** The Rank 0 command set. Each command lives in its own file. */
export const COMMANDS: Record<string, Command> = Object.fromEntries(
  [cat, cd, clear, echo, grep, head, help, history, hostname, ls, mkdir, pwd, tail, touch, wc, whoami].map((c) => [c.name, c]),
);
