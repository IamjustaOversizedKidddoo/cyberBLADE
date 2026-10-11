import { resolvePath, type Vfs } from "../vfs";
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

function collectFiles(vfs: Vfs, dirPath: string, user: string, results: string[] = []): string[] {
  try {
    const entries = vfs.list(dirPath, user);
    for (const [name, node] of entries) {
      const full = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
      if (node.kind === "dir") {
        collectFiles(vfs, full, user, results);
      } else {
        results.push(full);
      }
    }
  } catch {
    // skip unreadable
  }
  return results;
}

export const grep: Command = {
  name: "grep",
  summary: "find lines that match a pattern (-i any case, -c count, -n line numbers, -v invert, -r/-R recursive, -l list files, -w word, -E extended)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "incvErRlwq");
    if (bad) return { stdout: "", stderr: `grep: invalid option -- '${bad}'\n`, code: 2 };
    const [pattern, ...files] = operands;
    if (pattern === undefined) return { stdout: "", stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\n", code: 2 };

    const isExtended = flags.has("E");
    const isWord = flags.has("w");
    let regexPattern = isExtended ? pattern : breToJs(pattern);
    if (isWord) regexPattern = `\\b(?:${regexPattern})\\b`;

    let re: RegExp;
    try {
      re = new RegExp(regexPattern, flags.has("i") ? "i" : "");
    } catch {
      return { stdout: "", stderr: "grep: Invalid regular expression\n", code: 2 };
    }

    const isRecursive = flags.has("r") || flags.has("R");
    const inputs: { name: string; text: string }[] = [];
    let stderr = "";

    if (files.length === 0 && !isRecursive) {
      inputs.push({ name: "(standard input)", text: ctx.stdin });
    } else {
      const targets = files.length === 0 ? ["."] : files;
      for (const f of targets) {
        const fullPath = resolvePath(ctx.cwd, f, ctx.home);
        try {
          const node = ctx.vfs.stat(fullPath);
          if (node && node.kind === "dir") {
            if (isRecursive) {
              const walked = collectFiles(ctx.vfs, fullPath, ctx.user);
              for (const filePath of walked) {
                try {
                  const content = ctx.vfs.readFile(filePath, ctx.user);
                  const displayPath = f === "." ? (filePath.startsWith(fullPath) ? filePath.slice(fullPath.length + (fullPath === "/" ? 0 : 1)) : filePath) : filePath;
                  inputs.push({ name: displayPath || filePath, text: content });
                } catch (err) {
                  stderr += `grep: ${filePath}: ${errorText(err)}\n`;
                }
              }
            } else {
              stderr += `grep: ${f}: Is a directory\n`;
            }
          } else {
            inputs.push({ name: f, text: ctx.vfs.readFile(fullPath, ctx.user) });
          }
        } catch (err) {
          stderr += `grep: ${f}: ${errorText(err)}\n`;
        }
      }
    }

    const prefixName = (files.length > 1 || isRecursive) && !flags.has("l");
    const filesWithMatches: string[] = [];
    let stdout = "";
    let matched = false;

    for (const { name, text } of inputs) {
      let count = 0;
      let fileMatched = false;
      for (const [index, line] of splitLines(text).entries()) {
        if (re.test(line) === flags.has("v")) continue;
        count++;
        matched = true;
        fileMatched = true;
        if (!flags.has("c") && !flags.has("l") && !flags.has("q")) {
          stdout += `${prefixName ? `${name}:` : ""}${flags.has("n") ? `${index + 1}:` : ""}${line}\n`;
        }
      }

      if (fileMatched && flags.has("l")) {
        filesWithMatches.push(name);
      }
      if (flags.has("c") && !flags.has("l") && !flags.has("q")) {
        stdout += `${prefixName ? `${name}:` : ""}${count}\n`;
      }
    }

    if (flags.has("l") && !flags.has("q")) {
      stdout = filesWithMatches.map((f) => `${f}\n`).join("");
    }

    if (flags.has("q")) {
      return { stdout: "", stderr: "", code: matched ? 0 : 1 };
    }

    return { stdout, stderr, code: stderr ? 2 : matched ? 0 : 1 };
  },
};
