import { describe, expect, it } from "vitest";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";

describe("ProgressRepo listXpEvents and listAttempts extensions", () => {
  it("lists all XP events for the specified user", async () => {
    const repo = new MemoryProgressRepo();
    await repo.awardXp("user-1", "lesson:01", 100);
    await repo.awardXp("user-1", "lab:01", 150);
    await repo.awardXp("user-2", "lesson:01", 100);

    const events1 = await repo.listXpEvents("user-1");
    expect(events1).toHaveLength(2);
    expect(events1.map((e) => e.source)).toEqual(["lesson:01", "lab:01"]);

    const events2 = await repo.listXpEvents("user-2");
    expect(events2).toHaveLength(1);
    expect(events2[0].userId).toBe("user-2");
  });

  it("lists all attempts for the specified user", async () => {
    const repo = new MemoryProgressRepo();
    await repo.createAttempt({
      userId: "user-1",
      labId: "lab-a",
      seed: "s1",
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: "2026-10-10T00:00:00Z",
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    });
    await repo.createAttempt({
      userId: "user-1",
      labId: "lab-b",
      seed: "s2",
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 1,
      startedAt: "2026-10-10T01:00:00Z",
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    });
    await repo.createAttempt({
      userId: "user-2",
      labId: "lab-a",
      seed: "s3",
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: "2026-10-10T02:00:00Z",
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    });

    const attempts1 = await repo.listAttempts("user-1");
    expect(attempts1).toHaveLength(2);
    expect(attempts1.map((a) => a.labId)).toEqual(["lab-a", "lab-b"]);

    const attempts2 = await repo.listAttempts("user-2");
    expect(attempts2).toHaveLength(1);
    expect(attempts2[0].labId).toBe("lab-a");
  });
});
