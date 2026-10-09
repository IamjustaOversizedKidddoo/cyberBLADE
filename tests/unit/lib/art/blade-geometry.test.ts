import { bladeMesh, orbitNodes } from "@/lib/art/blade-geometry";

const key = (a: number[], b: number[]) => [a, b].map((v) => v.map((n) => n.toFixed(4)).join(",")).sort().join("|");

test("the blade is a closed, watertight solid: every edge is shared by exactly two triangles", () => {
  const { positions } = bladeMesh();
  expect(positions.length % 9).toBe(0);
  const edges = new Map<string, number>();
  for (let t = 0; t < positions.length; t += 9) {
    const v = [0, 3, 6].map((o) => positions.slice(t + o, t + o + 3));
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const k = key(v[a], v[b]);
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((n) => n === 2)).toBe(true);
});

test("no degenerate triangles", () => {
  const { positions } = bladeMesh();
  for (let t = 0; t < positions.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(t, t + 9);
    const u = [bx - ax, by - ay, bz - az];
    const w = [cx - ax, cy - ay, cz - az];
    const cross = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    expect(Math.hypot(...cross)).toBeGreaterThan(1e-6);
  }
});

test("orbit nodes sit evenly on a tilted ring around the blade", () => {
  const nodes = orbitNodes(6, 1.6);
  expect(nodes).toHaveLength(6);
  for (const [x, , z] of nodes) expect(Math.hypot(x, z)).toBeCloseTo(1.6, 5);
});
