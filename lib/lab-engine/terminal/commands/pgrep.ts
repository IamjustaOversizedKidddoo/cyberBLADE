import { commOf } from "../processes";
import type { Command } from "./types";
import { fail, ok } from "./util";

export const pgrep: Command = {
  name: "pgrep",
  summary: "look up processes based on name and other attributes",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let listName = false;
    let listFull = false;
    let matchFull = false;
    let filterUser: string | null = null;
    let pattern: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "-l") {
        listName = true;
      } else if (arg === "-a") {
        listFull = true;
      } else if (arg === "-f") {
        matchFull = true;
      } else if (arg === "-u") {
        i++;
        if (i < args.length) {
          filterUser = args[i];
        }
      } else if (arg.startsWith("-")) {
        // Unknown option or combo like -la?
        if (arg === "-la" || arg === "-al") {
          listName = true;
          listFull = true;
        }
      } else {
        pattern = arg;
      }
    }

    if (!pattern && !filterUser) {
      return {
        stdout: "",
        stderr: "pgrep: no matching criteria specified\nTry `pgrep --help' for more information.\n",
        code: 2,
      };
    }

    let regex: RegExp | null = null;
    if (pattern) {
      try {
        regex = new RegExp(pattern);
      } catch {
        return fail(`pgrep: invalid regular expression: ${pattern}\n`);
      }
    }

    const procs = ctx.procs.list();
    const matched = procs.filter((p) => {
      if (filterUser && p.user !== filterUser) return false;
      if (regex) {
        const target = matchFull ? p.argv.join(" ") : commOf(p);
        if (!regex.test(target)) return false;
      }
      return true;
    });

    if (matched.length === 0) {
      return { stdout: "", stderr: "", code: 1 };
    }

    const lines = matched.map((p) => {
      if (listFull) return `${p.pid} ${p.argv.join(" ")}`;
      if (listName) return `${p.pid} ${commOf(p)}`;
      return `${p.pid}`;
    });

    return ok(lines.join("\n") + "\n");
  },
};
