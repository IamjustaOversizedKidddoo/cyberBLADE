import { describe, expect, it } from "vitest";
import { buildReviewQueue, type UserReviewItem } from "@/lib/review/session";
import { initialReviewState } from "@/lib/review/scheduler";

describe("Review Queue Builder", () => {
  const baseTime = new Date("2026-10-12T12:00:00.000Z");

  it("adds up to 5 new cards for brand new learners", () => {
    const queue = buildReviewQueue([], 1, baseTime);

    expect(queue.length).toBe(5);
    expect(queue.every((q) => q.isNew)).toBe(true);
    expect(queue.every((q) => q.card.rank <= 1)).toBe(true);
  });

  it("prioritizes due cards over new cards", () => {
    const dueItem: UserReviewItem = {
      id: "item-1",
      userId: "u1",
      cardId: "fc-r0-perms-01",
      lessonId: "core-r0-linux-permissions",
      state: {
        ...initialReviewState(baseTime),
        dueAt: new Date("2026-10-11T12:00:00.000Z").toISOString(), // Yesterday (due)
      },
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
    };

    const notDueItem: UserReviewItem = {
      id: "item-2",
      userId: "u1",
      cardId: "fc-r0-perms-02",
      lessonId: "core-r0-linux-permissions",
      state: {
        ...initialReviewState(baseTime),
        dueAt: new Date("2026-10-15T12:00:00.000Z").toISOString(), // In 3 days (not due)
      },
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
    };

    const queue = buildReviewQueue([dueItem, notDueItem], 1, baseTime, 10, 5);

    // One due card + up to 5 new cards
    expect(queue.some((q) => q.card.id === "fc-r0-perms-01" && !q.isNew)).toBe(true);
    expect(queue.some((q) => q.card.id === "fc-r0-perms-02")).toBe(false);
  });

  it("interleaves cards by category", () => {
    const queue = buildReviewQueue([], 1, baseTime, 5, 5);

    // Check that categories alternate rather than all linux then all network
    if (queue.length >= 2) {
      expect(queue[0].card.category).not.toBe(queue[1].card.category);
    }
  });

  it("respects rank gate (Rank 0 operator does not receive Rank 1 or 2 cards)", () => {
    const queue = buildReviewQueue([], 0, baseTime, 10, 10);
    expect(queue.every((q) => q.card.rank === 0)).toBe(true);
  });
});
