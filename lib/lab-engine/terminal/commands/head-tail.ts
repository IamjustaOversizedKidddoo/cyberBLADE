import { resolvePath } from "../vfs";
import type { Command, CmdContext, CmdResult } from "./types";
import { errorText, fail, joinLines, splitLines } from "./util";

function parseCount(name: string, args: string[]): { count: number; files: string[] } | CmdResult {
  let count = 10;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let value: string | undefined;
    if (a === "-n") value = args[++i];
    else if (a.startsWith("-n")) value = a.slice(2);
    else if (/^-\d+$/.test(a)) value = a.slice(1);
    else {
      files.push(a);
      continue;
    }
    if (value === undefined || !/^\d+$/.test(value)) return fail(`${name}: invalid number of lines: '${value ?? ""}'\n`);
    count = Number(value);
  }
  return { count, files };
}

function makeHeadTail(name: "head" | "tail", summary: string, pick: (lines: string[], n: number) => string[]): Command {
  return {
    name,
    summary,
    run(ctx: CmdContext) {
      const parsed = parseCount(name, ctx.argv.slice(1));
      if ("code" in parsed) return parsed;
      const { count, files } = parsed;
      if (files.length === 0) return { stdout: joinLines(pick(splitLines(ctx.stdin), count)), stderr: "", code: 0 };
      const blocks: string[] = [];
      let stderr = "";
      for (const f of files) {
        try {
          const text = ctx.vfs.readFile(resolvePath(ctx.cwd, f, ctx.home), ctx.user);
          const body = joinLines(pick(splitLines(text), count));
          blocks.push(files.length > 1 ? `==> ${f} <==\n${body}` : body);
        } catch (err) {
          stderr += `${name}: cannot open '${f}' for reading: ${errorText(err)}\n`;
        }
      }
      return { stdout: blocks.join("\n"), stderr, code: stderr ? 1 : 0 };
    },
  };
}

export const head = makeHeadTail("head", "show the first lines of a file (-n 5 for five)", (lines, n) => lines.slice(0, n));
export const tail = makeHeadTail("tail", "show the last lines of a file (-n 5 for five)", (lines, n) =>
  n === 0 ? [] : lines.slice(-n),
);
