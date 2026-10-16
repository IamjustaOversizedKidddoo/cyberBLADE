/**
 * Exports learner feedback grouped by content item (lesson question, exam item, scenario, general),
 * newest first within each group. Learner ids are replaced by a short per-export pseudonym.
 *   npm run beta:feedback -- [--hosted] [--format md|json] [--out file]
 */
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { FileBetaStore, type BetaStore } from "../lib/beta/store.js";
import { groupFeedback } from "../lib/beta/feedback-export.js";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function store(): Promise<BetaStore> {
  if (!process.argv.includes("--hosted")) return new FileBetaStore();
  const { SupabaseBetaStore } = await import("../lib/beta/supabase-store.js");
  return new SupabaseBetaStore();
}

async function main() {
  const rows = await (await store()).listFeedback();
  const grouped = groupFeedback(rows, randomBytes(16).toString("hex"));
  const format = arg("format") ?? "md";
  const text =
    format === "json"
      ? JSON.stringify(grouped, null, 2)
      : grouped
          .map((g) => `## ${g.item} (${g.count})\n` + g.entries.map((e) => `- ${e.createdAt} · ${e.learner} · ${e.route} · ref ${e.requestId}\n  ${e.message.replace(/\n/g, "\n  ")}`).join("\n"))
          .join("\n\n");
  const out = arg("out");
  if (out) {
    await fs.writeFile(out, text);
    console.log(`Wrote ${rows.length} feedback item(s) in ${grouped.length} group(s) to ${out}.`);
  } else console.log(text || "No feedback yet.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
