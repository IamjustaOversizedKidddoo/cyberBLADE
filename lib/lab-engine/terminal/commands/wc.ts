import { resolvePath } from "../vfs";
import type { Command } from "./types";
import { byteLength, errorText, fail, parseFlags } from "./util";

type Counts = { l: number; w: number; c: number };

const count = (text: string): Counts => ({
  l: (text.match(/\n/g) ?? []).length,
  w: text.split(/\s+/).filter(Boolean).length,
  c: byteLength(text),
});

export const wc: Command = {
  name: "wc",
  summary: "count lines, words and bytes (-l lines only)",
  run(ctx) {
    const { flags, operands, bad } = parseFlags(ctx.argv.slice(1), "lwc");
    if (bad) return fail(`wc: invalid option -- '${bad}'\n`);
    const fields = (["l", "w", "c"] as const).filter((f) => flags.size === 0 || flags.has(f));

    const rows: { name?: string; counts: Counts }[] = [];
    let stderr = "";
    if (operands.length === 0) rows.push({ counts: count(ctx.stdin) });
    for (const f of operands) {
      try {
        rows.push({ name: f, counts: count(ctx.vfs.readFile(resolvePath(ctx.cwd, f, ctx.home), ctx.user)) });
      } catch (err) {
        stderr += `wc: ${f}: ${errorText(err)}\n`;
      }
    }
    if (operands.length > 1) {
      const total = rows.reduce((t, r) => ({ l: t.l + r.counts.l, w: t.w + r.counts.w, c: t.c + r.counts.c }), { l: 0, w: 0, c: 0 });
      rows.push({ name: "total", counts: total });
    }

    // GNU: stdin with several columns uses width 7; otherwise the widest number sets the width.
    const stdinOnly = operands.length === 0;
    const width =
      stdinOnly && fields.length > 1
        ? 7
        : stdinOnly
          ? 1
          : Math.max(1, ...rows.flatMap((r) => fields.map((f) => String(r.counts[f]).length)));
    const stdout = rows
      .map((r) => fields.map((f) => String(r.counts[f]).padStart(width)).join(" ") + (r.name ? ` ${r.name}` : "") + "\n")
      .join("");
    return { stdout, stderr, code: stderr ? 1 : 0 };
  },
};
