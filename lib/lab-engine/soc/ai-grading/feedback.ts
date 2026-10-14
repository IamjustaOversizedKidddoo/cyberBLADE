/**
 * Turns validated model fields into learner-facing text. The headline comes from the
 * rubric's own band wording; model sentences only appear after the tone filter.
 */
import { scrubPii } from "./text";
import type { AiLearnerFeedback, AiRubricCriterion, Band } from "./types";

const BLOCKED: RegExp[] = [
  /https?:\/\/|www\./i, // links
  /\b(stupid|idiot|idiotic|dumb|lazy|pathetic|useless|careless|incompetent|terrible|awful|garbage|clueless)\b/i,
  /\b(guarantee[sd]?|certified|certification|definitely (will )?pass|100\s?%|always pass|never fail)\b/i,
  /\b(band|bands|score|scored|scoring|points?|marks?|grade[sd]?|rubric|percent)\b/i, // grading talk belongs to the UI, not prose
  /\b(ignore|instruction|instructions|system prompt|canary|as an ai|language model)\b/i,
  /CANARY-[0-9a-f]+/i,
  /<[^>]+>/, // markup
];

export const MAX_FEEDBACK_SENTENCE = 240;

/** Keep a sentence only if it is short, respectful and about the writing. */
export function passesToneFilter(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 8 || s.length > MAX_FEEDBACK_SENTENCE) return false;
  return !BLOCKED.some((re) => re.test(s));
}

function clean(list: string[]): string[] {
  return list
    .map((s) => scrubPii(s.replace(/\s+/g, " ").trim()))
    .filter(passesToneFilter)
    .slice(0, 3);
}

export function buildLearnerFeedback(
  criterion: AiRubricCriterion,
  band: Band,
  strengths: string[],
  improvements: string[],
): AiLearnerFeedback {
  const b = criterion.bands[band];
  return {
    summary: `${b.label}: ${b.descriptor}`,
    strengths: clean(strengths),
    improvements: clean(improvements),
  };
}

export function emptyFeedback(): AiLearnerFeedback {
  return { summary: "", strengths: [], improvements: [] };
}
