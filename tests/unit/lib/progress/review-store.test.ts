import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/storage/memory-store";
import { StoreProgressRepo } from "@/lib/progress/repo";
import { emptyProgress } from "@/lib/progress/types";

describe("StoreProgressRepo Review and Telemetry Persistence", () => {
  it("saves, lists, and updates review items", async () => {
    const store = createMemoryStore(emptyProgress);
    const repo = new StoreProgressRepo(store);

    const saved = await repo.saveReviewItem({
      userId: "user-1",
      cardId: "fc-r0-perms-01",
      lessonId: "core-r0-linux-permissions",
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      lapses: 0,
      dueAt: "2026-10-13T12:00:00.000Z",
      lastReviewedAt: "2026-10-12T12:00:00.000Z",
      createdAt: "2026-10-12T12:00:00.000Z",
      updatedAt: "2026-10-12T12:00:00.000Z",
    });

    expect(saved.id).toBeDefined();

    const items = await repo.listReviewItems("user-1");
    expect(items.length).toBe(1);
    expect(items[0].cardId).toBe("fc-r0-perms-01");

    // Update existing item
    await repo.saveReviewItem({
      ...items[0],
      intervalDays: 6,
      repetitions: 2,
    });

    const updated = await repo.listReviewItems("user-1");
    expect(updated.length).toBe(1);
    expect(updated[0].repetitions).toBe(2);
    expect(updated[0].intervalDays).toBe(6);
  });

  it("logs review events and learning events", async () => {
    const store = createMemoryStore(emptyProgress);
    const repo = new StoreProgressRepo(store);

    const revEvent = await repo.logReviewEvent({
      userId: "user-1",
      cardId: "fc-r0-perms-01",
      grade: 4,
      reviewedAt: "2026-10-12T12:00:00.000Z",
    });
    expect(revEvent.id).toBeDefined();

    const learnEvent = await repo.logLearningEvent({
      userId: "user-1",
      eventType: "lesson_opened",
      metadata: { lessonId: "core-r0-linux-permissions" },
      createdAt: "2026-10-12T12:00:00.000Z",
    });
    expect(learnEvent.id).toBeDefined();
  });

  it("saves and lists exam self-reports", async () => {
    const store = createMemoryStore(emptyProgress);
    const repo = new StoreProgressRepo(store);

    await repo.saveExamReport({
      userId: "user-1",
      examType: "CompTIA Security+",
      score: 790,
      maxScore: 900,
      passed: true,
      notes: "First attempt pass!",
      reportedAt: "2026-10-12T12:00:00.000Z",
    });

    const reports = await repo.listExamReports("user-1");
    expect(reports.length).toBe(1);
    expect(reports[0].examType).toBe("CompTIA Security+");
    expect(reports[0].passed).toBe(true);
  });
});
