"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { getFlashcardById } from "@/lib/review/flashcards";
import {
  initialReviewState,
  reviewWithRating,
  type RatingOption,
} from "@/lib/review/scheduler";
import {
  REVIEW_XP_PER_CARD,
  MAX_DAILY_REVIEW_XP,
} from "@/lib/review/session";

const ratingSchema = z.enum(["again", "hard", "good", "easy"]);

export async function submitCardReviewAction(cardId: string, rawRating: RatingOption) {
  const rating = ratingSchema.parse(rawRating);
  const operator = await requireOperator();
  const ctx = getCtx();
  const now = ctx.now();

  const card = getFlashcardById(cardId);
  if (!card) throw new Error("Card not found");

  const existingItems = await ctx.repo.listReviewItems(operator.id);
  const existing = existingItems.find((i) => i.cardId === cardId);

  const currentState = existing
    ? {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        lapses: existing.lapses,
        dueAt: existing.dueAt,
        lastReviewedAt: existing.lastReviewedAt,
      }
    : initialReviewState(now);

  const nextState = reviewWithRating(currentState, rating, now);

  await ctx.repo.saveReviewItem({
    ...(existing?.id ? { id: existing.id } : {}),
    userId: operator.id,
    cardId: card.id,
    lessonId: card.lessonId,
    easeFactor: nextState.easeFactor,
    intervalDays: nextState.intervalDays,
    repetitions: nextState.repetitions,
    lapses: nextState.lapses,
    dueAt: nextState.dueAt,
    lastReviewedAt: nextState.lastReviewedAt,
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const gradeMap: Record<RatingOption, number> = { again: 1, hard: 3, good: 4, easy: 5 };
  await ctx.repo.logReviewEvent({
    userId: operator.id,
    cardId: card.id,
    grade: gradeMap[rating],
    reviewedAt: now.toISOString(),
  });

  // Calculate daily review XP earned so far today
  const todayPrefix = now.toISOString().slice(0, 10);
  const xpEvents = await ctx.repo.listXpEvents(operator.id);
  const todayReviewXp = xpEvents
    .filter((e) => e.source.startsWith(`review:`) && e.createdAt.startsWith(todayPrefix))
    .reduce((sum, e) => sum + e.amount, 0);

  let xpAwarded = 0;
  if (todayReviewXp < MAX_DAILY_REVIEW_XP) {
    xpAwarded = Math.min(REVIEW_XP_PER_CARD, MAX_DAILY_REVIEW_XP - todayReviewXp);
    if (xpAwarded > 0) {
      await ctx.repo.awardXp(
        operator.id,
        `review:${card.id}:${now.getTime()}`,
        xpAwarded,
      );
    }
  }

  return {
    success: true,
    nextIntervalDays: nextState.intervalDays,
    nextDueAt: nextState.dueAt,
    xpAwarded,
  };
}
