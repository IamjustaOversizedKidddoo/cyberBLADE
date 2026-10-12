/**
 * Spaced Repetition Scheduling Engine (Deterministic SM-2 Algorithm)
 *
 * Implements SuperMemo 2 (SM-2) for retrieval practice:
 * - Ease Factor (EF): Reflects question difficulty for the individual (default 2.5, min 1.3)
 * - Repetitions: Number of consecutive successful recalls (grade >= 3)
 * - Interval: Number of days until next scheduled retrieval
 * - Lapses: Cumulative count of forgotten items (grade < 3)
 */

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export type RatingOption = "again" | "hard" | "good" | "easy";

export const RATING_TO_GRADE: Record<RatingOption, ReviewGrade> = {
  again: 1, // Complete lapse, needs immediate reset
  hard: 3,  // Correct with serious difficulty
  good: 4,  // Correct after hesitation
  easy: 5,  // Perfect, instant recall
};

export type ReviewItemState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
};

export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

/**
 * Returns clean initial SM-2 state for a newly encountered card.
 */
export function initialReviewState(now: Date = new Date()): ReviewItemState {
  return {
    easeFactor: INITIAL_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now.toISOString(),
    lastReviewedAt: null,
  };
}

/**
 * Deterministically computes the next review schedule based on learner response grade.
 */
export function calculateNextReview(
  current: ReviewItemState,
  grade: ReviewGrade,
  now: Date = new Date(),
): ReviewItemState {
  let { easeFactor, intervalDays, repetitions, lapses } = current;

  if (grade < 3) {
    // Lapse: reset repetitions to 0, schedule for next day (interval = 1)
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  // SM-2 Ease Factor formula:
  // EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor + delta).toFixed(2)));

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lapses,
    dueAt,
    lastReviewedAt: now.toISOString(),
  };
}

/**
 * Convenience method accepting friendly rating options ("again" | "hard" | "good" | "easy").
 */
export function reviewWithRating(
  current: ReviewItemState,
  rating: RatingOption,
  now: Date = new Date(),
): ReviewItemState {
  return calculateNextReview(current, RATING_TO_GRADE[rating], now);
}

/**
 * Determines whether an item is currently due for review.
 */
export function isDue(item: { dueAt: string }, now: Date = new Date()): boolean {
  return new Date(item.dueAt).getTime() <= now.getTime();
}
