import { cat } from "./cat";
import { cd } from "./cd";
import { echo } from "./echo";
import { curl } from "./curl";
import { dig } from "./dig";
import { grep } from "./grep";
import { head, tail } from "./head-tail";
import { ip } from "./ip";
import { ls } from "./ls";
import { mkdir } from "./mkdir";
import { ping } from "./ping";
import { pwd } from "./pwd";
import { clear, history, hostname, whoami } from "./simple";
import { ss } from "./ss";
import { submit } from "./submit";
import { touch } from "./touch";
import { traceroute } from "./traceroute";
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

/** The lab command set (Rank 0 basics + Rank 1 networking). Each command lives in its own file. */
export const COMMANDS: Record<string, Command> = Object.fromEntries(
  [cat, cd, clear, curl, dig, echo, grep, head, help, history, hostname, ip, ls, mkdir, ping, pwd, ss, submit, tail, touch, traceroute, wc, whoami].map((c) => [c.name, c]),
);
