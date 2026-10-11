import { rankName } from "@/lib/progress/ranks";

export function RankBadge({ rank }: { rank: number }) {
  const rankColors = [
    "border-slate-500/50 bg-slate-500/10 text-slate-300 shadow-[0_0_10px_rgba(148,163,184,0.1)]", // Rank 0 Initiate
    "border-cyan/50 bg-cyan/10 text-cyan shadow-[0_0_10px_rgba(15,190,255,0.2)]", // Rank 1 Operator
    "border-purple/50 bg-purple/10 text-purple shadow-[0_0_10px_rgba(200,60,255,0.2)]", // Rank 2 Watcher
    "border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]", // Rank 3 Hunter
  ];

  const colorClass = rankColors[rank] ?? rankColors[0];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 font-ui text-xs font-semibold tracking-wider uppercase select-none ${colorClass}`}
    >
      <span aria-hidden="true" className="font-mono text-[10px] opacity-75">
        R{rank}
      </span>
      <span>
        Rank {rank} · {rankName(rank)}
      </span>
    </span>
  );
}
