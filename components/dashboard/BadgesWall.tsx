import type { EvaluatedBadge } from "@/lib/gamification/badges";

export function BadgesWall({ badges }: { badges: EvaluatedBadge[] }) {
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <section aria-labelledby="badges-heading" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 id="badges-heading" className="font-display text-3xl text-ink">
            operational_badges
          </h2>
          <p className="font-ui text-xs tracking-wider text-muted mt-1">
            CLEARANCE HONORS, TACTICAL ACCOMPLISHMENTS & FIELD DISCIPLINE
          </p>
        </div>
        <span className="font-ui text-xs text-purple border border-purple/40 px-3 py-1">
          {unlockedCount} / {badges.length} UNLOCKED
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`border p-4 transition-all ${
              b.unlocked
                ? "border-cyan/60 bg-console shadow-[0_0_12px_rgba(15,190,255,0.08)]"
                : "border-line/40 bg-void/50 opacity-60"
            }`}
          >
            {/* Top row: code & category */}
            <div className="flex items-center justify-between gap-2 mb-2 font-ui text-[11px]">
              <span
                className={`font-mono px-2 py-0.5 border ${
                  b.unlocked
                    ? "border-cyan text-cyan bg-cyan/10"
                    : "border-line text-muted/60"
                }`}
              >
                {b.code}
              </span>
              <span className="text-muted/70 uppercase tracking-widest text-[10px]">
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
            <p className="font-sans text-xs text-muted mt-1 leading-relaxed">
              {b.description}
            </p>

            {/* Bottom status */}
            <div className="mt-4 pt-2 border-t border-line/40 flex items-center justify-between font-ui text-[11px]">
              {b.unlocked ? (
                <span className="text-cyan font-bold flex items-center gap-1">
                  ✓ CLEARED
                </span>
              ) : (
                <span className="text-muted/50 tracking-wider">
                  [CLASSIFIED]
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
