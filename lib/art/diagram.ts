/** Geometry for CYBERBLADE's technical diagrams. Coordinates are in a 0–100 viewBox on both axes. */

export type Point = { x: number; y: number };
/** A node; `morph` lists where it was in earlier scenes (oldest first) — a scene interpolates from those to x/y. */
export type DiagramNode = { id: string; x: number; y: number; label: string; kind?: "host" | "step" | "rank" | "cloud" | "signal"; morph?: Point[] };
export type DiagramLink = { from: string; to: string; shape?: "straight" | "orthogonal" | "curve"; dashed?: boolean };

const r = (n: number) => Math.round(n * 100) / 100;

/** SVG path data between two nodes. Orthogonal links bend once at the midpoint's x. */
export function linkPath(a: Point, b: Point, shape: DiagramLink["shape"] = "straight"): string {
  const midX = r((a.x + b.x) / 2);
  if (shape === "orthogonal") return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
  if (shape === "curve") return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/** The phone layout of any diagram: same order, one column, evenly spaced. */
export function stackVertically(nodes: DiagramNode[]): DiagramNode[] {
  const gap = 100 / nodes.length;
  return nodes.map((n, i) => ({ ...n, x: 50, y: r(gap / 2 + i * gap) }));
}

// Phone layouts: each keeps its diagram's character on a tall screen. They drop `morph`, since phones
// play a scene once instead of morphing between desktop positions.
const place = (n: DiagramNode, p: Point): DiagramNode => ({ id: n.id, label: n.label, kind: n.kind, x: r(p.x), y: r(p.y) });

/** A network: nodes evenly on a circle, the first at the top, clockwise. */
export function ring(nodes: DiagramNode[]): DiagramNode[] {
  return nodes.map((n, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return place(n, { x: 50 + 38 * Math.cos(a), y: 50 + 38 * Math.sin(a) });
  });
}

/** A wide drawing turned a quarter (x and y swap), so a grid or tree fills a portrait screen. */
export function turnUpright(nodes: DiagramNode[]): DiagramNode[] {
  return nodes.map((n) => place(n, { x: n.y, y: n.x }));
}

/** A route: the nodes in order, alternating sides as they move down. */
export function zigzagNodes(nodes: DiagramNode[]): DiagramNode[] {
  const pts = zigzag(nodes.length);
  return nodes.map((n, i) => place(n, pts[i]));
}

/** The course map's desktop path: alternating sides, moving down. */
export function zigzag(count: number): Point[] {
  const gap = 100 / count;
  return Array.from({ length: count }, (_, i) => ({ x: i % 2 === 0 ? 20 : 80, y: r(gap / 2 + i * gap) }));
}

export type RankState = "cleared" | "current" | "locked";

export function rankStatus(operatorRank: number, rank: number): RankState {
  return rank < operatorRank ? "cleared" : rank === operatorRank ? "current" : "locked";
}
