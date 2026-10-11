import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, parseFlags, splitLines } from "./util";

export const sort: Command = {
  name: "sort",
  summary: "sort lines of text files (-r reverse, -n numeric, -u unique)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "rnu");
    if (bad) return { stdout: "", stderr: `sort: invalid option -- '${bad}'\n`, code: 2 };

    const reverse = flags.has("r");
    const numeric = flags.has("n");
    const unique = flags.has("u");

    const fileTexts: string[] = [];
    if (operands.length === 0) {
      if (ctx.stdin) fileTexts.push(ctx.stdin);
    } else {
      for (const op of operands) {
        const fullPath = resolvePath(ctx.cwd, op, ctx.home);
        try {
          fileTexts.push(ctx.vfs.readFile(fullPath, ctx.user));
        } catch (err) {
          return { stdout: "", stderr: `sort: ${op}: ${errorText(err)}\n`, code: 2 };
        }
      }
    }

    let lines = fileTexts.flatMap((t) => splitLines(t));
    lines.sort((a, b) => {
      if (numeric) {
        const na = parseFloat(a) || 0;
        const nb = parseFloat(b) || 0;
        return na === nb ? a.localeCompare(b) : na - nb;
      }
      return a.localeCompare(b);
    });

    if (reverse) {
      lines.reverse();
    }

    if (unique) {
      lines = Array.from(new Set(lines));
    }

    return { stdout: lines.length > 0 ? lines.join("\n") + "\n" : "", stderr: "", code: 0 };
  },
};
