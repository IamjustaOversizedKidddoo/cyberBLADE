import fs from "node:fs";
import { describe, expect, it } from "vitest";

// Audits docs/ops/soc-curriculum-claims.md: every row has an allowed confidence value, every lesson it
// names exists, and every "verified in repo" row cites files that exist.
const doc = fs.readFileSync("docs/ops/soc-curriculum-claims.md", "utf8");
const rows = doc
  .split("\n")
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split(" | ").map((c) => c.replace(/^\| |\|$/g, "").trim()));

const lessonIds = new Set<string>();
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".mdx")) lessonIds.add(/^id: (.+)$/m.exec(fs.readFileSync(p, "utf8"))![1].trim());
  }
};
walk("content/tracks");

describe("SOC curriculum claims log", () => {
  it("has numbered rows in order", () => {
    expect(rows.length).toBeGreaterThan(50);
    rows.forEach((r, i) => expect(Number(r[0]), r.join(" | ")).toBe(i + 1));
  });

  it("uses only allowed confidence values", () => {
    for (const r of rows) expect(r[3], `row ${r[0]}`).toMatch(/^(certain|fairly sure|unsure)( \(.+\))?$/);
  });

  it("names only lessons that exist", () => {
    for (const r of rows) for (const id of r[2].match(/soc-l1-[a-z0-9-]+-\d{2}/g) ?? []) expect(lessonIds.has(id), `row ${r[0]}: ${id}`).toBe(true);
  });

  it("cites existing files for every claim verified in the repo", () => {
    for (const r of rows.filter((x) => x[3].includes("verified in repo"))) {
      const paths = (r[4].match(/`([a-z][\w./-]+\.(?:ts|yaml|mts))`/g) ?? []).map((p) => p.slice(1, -1));
      expect(paths.length, `row ${r[0]} cites no file`).toBeGreaterThan(0);
      for (const p of paths) {
        const candidates = [p, `content/soc/families/${p}`, `content/soc/shifts/${p}`, `content/soc/report-templates/${p}`, `lib/lab-engine/soc/enrichment/${p}`];
        expect(candidates.some((c) => fs.existsSync(c)), `row ${r[0]}: ${p}`).toBe(true);
      }
    }
  });
});
