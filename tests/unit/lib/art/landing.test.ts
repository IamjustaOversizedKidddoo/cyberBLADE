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

import { ANALYZE_DIAGRAM, DEFEND_DIAGRAM, SCENES, SIGNAL_DIAGRAM, SYSTEM_STAGES, TRACE_DIAGRAM } from "@/lib/art/landing";

describe("the cinematic sequence", () => {
  test("seven scenes, in story order", () => {
    expect(SCENES.map((s) => s.name)).toEqual(["BOOT", "OPERATOR", "SIGNAL", "TRACE", "ANALYZE", "DEFEND", "ENTER THE SYSTEM"]);
  });

  test("it resolves into the training system: LEARN → PRACTICE → TRACE → ANALYZE → DEFEND → MASTER", () => {
    expect(SYSTEM_STAGES.map((s) => s.label)).toEqual(["LEARN", "PRACTICE", "TRACE", "ANALYZE", "DEFEND", "MASTER"]);
  });

  test("morphs are continuous: each diagram starts exactly where the previous one ended", () => {
    const at = (d: typeof SIGNAL_DIAGRAM) => Object.fromEntries(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const from = (d: typeof SIGNAL_DIAGRAM) => Object.fromEntries(d.nodes.map((n) => [n.id, n.morph?.[0]]));
    expect(from(ANALYZE_DIAGRAM)).toEqual(at(SIGNAL_DIAGRAM));
    expect(from(DEFEND_DIAGRAM)).toEqual(at(TRACE_DIAGRAM));
    for (const d of [SIGNAL_DIAGRAM, ANALYZE_DIAGRAM, DEFEND_DIAGRAM]) for (const n of d.nodes) expect(n.morph).toHaveLength(1);
  });

  test("every link joins two real nodes", () => {
    for (const d of [SIGNAL_DIAGRAM, ANALYZE_DIAGRAM, TRACE_DIAGRAM, DEFEND_DIAGRAM]) {
      const ids = new Set(d.nodes.map((n) => n.id));
      for (const l of d.links) expect(ids.has(l.from) && ids.has(l.to), `${d.title}: ${l.from}-${l.to}`).toBe(true);
    }
  });
});
