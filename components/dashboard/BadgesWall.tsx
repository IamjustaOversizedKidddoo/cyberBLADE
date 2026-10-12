import type { EvaluatedBadge } from "@/lib/gamification/badges";
import { IconCheck, IconLock } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";

export function BadgesWall({ badges }: { badges: EvaluatedBadge[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <section aria-labelledby="badges-heading" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 id="badges-heading" className="font-display text-xl sm:text-3xl text-ink break-words">
            operational_badges
          </h2>
          <p className="font-ui text-xs tracking-wider text-muted mt-1">
            CLEARANCE HONORS, TACTICAL ACCOMPLISHMENTS & FIELD DISCIPLINE
          </p>
        </div>
        <span className="font-ui text-xs text-purple border border-purple/40 bg-purple/10 px-3 py-1 rounded-xs">
          {unlockedCount} / {badges.length} UNLOCKED
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`rounded-sm border p-4.5 transition-all flex flex-col justify-between ${
              b.unlocked
                ? "border-cyan/50 bg-surface shadow-[0_0_15px_rgba(15,190,255,0.08)]"
                : "border-line/40 bg-surface-subtle/50 opacity-75 hover:opacity-100"
            }`}
          >
            <div>
              {/* Top row: code & category */}
              <div className="flex items-center justify-between gap-2 mb-2 font-ui text-[11px]">
                <span
                  className={`font-mono px-2 py-0.5 rounded-xs border ${
                    b.unlocked
                      ? "border-cyan/60 text-cyan bg-cyan/15 font-semibold"
                      : "border-line/60 text-muted/60 bg-surface-raised"
                  }`}
                >
                  {b.code}
                </span>
                <span className="text-muted/70 uppercase tracking-widest text-[10px] font-ui">
                  {b.category}
                </span>
              </div>

              {/* Badge Title */}
              <h3
                className={`font-ui text-sm font-bold mt-2 ${
                  b.unlocked ? "text-ink" : "text-muted"
                }`}
              >
                {b.title}
              </h3>

              {/* Description */}
              <p className="font-sans text-xs text-muted mt-1.5 leading-relaxed">
                {b.description}
              </p>
            </div>

            {/* Bottom status with unlock tooltip */}
            <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between font-ui text-xs">
              {b.unlocked ? (
                <span className="text-success font-semibold flex items-center gap-1.5">
                  <IconCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>✓ CLEARED</span>
                </span>
              ) : (
                <Tooltip content={b.description ? `Requirement: ${b.description}` : "Locked milestone"}>
                  <span className="text-muted/60 flex items-center gap-1.5 cursor-help hover:text-muted">
                    <IconLock className="h-3.5 w-3.5" />
                    <span>LOCKED</span>
                  </span>
                </Tooltip>
              )}
              <span className="font-mono text-[10px] text-muted/40">
                {b.unlocked ? "HONOR VERIFIED" : "IN PROGRESS"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
