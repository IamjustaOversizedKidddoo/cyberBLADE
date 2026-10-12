import type { MasteryOverview } from "@/lib/progress/mastery";
import Link from "next/link";

type Props = {
  mastery: MasteryOverview;
};

export function MasteryMapWidget({ mastery }: Props) {
  const { solidCount, developingCount, needsReviewCount, totalCount } = mastery;
  const solidPct = totalCount > 0 ? Math.round((solidCount / totalCount) * 100) : 0;
  const developingPct = totalCount > 0 ? Math.round((developingCount / totalCount) * 100) : 0;
  const needsReviewPct = totalCount > 0 ? Math.round((needsReviewCount / totalCount) * 100) : 0;

  return (
    <section
      aria-labelledby="mastery-heading"
      className="rounded-sm border border-line bg-surface p-5 space-y-4 shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <h2 id="mastery-heading" className="font-ui text-xs font-bold tracking-widest text-ink uppercase">
            OPERATIONAL MASTERY MAP
          </h2>
        </div>
        <span className="font-mono text-xs text-muted">
          {totalCount} TOTAL TARGETS
        </span>
      </div>

      {/* Tri-color Stacked Progress Bar */}
      <div
        role="progressbar"
        aria-label="Curriculum mastery progress"
        aria-valuenow={solidPct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full rounded-full bg-surface-raised overflow-hidden flex"
      >
        <div
          style={{ width: `${solidPct}%` }}
          className="bg-emerald-400 transition-all duration-500"
          title={`Solid: ${solidCount} (${solidPct}%)`}
        />
        <div
          style={{ width: `${developingPct}%` }}
          className="bg-cyan transition-all duration-500"
          title={`Developing: ${developingCount} (${developingPct}%)`}
        />
        <div
          style={{ width: `${needsReviewPct}%` }}
          className="bg-amber-400 transition-all duration-500"
          title={`Needs Review: ${needsReviewCount} (${needsReviewPct}%)`}
        />
      </div>

      {/* Legend & Count Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="rounded-xs border border-emerald-400/30 bg-emerald-400/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-ui text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              SOLID
            </span>
            <span className="font-mono text-xs font-bold text-ink">{solidCount}</span>
          </div>
          <span className="text-[10px] text-muted block mt-0.5">Verified retention</span>
        </div>

        <div className="rounded-xs border border-cyan/30 bg-cyan/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-ui text-[11px] font-bold text-cyan uppercase tracking-wider">
              DEVELOPING
            </span>
            <span className="font-mono text-xs font-bold text-ink">{developingCount}</span>
          </div>
          <span className="text-[10px] text-muted block mt-0.5">In progress / new</span>
        </div>

        <div className="rounded-xs border border-amber-400/30 bg-amber-400/10 p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-ui text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              NEEDS REVIEW
            </span>
            <span className="font-mono text-xs font-bold text-ink">{needsReviewCount}</span>
          </div>
          <span className="text-[10px] text-muted block mt-0.5">Lapses or due targets</span>
        </div>
      </div>

      {needsReviewCount > 0 && (
        <div className="pt-2">
          <Link
            href="/review"
            className="inline-flex items-center gap-1.5 font-ui text-xs text-amber-400 hover:text-amber-300 font-semibold tracking-wider uppercase transition-colors"
          >
            <span>Launch spaced retrieval drill to reinforce weak concepts →</span>
          </Link>
        </div>
      )}
    </section>
  );
}
