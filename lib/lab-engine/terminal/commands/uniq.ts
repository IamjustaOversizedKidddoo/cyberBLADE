import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, parseFlags, splitLines } from "./util";

export const uniq: Command = {
  name: "uniq",
  summary: "report or omit repeated lines (-c count, -i ignore-case, -d duplicates)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "cidu");
    if (bad) return { stdout: "", stderr: `uniq: invalid option -- '${bad}'\n`, code: 1 };

    let text = "";
    if (operands.length === 0) {
      text = ctx.stdin;
    } else {
      const fullPath = resolvePath(ctx.cwd, operands[0], ctx.home);
      try {
        text = ctx.vfs.readFile(fullPath, ctx.user);
      } catch (err) {
        return { stdout: "", stderr: `uniq: ${operands[0]}: ${errorText(err)}\n`, code: 1 };
      }
    }

    const lines = splitLines(text);
    if (lines.length === 0) return { stdout: "", stderr: "", code: 0 };

    const ignoreCase = flags.has("i");
    const count = flags.has("c");
    const dupesOnly = flags.has("d");
    const uniqueOnly = flags.has("u");

    // Group adjacent matching lines
    const groups: { line: string; count: number }[] = [];
    for (const line of lines) {
      const last = groups[groups.length - 1];
      const matches = last && (ignoreCase ? last.line.toLowerCase() === line.toLowerCase() : last.line === line);
      if (matches) {
        last.count++;
      } else {
        groups.push({ line, count: 1 });
      }
    }

    const output: string[] = [];
    for (const g of groups) {
      if (dupesOnly && g.count === 1) continue;
      if (uniqueOnly && g.count > 1) continue;

      if (count) {
        output.push(`${String(g.count).padStart(7)} ${g.line}`);
      } else {
        output.push(g.line);
      }
    }

    return { stdout: output.length > 0 ? output.join("\n") + "\n" : "", stderr: "", code: 0 };
  },
};
