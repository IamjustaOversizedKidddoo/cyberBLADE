import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, fail } from "./util";

export const touch: Command = {
  name: "touch",
  summary: "create an empty file",
  run(ctx) {
    const files = ctx.argv.slice(1);
    if (files.length === 0) return fail("touch: missing file operand\n");
    let stderr = "";
    for (const f of files) {
      try {
        ctx.vfs.touch(resolvePath(ctx.cwd, f, ctx.home), ctx.user);
      } catch (err) {
        stderr += `touch: cannot touch '${f}': ${errorText(err)}\n`;
      }
    }
    return { stdout: "", stderr, code: stderr ? 1 : 0 };
  },
};
