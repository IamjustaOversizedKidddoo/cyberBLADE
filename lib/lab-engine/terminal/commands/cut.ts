import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { errorText, splitLines } from "./util";

function parseFieldRange(fieldSpec: string): Set<number> {
  const fields = new Set<number>();
  const parts = fieldSpec.split(",");
  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = startStr ? parseInt(startStr, 10) : 1;
      const end = endStr ? parseInt(endStr, 10) : 100;
      for (let i = start; i <= end; i++) {
        fields.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) fields.add(num);
    }
  }
  return fields;
}

export const cut: Command = {
  name: "cut",
  summary: "remove sections from each line of files (-d delimiter, -f fields)",
  run(ctx) {
    const rawArgs = ctx.argv.slice(1);
    let delim = "\t";
    let fieldSpec: string | null = null;
    const fileOperands: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === "-d") {
        delim = rawArgs[++i] ?? "\t";
      } else if (arg.startsWith("-d")) {
        delim = arg.slice(2);
      } else if (arg === "-f") {
        fieldSpec = rawArgs[++i] ?? null;
      } else if (arg.startsWith("-f")) {
        fieldSpec = arg.slice(2);
      } else if (arg.startsWith("-")) {
        return { stdout: "", stderr: `cut: invalid option -- '${arg}'\n`, code: 1 };
      } else {
        fileOperands.push(arg);
      }
    }

    if (!fieldSpec) {
      return { stdout: "", stderr: "cut: you must specify a list of bytes, characters, or fields\n", code: 1 };
    }

    const fieldIndices = parseFieldRange(fieldSpec);

    const fileTexts: string[] = [];
    if (fileOperands.length === 0) {
      if (ctx.stdin) fileTexts.push(ctx.stdin);
    } else {
      for (const op of fileOperands) {
        const fullPath = resolvePath(ctx.cwd, op, ctx.home);
        try {
          fileTexts.push(ctx.vfs.readFile(fullPath, ctx.user));
        } catch (err) {
          return { stdout: "", stderr: `cut: ${op}: ${errorText(err)}\n`, code: 1 };
        }
      }
    }

    const lines = fileTexts.flatMap((t) => splitLines(t));
    const output: string[] = [];
    for (const line of lines) {
      if (!line.includes(delim)) {
        output.push(line);
        continue;
      }
      const parts = line.split(delim);
      const selected = parts.filter((_, idx) => fieldIndices.has(idx + 1));
      output.push(selected.join(delim));
    }

    return { stdout: output.length > 0 ? output.join("\n") + "\n" : "", stderr: "", code: 0 };
  },
};
