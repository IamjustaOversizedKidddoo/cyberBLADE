import type { Command } from "./types";
import { fail } from "./util";

const USAGE = "submit: usage: submit <objective-number> <answer>\n";

/**
 * Lab-only command (not part of real Linux): hand an answer to the platform without leaving the
 * terminal. The shell only parses it; the terminal UI sends it to the server, which checks it.
 */
export const submit: Command = {
  name: "submit",
  summary: "lab only: send an answer, e.g. submit 1 CYBERBLADE{...}",
  run(ctx) {
    if (!ctx.alone) return fail("submit: use it on its own line, not in a pipe or redirect\n", 2);
    const [num, ...words] = ctx.argv.slice(1);
    if (!num || !/^[1-9]\d*$/.test(num) || words.length === 0) return fail(USAGE, 2);
    return { stdout: "", stderr: "", code: 0, submit: { objective: Number(num), answer: words.join(" ") } };
  },
};
