import { FLASHCARDS, type FlashCard } from "./flashcards";
import { initialReviewState, isDue, type ReviewItemState } from "./scheduler";

export type UserReviewItem = {
  id: string;
  userId: string;
  cardId: string;
  lessonId: string;
  state: ReviewItemState;
  createdAt: string;
  updatedAt: string;
};

export type QueueCard = {
  card: FlashCard;
  item?: UserReviewItem;
  isNew: boolean;
};

export const MAX_NEW_CARDS_PER_DAY = 5;
export const MAX_SESSION_CARDS = 10;
export const REVIEW_XP_PER_CARD = 5;
export const MAX_DAILY_REVIEW_XP = 50; // Max 10 cards earn XP per day to prevent exploits

/**
 * Builds an interleaved review queue for a learner session:
 * 1. Prioritizes due cards.
 * 2. If under session limit, supplements with eligible new cards up to daily cap.
 * 3. Interleaves categories to prevent clustering.
 */
export function buildReviewQueue(
  userItems: UserReviewItem[],
  operatorRank: number,
  now: Date = new Date(),
  sessionLimit: number = MAX_SESSION_CARDS,
  newCardsCap: number = MAX_NEW_CARDS_PER_DAY,
): QueueCard[] {
  // 1. Find cards that are due
  const dueItemsMap = new Map<string, UserReviewItem>();
  for (const item of userItems) {
    if (isDue(item.state, now)) {
      dueItemsMap.set(item.cardId, item);
    }
  }

  const existingCardIds = new Set(userItems.map((u) => u.cardId));

  // 2. Filter candidate flashcards unlocked for operator rank
  const eligibleCards = FLASHCARDS.filter((c) => c.rank <= operatorRank);

  const dueCards: QueueCard[] = [];
  for (const card of eligibleCards) {
    const item = dueItemsMap.get(card.id);
    if (item) {
      dueCards.push({ card, item, isNew: false });
    }
  }

  // 3. Select new cards if space remains, round-robining across categories
  const availableSlots = Math.max(0, sessionLimit - dueCards.length);
  const newCardsToAdd = Math.min(availableSlots, newCardsCap);

  const unreviewed = eligibleCards.filter((c) => !existingCardIds.has(c.id));
  const unreviewedByCat = new Map<string, FlashCard[]>();
  for (const card of unreviewed) {
    const list = unreviewedByCat.get(card.category) ?? [];
    list.push(card);
    unreviewedByCat.set(card.category, list);
  }

  const newCards: QueueCard[] = [];
  let added = true;
  while (newCards.length < newCardsToAdd && added) {
    added = false;
    for (const list of unreviewedByCat.values()) {
      if (newCards.length < newCardsToAdd && list.length > 0) {
        newCards.push({ card: list.shift()!, isNew: true });
        added = true;
      }
    }
  }

  // 4. Combine and interleave by category
  const combined = [...dueCards, ...newCards];
  return interleaveByCategory(combined).slice(0, sessionLimit);
}

/**
 * Deterministically interleaves cards by category so learners do not get
 * consecutive questions on the exact same domain.
 */
function interleaveByCategory(cards: QueueCard[]): QueueCard[] {
  if (cards.length <= 1) return cards;

  const buckets = new Map<string, QueueCard[]>();
  for (const item of cards) {
    const cat = item.card.category;
    const bucket = buckets.get(cat) ?? [];
    bucket.push(item);
    buckets.set(cat, bucket);
  }

  const result: QueueCard[] = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const bucket of buckets.values()) {
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
        if (bucket.length > 0) remaining = true;
      }
    }
  }

  return result;
}
