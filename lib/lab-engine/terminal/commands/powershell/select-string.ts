import { resolvePath } from "../../vfs";
import type { Command } from "../types";
import { errorText, fail, ok } from "../util";

export const selectString: Command = {
  name: "Select-String",
  summary: "finds text in strings and files",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let pattern = "";
    let path = "";
    let caseSensitive = false;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-Pattern" && i + 1 < args.length) {
        pattern = args[++i];
      } else if (a === "-Path" && i + 1 < args.length) {
        path = args[++i];
      } else if (a === "-CaseSensitive") {
        caseSensitive = true;
      } else if (!a.startsWith("-")) {
        if (!pattern) pattern = a;
        else if (!path) path = a;
      }
    }

    if (!pattern) {
      return fail("Select-String : Cannot validate argument on parameter 'Pattern'. The argument is null or empty.\n");
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, caseSensitive ? "" : "i");
    } catch {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "" : "i");
    }

    // If reading from stdin (pipe)
    if (ctx.stdin) {
      const lines = ctx.stdin.split("\n");
      const matched = lines.filter((l) => regex.test(l));
      return ok(matched.length > 0 ? matched.join("\n") + "\n" : "");
    }

    // If reading from file path
    if (path) {
      const targetPath = resolvePath(ctx.cwd, path, ctx.home);
      try {
        const content = ctx.vfs.readFile(targetPath, ctx.user);
        const lines = content.split("\n");
        const matched: string[] = [];
        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            matched.push(`${path}:${idx + 1}:${line}`);
          }
        });
        return ok(matched.length > 0 ? matched.join("\n") + "\n" : "");
      } catch (e) {
        return fail(`Select-String : ${path}: ${errorText(e)}\n`);
      }
    }

    return fail("Select-String : The input object cannot be bound to any parameters.\n");
  },
};

export const sls: Command = {
  ...selectString,
  name: "sls",
};
