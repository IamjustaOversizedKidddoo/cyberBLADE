import type { Command } from "./types";
import { ok } from "./util";

export const echo: Command = {
  name: "echo",
  summary: "print text (echo -n skips the newline)",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const noNewline = args[0] === "-n";
    const text = (noNewline ? args.slice(1) : args).join(" ");
    return ok(noNewline ? text : `${text}\n`);
  },
};
