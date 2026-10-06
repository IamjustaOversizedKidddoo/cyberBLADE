import { rankName } from "@/lib/progress/ranks";

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="badge border border-purple px-2 py-0.5 font-ui text-sm text-purple">
      Rank {rank} · {rankName(rank)}
    </span>
  );
}
