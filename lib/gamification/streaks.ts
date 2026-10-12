export type StreakSummary = {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  activePastWeek: { date: string; active: boolean; label: string; frozen?: boolean }[];
  graceFreezeUsed?: boolean;
};

export type StreakOptions = {
  timezoneOffsetMinutes?: number;
  allowGraceFreeze?: boolean;
};

/**
 * Normalizes a Date or UTC timestamp string into an ISO YYYY-MM-DD date key,
 * respecting optional timezone offset.
 */
function toCalendarDateString(d: Date, timezoneOffsetMinutes = 0): string {
  const adjusted = new Date(d.getTime() - timezoneOffsetMinutes * 60_000);
  const year = adjusted.getUTCFullYear();
  const month = String(adjusted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(adjusted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Subtracts n calendar days safely avoiding DST hour shifts.
 */
function subtractCalendarDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

export function calculateStreak(
  timestamps: string[],
  now: Date = new Date(),
  options: StreakOptions = {},
): StreakSummary {
  const { timezoneOffsetMinutes = 0, allowGraceFreeze = false } = options;

  if (timestamps.length === 0) {
    const pastWeek = Array.from({ length: 7 }, (_, i) => {
      const d = subtractCalendarDays(now, 6 - i);
      return {
        date: toCalendarDateString(d, timezoneOffsetMinutes),
        active: false,
        label: d.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
      };
    });

    return {
      currentStreak: 0,
      longestStreak: 0,
      activeToday: false,
      activePastWeek: pastWeek,
      graceFreezeUsed: false,
    };
  }

  // Deduplicate and sort active days ascending
  const uniqueDates = Array.from(
    new Set(
      timestamps
        .map((t) => {
          try {
            return toCalendarDateString(new Date(t), timezoneOffsetMinutes);
          } catch {
            return null;
          }
        })
        .filter((s): s is string => s !== null),
    ),
  ).sort();

  const activeSet = new Set(uniqueDates);
  const todayStr = toCalendarDateString(now, timezoneOffsetMinutes);
  const yesterdayStr = toCalendarDateString(subtractCalendarDays(now, 1), timezoneOffsetMinutes);
  const twoDaysAgoStr = toCalendarDateString(subtractCalendarDays(now, 2), timezoneOffsetMinutes);

  const activeToday = activeSet.has(todayStr);
  const activeYesterday = activeSet.has(yesterdayStr);
  const activeTwoDaysAgo = activeSet.has(twoDaysAgoStr);

  // Check if grace freeze should bridge yesterday's gap
  let graceFreezeUsed = false;
  let frozenYesterday = false;

  if (allowGraceFreeze && !activeToday && !activeYesterday && activeTwoDaysAgo) {
    // Yesterday was missed, but learner was active 2 days ago: apply 1 grace freeze
    graceFreezeUsed = true;
    frozenYesterday = true;
  } else if (allowGraceFreeze && activeToday && !activeYesterday && activeTwoDaysAgo) {
    // Active today, missed yesterday, active 2 days ago: freeze bridges the gap
    graceFreezeUsed = true;
    frozenYesterday = true;
  }

  const isDayActive = (dStr: string) => activeSet.has(dStr) || (frozenYesterday && dStr === yesterdayStr);

  // Calculate current streak
  let currentStreak = 0;
  if (activeToday || activeYesterday || frozenYesterday) {
    let checkDate = activeToday ? now : subtractCalendarDays(now, 1);
    while (isDayActive(toCalendarDateString(checkDate, timezoneOffsetMinutes))) {
      currentStreak++;
      checkDate = subtractCalendarDays(checkDate, 1);
    }
  }

  // Calculate longest streak across history
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of uniqueDates) {
    const curDate = new Date(`${dateStr}T00:00:00Z`);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const dayDiff = Math.round((curDate.getTime() - prevDate.getTime()) / 86_400_000);
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = curDate;
  }

  // Past 7 days breakdown
  const activePastWeek = Array.from({ length: 7 }, (_, i) => {
    const d = subtractCalendarDays(now, 6 - i);
    const dStr = toCalendarDateString(d, timezoneOffsetMinutes);
    const isActive = activeSet.has(dStr);
    const isFrozen = frozenYesterday && dStr === yesterdayStr;

    return {
      date: dStr,
      active: isActive || isFrozen,
      frozen: isFrozen,
      label: d.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
    };
  });

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    activeToday,
    activePastWeek,
    graceFreezeUsed,
  };
}
