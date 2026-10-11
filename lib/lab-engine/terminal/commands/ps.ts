import { commOf, type Proc } from "../processes";
import type { Command } from "./types";
import { fail, ok } from "./util";

function formatTimeEF(cpuTime: string): string {
  const parts = cpuTime.split(":");
  const min = parts[0] ?? "0";
  const sec = parts[1] ?? "00";
  return `00:${min.padStart(2, "0")}:${sec.padStart(2, "0")}`;
}

export const ps: Command = {
  name: "ps",
  summary: "report a snapshot of the current processes",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const self = ctx.self;
    const allProcs: Proc[] = [...ctx.procs.list(), self];

    if (args.length === 0) {
      // Plain ps: only the user's terminal processes
      const filtered = allProcs.filter((p) => p.tty === "pts/0" && p.user === ctx.user);
      const rows = filtered.map((p) => {
        const pid = String(p.pid).padStart(7);
        const tty = p.tty.padEnd(8);
        const time = formatTimeEF(p.cpuTime);
        const cmd = commOf(p);
        return `${pid} ${tty} ${time} ${cmd}`;
      });
      return ok(`    PID TTY          TIME CMD\n${rows.length ? rows.join("\n") + "\n" : ""}`);
    }

    const isAux = args.length === 1 && (args[0] === "aux" || args[0] === "-aux" || args[0] === "ax");
    if (isAux) {
      const rows = allProcs.map((p) => {
        const user = p.user.length > 8 ? p.user.slice(0, 7) + "+" : p.user.padEnd(8);
        const pid = String(p.pid).padStart(7);
        const cpu = p.cpu.toFixed(1).padStart(4);
        const mem = p.mem.toFixed(1).padStart(4);
        const vsz = String(p.vsz).padStart(6);
        const rss = String(p.rss).padStart(5);
        const tty = p.tty.padEnd(8);
        const stat = (p.stat ?? p.state).padEnd(4);
        const start = p.start;
        const time = p.cpuTime.padStart(6);
        const cmd = p.argv.join(" ");
        return `${user} ${pid} ${cpu} ${mem} ${vsz} ${rss} ${tty} ${stat} ${start} ${time} ${cmd}`;
      });
      return ok(`USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n${rows.join("\n")}\n`);
    }

    const isEF =
      (args.length === 1 && args[0] === "-ef") ||
      (args.length === 2 && ((args[0] === "-e" && args[1] === "-f") || (args[0] === "-f" && args[1] === "-e")));
    if (isEF) {
      const rows = allProcs.map((p) => {
        const uid = p.user.length > 8 ? p.user.slice(0, 7) + "+" : p.user.padEnd(8);
        const pid = String(p.pid).padStart(7);
        const ppid = String(p.ppid).padStart(7);
        const c = String(p.cpu).padStart(2);
        const stime = p.start;
        const tty = p.tty.padEnd(8);
        const time = formatTimeEF(p.cpuTime);
        const cmd = p.argv.join(" ");
        return `${uid} ${pid} ${ppid} ${c} ${stime} ${tty} ${time} ${cmd}`;
      });
      return ok(`UID          PID    PPID  C STIME TTY          TIME CMD\n${rows.join("\n")}\n`);
    }

    const isEOrA = args.length === 1 && (args[0] === "-e" || args[0] === "-A");
    if (isEOrA) {
      const rows = allProcs.map((p) => {
        const pid = String(p.pid).padStart(7);
        const tty = p.tty.padEnd(8);
        const time = formatTimeEF(p.cpuTime);
        const cmd = commOf(p);
        return `${pid} ${tty} ${time} ${cmd}`;
      });
      return ok(`    PID TTY          TIME CMD\n${rows.length ? rows.join("\n") + "\n" : ""}`);
    }

    return fail("ps: this lab supports ps, ps aux and ps -ef\n");
  },
};
