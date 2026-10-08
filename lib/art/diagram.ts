/** Geometry for NEON's technical diagrams. Coordinates are in a 0–100 viewBox on both axes. */

export type DiagramNode = { id: string; x: number; y: number; label: string; kind?: "host" | "step" | "rank" | "cloud" | "signal" };
export type DiagramLink = { from: string; to: string; shape?: "straight" | "orthogonal" | "curve"; dashed?: boolean };
export type Point = { x: number; y: number };

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

/** The course map's desktop path: alternating sides, moving down. */
export function zigzag(count: number): Point[] {
  const gap = 100 / count;
  return Array.from({ length: count }, (_, i) => ({ x: i % 2 === 0 ? 20 : 80, y: r(gap / 2 + i * gap) }));
}

export type RankState = "cleared" | "current" | "locked";

export function rankStatus(operatorRank: number, rank: number): RankState {
  return rank < operatorRank ? "cleared" : rank === operatorRank ? "current" : "locked";
}
