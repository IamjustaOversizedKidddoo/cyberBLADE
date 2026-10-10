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
import { kill } from "./kill";
import { ls } from "./ls";
import { mkdir } from "./mkdir";
import { pgrep } from "./pgrep";
import { ping } from "./ping";
import { ps } from "./ps";
import { pwd } from "./pwd";
import { clear, history, hostname, whoami } from "./simple";
import { ss } from "./ss";
import { su } from "./su";
import { submit } from "./submit";
import { sudo } from "./sudo";
import { systemctl } from "./systemctl";
import { touch } from "./touch";
import { tr } from "./tr";
import { traceroute } from "./traceroute";
import { umask } from "./umask";
import { uname } from "./uname";
import { gi, getItem, getItemProperty, gp } from "./powershell/get-itemproperty";
import { getProcess, gps } from "./powershell/get-process";
import { getScheduledTask } from "./powershell/get-scheduledtask";
import { getService, gsv } from "./powershell/get-service";
import { getEventLog, getWinEvent } from "./powershell/get-winevent";
import { selectString, sls } from "./powershell/select-string";
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

/** The lab command set (Rank 0 basics + Rank 1 networking, Linux, and Windows). Each command lives in its own file. */
export const COMMANDS: Record<string, Command> = Object.fromEntries(
  [
    cat, cd, chgrp, chmod, chown, clear, curl, dig, echo, env, exportCmd, find,
    getEventLog, getItem, getItemProperty, getProcess, getScheduledTask, getService, getWinEvent,
    gi, gp, gps, grep, groups, gsv, head, help, history, hostname, id, ip, kill, ls, mkdir,
    pgrep, ping, ps, pwd, selectString, sls, ss, su, submit, sudo, systemctl, tail, touch,
    tr, traceroute, umask, uname, unset, wc, whoami,
  ].map((c) => [c.name, c]),
);
