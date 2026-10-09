/**
 * Geometry for CYBERBLADE's 3D blade (BladeObject): a faceted blade with a diamond cross-section
 * tapering to a tip, plus guard, grip and pommel blocks. Pure numbers (flat triangle list), so it is
 * testable without WebGL and three.js only wraps it in a BufferGeometry.
 */

type V = [number, number, number];

function pushTri(out: number[], a: V, b: V, c: V) {
  out.push(...a, ...b, ...c);
}
function pushQuad(out: number[], a: V, b: V, c: V, d: V) {
  pushTri(out, a, b, c);
  pushTri(out, a, c, d);
}

/** A closed box (12 triangles). */
function box(out: number[], [cx, cy, cz]: V, [sx, sy, sz]: V) {
  const x = [cx - sx / 2, cx + sx / 2];
  const y = [cy - sy / 2, cy + sy / 2];
  const z = [cz - sz / 2, cz + sz / 2];
  const p = (i: number, j: number, k: number): V => [x[i], y[j], z[k]];
  pushQuad(out, p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0)); // back
  pushQuad(out, p(0, 0, 1), p(0, 1, 1), p(1, 1, 1), p(1, 0, 1)); // front
  pushQuad(out, p(0, 0, 0), p(0, 1, 0), p(0, 1, 1), p(0, 0, 1)); // left
  pushQuad(out, p(1, 0, 0), p(1, 0, 1), p(1, 1, 1), p(1, 1, 0)); // right
  pushQuad(out, p(0, 1, 0), p(1, 1, 0), p(1, 1, 1), p(0, 1, 1)); // top
  pushQuad(out, p(0, 0, 0), p(0, 0, 1), p(1, 0, 1), p(1, 0, 0)); // bottom
}

const LENGTH = 2.4;
const STATIONS = [0, 0.35, 0.7, 0.9]; // fractions of the blade length, base → near the tip

export function bladeMesh(): { positions: number[] } {
  const out: number[] = [];
  const offset = -0.7; // centre the whole object vertically
  const ring = (t: number): V[] => {
    const y = t * LENGTH + offset;
    const w = 0.32 * (1 - Math.pow(t, 1.6)); // half-width, narrowing toward the tip
    const k = 0.07 * (1 - t) + 0.01; // half-thickness at the spine
    return [
      [-w, y, 0],
      [0, y, k],
      [w, y, 0],
      [0, y, -k],
    ];
  };
  const rings = STATIONS.map(ring);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < 4; s++) {
      const n = (s + 1) % 4;
      pushQuad(out, rings[i][s], rings[i][n], rings[i + 1][n], rings[i + 1][s]);
    }
  }
  const tip: V = [0, LENGTH + offset, 0];
  const last = rings[rings.length - 1];
  for (let s = 0; s < 4; s++) pushTri(out, last[s], last[(s + 1) % 4], tip);
  const [l, f, r, b] = rings[0];
  pushTri(out, l, r, f); // base cap (two triangles across the diamond)
  pushTri(out, l, b, r);

  box(out, [0, offset - 0.09, 0], [1.1, 0.12, 0.24]); // guard
  box(out, [0, offset - 0.58, 0], [0.15, 0.8, 0.15]); // grip
  box(out, [0, offset - 1.06, 0], [0.26, 0.14, 0.26]); // pommel
  return { positions: out };
}

/** n points on a tilted ring of radius r around the blade (the orbiting attack/defend nodes). */
export function orbitNodes(n: number, r: number): V[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [r * Math.cos(a), 0.35 * Math.sin(a), r * Math.sin(a)];
  });
}
