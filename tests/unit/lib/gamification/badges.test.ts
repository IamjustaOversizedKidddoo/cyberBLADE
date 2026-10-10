import { describe, expect, it } from "vitest";
import { evaluateBadges } from "@/lib/gamification/badges";
import type { LabAttempt } from "@/lib/progress/types";

describe("Badges Evaluator", () => {
  it("unlocks initiate badge by default at Rank 0", () => {
    const badges = evaluateBadges({
      operatorRank: 0,
      completedLessons: [],
      attempts: [],
      currentStreak: 0,
      longestStreak: 0,
    });

    const initiate = badges.find((b) => b.id === "initiate")!;
    expect(initiate.unlocked).toBe(true);

    const operator = badges.find((b) => b.id === "operator")!;
    expect(operator.unlocked).toBe(false);
  });

  it("unlocks operator and watcher badges based on rank", () => {
    const badges = evaluateBadges({
      operatorRank: 2,
      completedLessons: [],
      attempts: [],
      currentStreak: 0,
      longestStreak: 0,
    });

    expect(badges.find((b) => b.id === "initiate")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "operator")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "watcher")?.unlocked).toBe(true);
  });

  it("unlocks tactical badges based on completed lab types", () => {
    const mockAttempts: LabAttempt[] = [
      {
        id: "a1",
        userId: "u1",
        labId: "core-r1-pkt-http-lab-01",
        seed: "s",
        mode: "practice",
        objectivesSolved: ["o1"],
        hintsUsed: 0,
        startedAt: "2026-10-10T10:00:00Z",
        expiresAt: null,
        completedAt: "2026-10-10T10:15:00Z",
        failedAt: null,
      },
      {
        id: "a2",
        userId: "u1",
        labId: "core-r1-linux-perms-lab-01",
        seed: "s",
        mode: "practice",
        objectivesSolved: ["o1"],
        hintsUsed: 1,
        startedAt: "2026-10-10T10:00:00Z",
        expiresAt: null,
        completedAt: "2026-10-10T10:15:00Z",
        failedAt: null,
      },
    ];

    const badges = evaluateBadges({
      operatorRank: 1,
      completedLessons: [],
      attempts: mockAttempts,
      currentStreak: 0,
      longestStreak: 0,
    });

    expect(badges.find((b) => b.id === "first_blood")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "packet_surgeon")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "root_hunter")?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === "clean_run")?.unlocked).toBe(true); // a1 had 0 hints
    expect(badges.find((b) => b.id === "powershell_warden")?.unlocked).toBe(false);
  });

  it("unlocks streak badges based on consistency", () => {
    const badges3 = evaluateBadges({
      operatorRank: 1,
      completedLessons: [],
      attempts: [],
      currentStreak: 3,
      longestStreak: 3,
    });
    expect(badges3.find((b) => b.id === "streak_3")?.unlocked).toBe(true);
    expect(badges3.find((b) => b.id === "streak_7")?.unlocked).toBe(false);

    const badges7 = evaluateBadges({
      operatorRank: 1,
      completedLessons: [],
      attempts: [],
      currentStreak: 1,
      longestStreak: 7,
    });
    expect(badges7.find((b) => b.id === "streak_7")?.unlocked).toBe(true);
  });
});
