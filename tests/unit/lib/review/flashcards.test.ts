import { describe, expect, it } from "vitest";
import {
  FLASHCARDS,
  getFlashcardById,
  getFlashcardsByRank,
  type FlashCard,
} from "@/lib/review/flashcards";

describe("Flashcard Library Integrity", () => {
  const VALID_CATEGORIES = new Set(["linux", "network", "windows", "web", "defense", "soc"]);
  const VALID_RANKS = new Set([0, 1, 2]);

  it("contains at least 15 curated flashcards", () => {
    expect(FLASHCARDS.length).toBeGreaterThanOrEqual(15);
  });

  it("has unique IDs across the entire library", () => {
    const ids = FLASHCARDS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every card has a non-empty front and back", () => {
    for (const card of FLASHCARDS) {
      expect(card.front.trim().length, `Card ${card.id} has empty front`).toBeGreaterThan(10);
      expect(card.back.trim().length, `Card ${card.id} has empty back`).toBeGreaterThan(10);
    }
  });

  it("every card references a valid category", () => {
    for (const card of FLASHCARDS) {
      expect(
        VALID_CATEGORIES.has(card.category),
        `Card ${card.id} has invalid category "${card.category}"`,
      ).toBe(true);
    }
  });

  it("every card references a valid rank (0, 1, or 2)", () => {
    for (const card of FLASHCARDS) {
      expect(
        VALID_RANKS.has(card.rank),
        `Card ${card.id} has invalid rank ${card.rank}`,
      ).toBe(true);
    }
  });

  it("has at least one card per category", () => {
    for (const cat of VALID_CATEGORIES) {
      const count = FLASHCARDS.filter((c) => c.category === cat).length;
      expect(count, `No flashcards for category "${cat}"`).toBeGreaterThanOrEqual(1);
    }
  });

  it("every card has a non-empty lessonId", () => {
    for (const card of FLASHCARDS) {
      expect(card.lessonId.length, `Card ${card.id} missing lessonId`).toBeGreaterThan(0);
    }
  });

  it("getFlashcardById returns the correct card", () => {
    const first = FLASHCARDS[0];
    const found = getFlashcardById(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
    expect(found!.front).toBe(first.front);
  });

  it("getFlashcardById returns undefined for unknown ID", () => {
    expect(getFlashcardById("fc-nonexistent-99")).toBeUndefined();
  });

  it("getFlashcardsByRank filters to cards at or below the given rank", () => {
    const rank0 = getFlashcardsByRank(0);
    expect(rank0.every((c) => c.rank <= 0)).toBe(true);

    const rank1 = getFlashcardsByRank(1);
    expect(rank1.every((c) => c.rank <= 1)).toBe(true);
    expect(rank1.length).toBeGreaterThanOrEqual(rank0.length);

    const rank2 = getFlashcardsByRank(2);
    expect(rank2.length).toBe(FLASHCARDS.length);
  });

  it("front text always ends with a question mark (pedagogically well-formed)", () => {
    for (const card of FLASHCARDS) {
      expect(
        card.front.trimEnd().endsWith("?"),
        `Card ${card.id} front does not end with '?': "${card.front.slice(-30)}"`,
      ).toBe(true);
    }
  });
});
