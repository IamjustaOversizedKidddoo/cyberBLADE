import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, parseFlags, splitLines } from "./util";

const BRE_SPECIAL_WHEN_ESCAPED = new Set(["(", ")", "|", "{", "}", "+", "?"]);

/**
 * GNU basic regular expression → JavaScript. In BRE, ( ) | { } + ? are plain characters
 * and become special only when escaped (\( \| \+ …); bracket expressions are copied as-is.
 */
export function breToJs(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      const next = pattern[++i];
      out += BRE_SPECIAL_WHEN_ESCAPED.has(next) ? next : `\\${next}`;
    } else if (c === "[") {
      let j = i + 1;
      if (pattern[j] === "^") j++;
      if (pattern[j] === "]") j++;
      while (j < pattern.length && pattern[j] !== "]") j++;
      out += pattern.slice(i, j + 1);
      i = j;
    } else if (BRE_SPECIAL_WHEN_ESCAPED.has(c)) {
      out += `\\${c}`;
    } else out += c;
  }
  return out;
}

export const grep: Command = {
  name: "grep",
  summary: "find lines that match a pattern (-i any case, -c count, -n line numbers, -v non-matching, -E extended)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "incvE");
    if (bad) return { stdout: "", stderr: `grep: invalid option -- '${bad}'\n`, code: 2 };
    const [pattern, ...files] = operands;
    if (pattern === undefined) return { stdout: "", stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\n", code: 2 };

    let re: RegExp;
    try {
      re = new RegExp(flags.has("E") ? pattern : breToJs(pattern), flags.has("i") ? "i" : "");
    } catch {
      return { stdout: "", stderr: "grep: Invalid regular expression\n", code: 2 };
    }

    const inputs: { name: string; text: string }[] = [];
    let stderr = "";
    if (files.length === 0) inputs.push({ name: "(standard input)", text: ctx.stdin });
    for (const f of files) {
      try {
        inputs.push({ name: f, text: ctx.vfs.readFile(resolvePath(ctx.cwd, f, ctx.home), ctx.user) });
      } catch (err) {
        stderr += `grep: ${f}: ${errorText(err)}\n`;
      }
    }

    const prefixName = files.length > 1;
    let stdout = "";
    let matched = false;
    for (const { name, text } of inputs) {
      let count = 0;
      splitLines(text).forEach((line, index) => {
        if (re.test(line) === flags.has("v")) return;
        count++;
        matched = true;
        if (!flags.has("c")) {
          stdout += `${prefixName ? `${name}:` : ""}${flags.has("n") ? `${index + 1}:` : ""}${line}\n`;
        }
      });
      if (flags.has("c")) stdout += `${prefixName ? `${name}:` : ""}${count}\n`;
    }
    return { stdout, stderr, code: stderr ? 2 : matched ? 0 : 1 };
  },
};
