import type { StreakSummary } from "@/lib/gamification/streaks";
import { IconCheck } from "@/components/ui/icons";

export function StreakWidget({ streak }: { streak: StreakSummary }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="font-ui text-xs tracking-widest text-muted uppercase">
            OPERATIONAL STREAK
          </span>
          <span
            className={`flex items-center gap-1.5 font-ui text-xs tracking-wider ${
              streak.activeToday ? "text-cyan" : "text-muted"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                streak.activeToday ? "bg-cyan animate-pulse shadow-[0_0_8px_rgba(15,190,255,0.8)]" : "bg-muted/40"
              }`}
            />
            {streak.activeToday ? "ACTIVE TODAY" : "STANDBY"}
          </span>
        </div>

        <div className="flex items-baseline gap-3 mb-5">
          <span className="font-display text-5xl font-bold text-ink leading-none">
            {streak.currentStreak}
          </span>
          <span className="font-ui text-sm tracking-widest text-muted">
            {streak.currentStreak === 1 ? "DAY IN A ROW" : "DAYS IN A ROW"}
          </span>
          {streak.longestStreak > streak.currentStreak && (
            <span className="ml-auto font-ui text-xs text-muted/60">
              RECORD: {streak.longestStreak}D
            </span>
          )}
        </div>
      </div>

      {/* 7-day activity nodes */}
      <div className="border-t border-line/60 pt-4">
        <div className="flex justify-between items-center gap-1">
          {streak.activePastWeek.map((day, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <span className="font-ui text-[10px] text-muted">{day.label}</span>
              <div
                title={`${day.date}: ${day.active ? "Active" : "Inactive"}`}
                className={`h-7 w-7 rounded-xs flex items-center justify-center font-ui text-xs transition-colors ${
                  day.active
                    ? "border border-cyan/80 bg-cyan/20 text-cyan shadow-[0_0_8px_rgba(15,190,255,0.3)]"
                    : "border border-line/40 bg-surface-subtle text-muted/30"
                }`}
              >
                {day.active ? <IconCheck className="h-3.5 w-3.5" /> : "·"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
