import { linkPath, rankStatus, ring, stackVertically, turnUpright, zigzag, zigzagNodes, type DiagramNode } from "@/lib/art/diagram";

const a: DiagramNode = { id: "a", x: 10, y: 20, label: "A" };
const b: DiagramNode = { id: "b", x: 70, y: 60, label: "B" };

test("link paths: straight, orthogonal (one elbow at mid-x), curve", () => {
  expect(linkPath(a, b, "straight")).toBe("M 10 20 L 70 60");
  expect(linkPath(a, b, "orthogonal")).toBe("M 10 20 L 40 20 L 40 60 L 70 60");
  expect(linkPath(a, b, "curve")).toBe("M 10 20 C 40 20, 40 60, 70 60");
});

test("stackVertically keeps order, centres x and spaces y evenly inside 0–100", () => {
  const out = stackVertically([b, a, { id: "c", x: 0, y: 0, label: "C" }]);
  expect(out.map((n) => n.id)).toEqual(["b", "a", "c"]);
  expect(out.every((n) => n.x === 50)).toBe(true);
  const ys = out.map((n) => n.y);
  expect(ys[0]).toBeGreaterThan(0);
  expect(ys[2]).toBeLessThan(100);
  expect(ys[1] - ys[0]).toBeCloseTo(ys[2] - ys[1]);
});

test("zigzag alternates sides and moves down", () => {
  const pts = zigzag(3);
  expect(pts.map((p) => p.x)).toEqual([20, 80, 20]);
  expect(pts[0].y).toBeLessThan(pts[1].y);
  expect(pts[1].y).toBeLessThan(pts[2].y);
});

test("rank status from the operator's rank", () => {
  expect(rankStatus(1, 0)).toBe("cleared");
  expect(rankStatus(1, 1)).toBe("current");
  expect(rankStatus(1, 2)).toBe("locked");
});

describe("phone layouts keep each diagram's own shape", () => {
  const six = Array.from({ length: 6 }, (_, i): DiagramNode => ({ id: `n${i}`, x: (i % 3) * 35 + 15, y: i < 3 ? 30 : 74, label: `N${i}` }));
  const inside = (n: DiagramNode) => n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100;

  test("ring: nodes sit evenly on a circle, first at the top, in order", () => {
    const out = ring(six);
    expect(out.map((n) => n.id)).toEqual(six.map((n) => n.id));
    expect(out[0]).toMatchObject({ x: 50, y: 12 });
    const radius = (n: DiagramNode) => Math.hypot(n.x - 50, n.y - 50);
    for (const n of out) expect(radius(n)).toBeCloseTo(38, 1);
    expect(out.every(inside)).toBe(true);
  });

  test("turnUpright: a wide drawing turns a quarter so it fills a tall screen, labels untouched", () => {
    const out = turnUpright(six);
    expect(out[0]).toMatchObject({ id: "n0", x: 30, y: 15, label: "N0" });
    expect(out[5]).toMatchObject({ x: 74, y: 85 });
  });

  test("zigzagNodes: alternating sides, moving down, in order", () => {
    const out = zigzagNodes(six);
    expect(out.map((n) => n.x)).toEqual([20, 80, 20, 80, 20, 80]);
    expect(out.map((n) => n.y)).toEqual([...out.map((n) => n.y)].sort((p, q) => p - q));
  });

  test("phone layouts drop desktop morph history (phones play, they don't morph)", () => {
    const withMorph = six.map((n) => ({ ...n, morph: [{ x: 1, y: 1 }] }));
    for (const layout of [ring, turnUpright, zigzagNodes]) expect(layout(withMorph).every((n) => n.morph === undefined)).toBe(true);
  });
});
