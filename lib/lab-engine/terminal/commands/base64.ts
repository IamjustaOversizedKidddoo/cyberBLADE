import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText } from "./util";

export const base64: Command = {
  name: "base64",
  summary: "base64 encode/decode data and print to standard output (-d decode)",
  run(ctx) {
    const rawArgs = ctx.argv.slice(1);
    let decode = false;
    let fileOp: string | null = null;

    for (const arg of rawArgs) {
      if (arg === "-d" || arg === "-D" || arg === "--decode") {
        decode = true;
      } else if (arg.startsWith("-")) {
        return { stdout: "", stderr: `base64: unrecognized option '${arg}'\n`, code: 1 };
      } else if (!fileOp) {
        fileOp = arg;
      }
    }

    let text = "";
    if (fileOp) {
      const fullPath = resolvePath(ctx.cwd, fileOp, ctx.home);
      try {
        text = ctx.vfs.readFile(fullPath, ctx.user);
      } catch (err) {
        return { stdout: "", stderr: `base64: ${fileOp}: ${errorText(err)}\n`, code: 1 };
      }
    } else {
      text = ctx.stdin;
    }

    if (decode) {
      try {
        const clean = text.replace(/\s+/g, "");
        const decoded = Buffer.from(clean, "base64").toString("utf-8");
        return { stdout: decoded, stderr: "", code: 0 };
      } catch {
        return { stdout: "", stderr: "base64: invalid input\n", code: 1 };
      }
    } else {
      const encoded = Buffer.from(text, "utf-8").toString("base64");
      return { stdout: encoded + "\n", stderr: "", code: 0 };
    }
  },
};
