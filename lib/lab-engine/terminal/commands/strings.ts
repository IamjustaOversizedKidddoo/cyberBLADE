import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

export const strings: Command = {
  name: "strings",
  summary: "print the sequences of printable characters in files (-n min-len)",
  run(ctx) {
    const rawArgs = ctx.argv.slice(1);
    let minLen = 4;
    const files: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === "-n" && rawArgs[i + 1]) {
        minLen = parseInt(rawArgs[++i], 10) || 4;
      } else if (arg.startsWith("-n")) {
        minLen = parseInt(arg.slice(2), 10) || 4;
      } else if (arg.startsWith("-")) {
        // ignore other flags
      } else {
        files.push(arg);
      }
    }

    let text = "";
    if (files.length === 0) {
      text = ctx.stdin;
    } else {
      for (const f of files) {
        const fullPath = resolvePath(ctx.cwd, f, ctx.home);
        try {
          text += ctx.vfs.readFile(fullPath, ctx.user) + "\n";
        } catch (err) {
          return { stdout: "", stderr: `strings: '${f}': ${errorText(err)}\n`, code: 1 };
        }
      }
    }

    const re = new RegExp(`[\\x20-\\x7E]{${minLen},}`, "g");
    const matches = text.match(re) ?? [];

    return { stdout: matches.length > 0 ? matches.join("\n") + "\n" : "", stderr: "", code: 0 };
  },
};
