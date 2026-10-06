export const RANKS = [
  { rank: 0, name: "Initiate" },
  { rank: 1, name: "Operator" },
  { rank: 2, name: "Watcher" },
] as const;

export function rankName(rank: number): string {
  return RANKS.find((r) => r.rank === rank)?.name ?? "Initiate";
}
