import { linkPath, rankStatus, stackVertically, zigzag, type DiagramNode } from "@/lib/art/diagram";

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
