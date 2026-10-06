import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, fail, parseFlags } from "./util";

export const mkdir: Command = {
  name: "mkdir",
  summary: "make a folder (-p also makes missing parent folders)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "p");
    if (bad) return fail(`mkdir: invalid option -- '${bad}'\n`);
    if (operands.length === 0) return fail("mkdir: missing operand\n");
    let stderr = "";
    for (const d of operands) {
      try {
        ctx.vfs.mkdir(resolvePath(ctx.cwd, d, ctx.home), ctx.user, flags.has("p"));
      } catch (err) {
        stderr += `mkdir: cannot create directory '${d}': ${errorText(err)}\n`;
      }
    }
    return { stdout: "", stderr, code: stderr ? 1 : 0 };
  },
};
