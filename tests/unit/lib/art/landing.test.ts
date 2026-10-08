import { LOOP_DIAGRAM, LOOP_STEPS, TRACK_GLYPHS } from "@/lib/art/landing";
import { TRACKS } from "@/lib/catalog/tracks";

test("the learning loop runs Briefing → Terminal Check → Lab → Debrief and wires back to Briefing", () => {
  expect(LOOP_DIAGRAM.nodes.map((n) => n.label)).toEqual(["Briefing", "Terminal Check", "Lab", "Debrief"]);
  expect(LOOP_STEPS.map((s) => s.label)).toEqual(["Briefing", "Terminal Check", "Lab", "Debrief"]);
  expect(LOOP_DIAGRAM.links).toContainEqual(expect.objectContaining({ from: "debrief", to: "briefing" }));
});

test("every open track has its own glyph, and every glyph link joins real nodes", () => {
  for (const t of TRACKS.filter((t) => t.status === "open")) {
    const glyph = TRACK_GLYPHS[t.id as keyof typeof TRACK_GLYPHS];
    expect(glyph, t.id).toBeDefined();
    const ids = new Set(glyph.nodes.map((n) => n.id));
    for (const l of glyph.links) expect(ids.has(l.from) && ids.has(l.to)).toBe(true);
  }
});

test("glyphs differ by track: no two share the same shape", () => {
  const shapes = Object.values(TRACK_GLYPHS).map((g) => JSON.stringify(g.nodes.map((n) => [n.x, n.y])));
  expect(new Set(shapes).size).toBe(shapes.length);
});
