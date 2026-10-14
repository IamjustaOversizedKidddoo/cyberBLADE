import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { loadLessons } from "@/lib/content/lessons";
import { remarkGlossary } from "@/lib/content/remark-glossary";
import {
  buildGlossary,
  checkpointIds,
  groupModules,
  loadPracticePaths,
  pathMinutes,
  practiceMinutes,
  splitCheckpointId,
  tooltipTerms,
} from "@/lib/content/soc-curriculum";
import { loadTrackConfig } from "@/lib/content/soc-track";

async function compiled(md: string) {
  const out = await compile(md, {
    remarkPlugins: [[remarkGlossary, { terms: [{ term: "Passive DNS", definition: "History of DNS answers.", href: "/learn/soc-l1/glossary#term-passive-dns" }, { term: "SNI", definition: "Server name.", href: "/g#sni" }] }]],
  });
  return String(out);
}

describe("remarkGlossary", () => {
  it("wraps only the first use of a term in prose", async () => {
    const js = await compiled("Use passive DNS first. Then passive DNS again.");
    expect(js.match(/GlossaryTerm/g)?.length).toBeGreaterThanOrEqual(1);
    expect(js).toContain('term: "Passive DNS"');
    expect(js.split('term: "Passive DNS"').length - 1).toBe(1);
  });

  it("never touches headings, code, inline code or links", async () => {
    const js = await compiled("## Passive DNS\n\n`SNI` and [passive DNS](/x)\n\n```text\npassive DNS\n```\n");
    expect(js).not.toContain("GlossaryTerm");
  });

  it("matches whole words only", async () => {
    expect(await compiled("SNIPPET is not a term.")).not.toContain("GlossaryTerm");
  });
});

describe("SOC curriculum structure", () => {
  it("groups all 42 lessons into 12 modules in order", async () => {
    const lessons = (await loadLessons("content")).filter((l) => l.track === "soc");
    const modules = groupModules(loadTrackConfig(), lessons);
    expect(modules).toHaveLength(12);
    expect(modules.reduce((n, m) => n + m.lessons.length, 0)).toBe(42);
    for (const m of modules) expect(m.lessons.length, m.key).toBeGreaterThanOrEqual(2);
  });

  it("builds a glossary with one entry per term and unique anchors", async () => {
    const g = buildGlossary(await loadLessons("content"));
    expect(g.length).toBeGreaterThan(100);
    expect(new Set(g.map((e) => e.anchor)).size).toBe(g.length);
    expect(tooltipTerms(g).some((e) => e.term === "Alert")).toBe(false);
  });

  it("computes practice path times from lessons and practice metadata", async () => {
    const lessons = await loadLessons("content");
    const paths = loadPracticePaths().paths;
    expect(paths.map((p) => p.id)).toEqual(["phishing", "brute-force", "endpoint-triage", "first-shift"]);
    const shift = practiceMinutes("shift:shift-alert-storm");
    expect(shift).toEqual({ min: 50, max: 85, estimated: false });
    expect(practiceMinutes("drill:drill-01").estimated).toBe(true);
    for (const p of paths) {
      const t = pathMinutes(p.steps, lessons);
      expect(t.min).toBeGreaterThan(0);
      expect(t.max).toBeGreaterThanOrEqual(t.min);
    }
  });

  it("builds checkpoint ids from the last two questions of each lesson and parses them back", () => {
    const ids = checkpointIds(["soc-l1-a-01"], new Map([["soc-l1-a-01", ["q1", "q2", "q3", "q4", "q5"]]]));
    expect(ids).toEqual(["soc-l1-a-01~q4", "soc-l1-a-01~q5"]);
    expect(splitCheckpointId(ids[0])).toEqual({ lessonId: "soc-l1-a-01", questionId: "q4" });
    expect(splitCheckpointId("../x~q1")).toBeNull();
  });
});
