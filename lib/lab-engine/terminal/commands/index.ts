import { cat } from "./cat";
import { cd } from "./cd";
import { chmod } from "./chmod";
import { chgrp, chown } from "./chown";
import { echo } from "./echo";
import { env, exportCmd, unset } from "./env";
import { find } from "./find";
import { curl } from "./curl";
import { dig } from "./dig";
import { grep } from "./grep";
import { groups } from "./groups";
import { head, tail } from "./head-tail";
import { id } from "./id";
import { ip } from "./ip";
import { ls } from "./ls";
import { mkdir } from "./mkdir";
import { ping } from "./ping";
import { pwd } from "./pwd";
import { clear, history, hostname, whoami } from "./simple";
import { ss } from "./ss";
import { submit } from "./submit";
import { touch } from "./touch";
import { tr } from "./tr";
import { traceroute } from "./traceroute";
import { umask } from "./umask";
import { uname } from "./uname";
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
  [cat, cd, chgrp, chmod, chown, clear, curl, dig, echo, env, exportCmd, find, grep, groups, head, help, history, hostname, id, ip, ls, mkdir, ping, pwd, ss, submit, tail, touch, tr, traceroute, umask, uname, unset, wc, whoami].map((c) => [c.name, c]),
);
