import { describe, expect, it } from "vitest";
import {
  calculateNextReview,
  initialReviewState,
  isDue,
  reviewWithRating,
  INITIAL_EASE_FACTOR,
  MIN_EASE_FACTOR,
} from "@/lib/review/scheduler";

describe("SM-2 Spaced Repetition Scheduler", () => {
  const baseTime = new Date("2026-10-12T12:00:00.000Z");

  it("initializes review item with standard default values", () => {
    const state = initialReviewState(baseTime);
    expect(state.easeFactor).toBe(INITIAL_EASE_FACTOR);
    expect(state.intervalDays).toBe(0);
    expect(state.repetitions).toBe(0);
    expect(state.lapses).toBe(0);
    expect(state.dueAt).toBe(baseTime.toISOString());
    expect(state.lastReviewedAt).toBeNull();
  });

  it("handles first successful review (interval = 1 day)", () => {
    const init = initialReviewState(baseTime);
    const next = calculateNextReview(init, 4, baseTime);

    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(0);
    expect(next.lastReviewedAt).toBe(baseTime.toISOString());
    expect(next.dueAt).toBe(new Date("2026-10-13T12:00:00.000Z").toISOString());
  });

  it("handles second successful review (interval = 6 days)", () => {
    const init = initialReviewState(baseTime);
    const first = calculateNextReview(init, 4, baseTime);
    const day2 = new Date("2026-10-13T12:00:00.000Z");
    const second = calculateNextReview(first, 4, day2);

    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(6);
    expect(second.lapses).toBe(0);
    expect(second.dueAt).toBe(new Date("2026-10-19T12:00:00.000Z").toISOString());
  });

  it("handles third successful review multiplying interval by ease factor", () => {
    const init = initialReviewState(baseTime);
    const step1 = calculateNextReview(init, 5, baseTime);
    const step2 = calculateNextReview(step1, 5, baseTime);
    const step3 = calculateNextReview(step2, 5, baseTime);

    expect(step3.repetitions).toBe(3);
    // interval = round(6 * EF)
    expect(step3.intervalDays).toBeGreaterThan(6);
    expect(step3.easeFactor).toBeGreaterThan(INITIAL_EASE_FACTOR);
  });

  it("resets repetitions and increments lapses on failure (grade < 3)", () => {
    const state = {
      easeFactor: 2.5,
      intervalDays: 15,
      repetitions: 3,
      lapses: 0,
      dueAt: baseTime.toISOString(),
      lastReviewedAt: baseTime.toISOString(),
    };

    const lapsed = calculateNextReview(state, 1, baseTime);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.easeFactor).toBeLessThan(2.5);
  });

  it("clamps ease factor to minimum 1.3 on repeated failures", () => {
    let state = initialReviewState(baseTime);
    for (let i = 0; i < 15; i++) {
      state = calculateNextReview(state, 0, baseTime);
    }

    expect(state.easeFactor).toBe(MIN_EASE_FACTOR);
    expect(state.repetitions).toBe(0);
    expect(state.lapses).toBe(15);
  });

  it("correctly maps human ratings (again, hard, good, easy)", () => {
    const init = initialReviewState(baseTime);

    const again = reviewWithRating(init, "again", baseTime);
    expect(again.repetitions).toBe(0);
    expect(again.intervalDays).toBe(1);
    expect(again.lapses).toBe(1);

    const hard = reviewWithRating(init, "hard", baseTime);
    expect(hard.repetitions).toBe(1);
    expect(hard.intervalDays).toBe(1);
    expect(hard.easeFactor).toBeLessThan(INITIAL_EASE_FACTOR);

    const good = reviewWithRating(init, "good", baseTime);
    expect(good.repetitions).toBe(1);
    expect(good.intervalDays).toBe(1);
    expect(good.easeFactor).toBe(INITIAL_EASE_FACTOR);

    const easy = reviewWithRating(init, "easy", baseTime);
    expect(easy.repetitions).toBe(1);
    expect(easy.intervalDays).toBe(1);
    expect(easy.easeFactor).toBeGreaterThan(INITIAL_EASE_FACTOR);
  });

  it("evaluates isDue correctly based on comparison timestamp", () => {
    const item = { dueAt: "2026-10-12T12:00:00.000Z" };

    expect(isDue(item, new Date("2026-10-12T11:59:59.000Z"))).toBe(false);
    expect(isDue(item, new Date("2026-10-12T12:00:00.000Z"))).toBe(true);
    expect(isDue(item, new Date("2026-10-12T12:00:01.000Z"))).toBe(true);
    expect(isDue(item, new Date("2026-10-13T12:00:00.000Z"))).toBe(true);
  });
});
