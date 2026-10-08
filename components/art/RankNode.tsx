import type { RankState } from "@/lib/art/diagram";
import { HalftoneField } from "./HalftoneField";
import { MissionMarker } from "./motion/MissionMarker";
import { SystemLabel } from "./SystemLabel";

type Props = {
  rank: number;
  name: string;
  status: RankState;
  xp: number;
  lessons: { done: number; total: number };
  /** What this rank covers, in plain words. */
  mission: string;
  /** Heading level for "rank_N · Name" (h2 on /learn/core, h3 inside the course map). */
  as?: "h2" | "h3";
  id?: string;
  /** The action for this rank (Begin / Continue link), shown when it is open. */
  children?: React.ReactNode;
  className?: string;
};

const STAMP: Record<RankState, { text: string; className: string }> = {
  cleared: { text: "CLEARED", className: "border-purple text-purple" },
  current: { text: "CURRENT", className: "border-cyan text-cyan" },
  locked: { text: "SECTOR LOCKED", className: "border-muted text-muted" },
};

/** One mission on the campaign path: a giant rank number, its state as a stamp, progress and the way in. */
export function RankNode({ rank, name, status, xp, lessons, mission, as: Heading = "h3", id, children, className = "" }: Props) {
  const stamp = STAMP[status];
  return (
    <article id={id} data-rank-state={status} className={`rank-node relative overflow-hidden border-2 p-5 sm:p-6 ${status === "current" ? "border-cyan" : "border-line"} ${className}`}>
      {status === "locked" && <HalftoneField tone="muted" density={5} angle={30} fade="right" className="opacity-40" />}
      <div className="relative flex items-start gap-4 sm:gap-6">
        <span aria-hidden="true" className={`font-display text-[clamp(4rem,10vw,7rem)] leading-[0.8] ${status === "locked" ? "text-muted" : status === "current" ? "text-cyan" : "text-ink"}`}>
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <MissionMarker active={status === "current"} />
            <span className={`border-2 px-2 py-0.5 font-ui text-sm tracking-widest ${stamp.className}`}>{stamp.text}</span>
          </div>
          <Heading className={`mt-2 font-ui text-2xl ${status === "locked" ? "text-muted" : "text-ink"}`}>
            rank_{rank} · {name}
          </Heading>
          <p className="mt-1 text-muted">{mission}</p>
          <p className="mt-2">
            <SystemLabel tone="muted">
              {lessons.done}/{lessons.total} lessons · {xp} XP
            </SystemLabel>
          </p>
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </article>
  );
}
