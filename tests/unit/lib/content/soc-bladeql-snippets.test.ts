import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DRILL_SYNTHETIC_DATASET } from "@/lib/lab-engine/soc/query/drills";
import { executeBladeQL } from "@/lib/lab-engine/soc/query/engine";

// Every ```bladeql block in a SOC lesson must run on the drill dataset and return rows, so lessons
// never show a query that does not work on the practice page.
function lessonFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? lessonFiles(p) : p.endsWith(".mdx") ? [p] : [];
  });
}

const snippets = lessonFiles("content/tracks").flatMap((file) =>
  [...fs.readFileSync(file, "utf8").matchAll(/```bladeql\r?\n([\s\S]*?)```/g)].map((m) => ({ file: path.basename(file), query: m[1].trim() })),
);

describe("BladeQL snippets in SOC lessons", () => {
  it("exist (the SIEM module teaches with real queries)", () => {
    expect(snippets.length).toBeGreaterThanOrEqual(8);
  });

  for (const s of snippets) {
    it(`${s.file}: ${s.query}`, () => {
      const r = executeBladeQL(s.query, DRILL_SYNTHETIC_DATASET, { scenarioNowEpochMs: Date.parse("2026-10-12T23:59:59Z") });
      expect(r.events.length).toBeGreaterThan(0);
    });
  }
});
