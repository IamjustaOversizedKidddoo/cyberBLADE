import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

export const cat: Command = {
  name: "cat",
  summary: "show what is inside a file",
  run(ctx) {
    const files = ctx.argv.slice(1);
    if (files.length === 0) return { stdout: ctx.stdin, stderr: "", code: 0 };
    let stdout = "";
    let stderr = "";
    for (const f of files) {
      try {
        stdout += ctx.vfs.readFile(resolvePath(ctx.cwd, f, ctx.home), ctx.user);
      } catch (err) {
        stderr += `cat: ${f}: ${errorText(err)}\n`;
      }
    }
    return { stdout, stderr, code: stderr ? 1 : 0 };
  },
};
