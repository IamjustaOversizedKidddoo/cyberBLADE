import { commOf, type Proc } from "../../processes";
import type { Command } from "../types";
import { fail, ok } from "../util";

export const getProcess: Command = {
  name: "Get-Process",
  summary: "gets the processes that are running on the computer",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const self = ctx.self;
    const allProcs: Proc[] = [...ctx.procs.list(), self];
    let nameFilter = "";
    let idFilter: number | undefined;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-Name" && i + 1 < args.length) {
        nameFilter = args[++i];
      } else if (a === "-Id" && i + 1 < args.length) {
        idFilter = Number(args[++i]);
      } else if (!a.startsWith("-")) {
        if (/^\d+$/.test(a)) idFilter = Number(a);
        else if (!nameFilter) nameFilter = a;
      }
    }

    let filtered = allProcs;
    if (idFilter !== undefined) {
      filtered = allProcs.filter((p) => p.pid === idFilter);
      if (filtered.length === 0) {
        return fail(`Get-Process : Cannot find a process with the process identifier ${idFilter}.\n`);
      }
    } else if (nameFilter) {
      const term = nameFilter.replace(/\*/g, "").toLowerCase();
      filtered = allProcs.filter((p) => commOf(p).toLowerCase().includes(term));
      if (filtered.length === 0) {
        return fail(`Get-Process : Cannot find a process with the name '${nameFilter}'.\n`);
      }
    }

    const header = "Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id ProcessName\n-------  ------    -----      -----     ------     -- -----------\n";
    const rows = filtered.map((p) => {
      const handles = "    250";
      const npm = "    14";
      const pm = String(p.rss).padStart(8);
      const ws = String(p.vsz).padStart(10);
      const cpu = "      0.02";
      const id = String(p.pid).padStart(6);
      const name = commOf(p);
      return `${handles} ${npm} ${pm} ${ws} ${cpu} ${id} ${name}`;
    });

    return ok(header + rows.join("\n") + "\n");
  },
};

export const gps: Command = {
  ...getProcess,
  name: "gps",
};
