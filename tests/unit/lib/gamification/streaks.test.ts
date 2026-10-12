import { describe, expect, it } from "vitest";
import { calculateStreak } from "@/lib/gamification/streaks";

describe("Streak Calculator", () => {
  const fixedNow = new Date("2026-10-10T14:00:00Z");

  it("handles empty activity history", () => {
    const res = calculateStreak([], fixedNow);
    expect(res.currentStreak).toBe(0);
    expect(res.longestStreak).toBe(0);
    expect(res.activeToday).toBe(false);
    expect(res.activePastWeek).toHaveLength(7);
    expect(res.activePastWeek.every((d) => !d.active)).toBe(true);
  });

  it("calculates active streak when user logged activity today", () => {
    const timestamps = [
      "2026-10-08T10:00:00Z",
      "2026-10-09T11:00:00Z",
      "2026-10-10T09:00:00Z", // today
    ];

    const res = calculateStreak(timestamps, fixedNow);
    expect(res.currentStreak).toBe(3);
    expect(res.longestStreak).toBe(3);
    expect(res.activeToday).toBe(true);
    // Last item in past week should be active (today)
    expect(res.activePastWeek[6].active).toBe(true);
    // Day before (yesterday) should be active
    expect(res.activePastWeek[5].active).toBe(true);
    // 2 days before should be active
    expect(res.activePastWeek[4].active).toBe(true);
    // Earlier days should be inactive
    expect(res.activePastWeek[3].active).toBe(false);
  });

  it("preserves streak if user was active yesterday but not yet today", () => {
    const timestamps = [
      "2026-10-08T10:00:00Z",
      "2026-10-09T11:00:00Z", // yesterday
    ];

    const res = calculateStreak(timestamps, fixedNow);
    expect(res.currentStreak).toBe(2);
    expect(res.activeToday).toBe(false);
    expect(res.activePastWeek[6].active).toBe(false);
    expect(res.activePastWeek[5].active).toBe(true);
  });

  it("resets streak to 0 if user missed yesterday and today", () => {
    const timestamps = [
      "2026-10-06T10:00:00Z",
      "2026-10-07T11:00:00Z",
    ];

    const res = calculateStreak(timestamps, fixedNow);
    expect(res.currentStreak).toBe(0);
    expect(res.longestStreak).toBe(2);
    expect(res.activeToday).toBe(false);
  });

  it("tracks longest streak across historical discontinuous sessions", () => {
    const timestamps = [
      // 5-day streak in September
      "2026-09-01T10:00:00Z",
      "2026-09-02T10:00:00Z",
      "2026-09-03T10:00:00Z",
      "2026-09-04T10:00:00Z",
      "2026-09-05T10:00:00Z",
      // gap
      // 2-day streak in October
      "2026-10-09T10:00:00Z",
      "2026-10-10T10:00:00Z",
    ];

    const res = calculateStreak(timestamps, fixedNow);
    expect(res.currentStreak).toBe(2);
    expect(res.longestStreak).toBe(5);
  });

  it("applies weekly grace freeze when missed 1 day and active two days ago", () => {
    const timestamps = [
      "2026-10-07T10:00:00Z",
      "2026-10-08T10:00:00Z",
      // 2026-10-09 missed!
      "2026-10-10T10:00:00Z", // today
    ];

    const res = calculateStreak(timestamps, fixedNow, { allowGraceFreeze: true });
    expect(res.graceFreezeUsed).toBe(true);
    // 2 days before + 1 frozen day + 1 today = 4 days streak
    expect(res.currentStreak).toBe(4);
    expect(res.activePastWeek[5].frozen).toBe(true);
  });

  it("respects timezone offset when calculating calendar boundaries", () => {
    // 2026-10-10 at 01:00 UTC with timezone offset +330 (IST: UTC+5:30) is 2026-10-10 06:30 IST
    const nowUtc = new Date("2026-10-10T01:00:00Z");
    const ts = ["2026-10-10T00:30:00Z"];

    const res = calculateStreak(ts, nowUtc, { timezoneOffsetMinutes: -330 });
    expect(res.activeToday).toBe(true);
  });
});
