import type { Command } from "./types";
import { fail, ok } from "./util";

const TRY = "Try 'tr --help' for more information.\n";
const ESCAPES: Record<string, string> = { n: "\n", t: "\t", "0": "\0", "\\": "\\" };

/** Expands a tr set: escapes (\n \t \0 \\) and ranges (a-z). */
function expand(set: string): string[] {
  const chars: string[] = [];
  for (let i = 0; i < set.length; i++) {
    if (set[i] === "\\" && i + 1 < set.length) chars.push(ESCAPES[set[++i]] ?? set[i]);
    else chars.push(set[i]);
  }
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === "-" && i + 2 < chars.length) {
      for (let c = chars[i].charCodeAt(0); c <= chars[i + 2].charCodeAt(0); c++) out.push(String.fromCharCode(c));
      i += 2;
    } else out.push(chars[i]);
  }
  return out;
}

/** coreutils tr: translate SET1 to SET2, or delete SET1 with -d. Reads stdin only. */
export const tr: Command = {
  name: "tr",
  summary: "translate or delete characters: tr a-z A-Z, tr -d '\\n', tr '\\0' ' '",
  run(ctx) {
    const args = ctx.argv.slice(1);
    const del = args[0] === "-d";
    const [set1, set2] = del ? args.slice(1) : args;
    if (set1 === undefined) return fail(`tr: missing operand\n${TRY}`);
    if (del) {
      const drop = new Set(expand(set1));
      return ok([...ctx.stdin].filter((c) => !drop.has(c)).join(""));
    }
    if (set2 === undefined) return fail(`tr: missing operand after '${set1}'\nTwo strings must be given when translating.\n${TRY}`);
    const from = expand(set1);
    const to = expand(set2);
    const map = new Map(from.map((c, i) => [c, to[Math.min(i, to.length - 1)]]));
    return ok([...ctx.stdin].map((c) => map.get(c) ?? c).join(""));
  },
};
