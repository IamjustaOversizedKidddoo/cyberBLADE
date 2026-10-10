export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  activePastWeek: { date: string; active: boolean; label: string }[];
};

const DAY_MS = 86_400_000;

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calculateStreak(timestamps: string[], now: Date = new Date()): StreakSummary {
  if (timestamps.length === 0) {
    const pastWeek = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * DAY_MS);
      return {
        date: toDateString(d),
        active: false,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      };
    });

    return {
      currentStreak: 0,
      longestStreak: 0,
      activeToday: false,
      activePastWeek: pastWeek,
    };
  }

  // Deduplicate and sort active days ascending
  const uniqueDates = Array.from(
    new Set(
      timestamps
        .map((t) => {
          try {
            return toDateString(new Date(t));
          } catch {
            return null;
          }
        })
        .filter((s): s is string => s !== null),
    ),
  ).sort();

  const activeSet = new Set(uniqueDates);
  const todayStr = toDateString(now);
  const yesterdayStr = toDateString(new Date(now.getTime() - DAY_MS));

  const activeToday = activeSet.has(todayStr);
  const activeYesterday = activeSet.has(yesterdayStr);

  // Calculate current streak
  let currentStreak = 0;
  if (activeToday || activeYesterday) {
    let checkDate = activeToday ? now : new Date(now.getTime() - DAY_MS);
    while (activeSet.has(toDateString(checkDate))) {
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - DAY_MS);
    }
  }

  // Calculate longest streak across entire history
  let longestStreak = 0;
  let tempStreak = 0;
  let prevTime = 0;

  for (const dateStr of uniqueDates) {
    const time = new Date(dateStr).getTime();
    if (prevTime === 0 || time - prevTime === DAY_MS) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevTime = time;
  }

  // Past 7 days breakdown
  const activePastWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * DAY_MS);
    const dStr = toDateString(d);
    return {
      date: dStr,
      active: activeSet.has(dStr),
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
    };
  });

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    activeToday,
    activePastWeek,
  };
}
