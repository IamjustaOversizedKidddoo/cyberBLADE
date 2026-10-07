import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { createRng } from "@/lib/generators/rng";

const optionSchema = z.object({
  text: z.string().min(1),
  correct: z.boolean(),
  explanation: z.string().min(1, "every option needs an explanation"),
});

const questionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    objectives: z.array(z.string().regex(/^[a-z0-9]+:[\w.-]+$/, "expected <cert>:<objective>")).min(1),
    options: z.array(optionSchema).min(2).max(5),
  })
  .refine((q) => q.options.filter((o) => o.correct).length === 1, "exactly one option must be correct");

export const checksSchema = z
  .object({
    lesson: z.string().min(1),
    questions: z.array(questionSchema).min(3).max(5),
  })
  .refine((s) => new Set(s.questions.map((q) => q.id)).size === s.questions.length, "question ids must be unique");

export type CheckSet = z.infer<typeof checksSchema>;
export type PublicQuestion = { id: string; prompt: string; options: string[] };

export function parseChecks(yamlText: string, source: string): CheckSet {
  const parsed = checksSchema.safeParse(parseYaml(yamlText));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${source}: ${issue.path.join(".") || "checks"} — ${issue.message}`);
  }
  return parsed.data;
}

/**
 * Display order of a question's options for one learner: shuffled (so "the answer is always A"
 * can't be learned) but stable, so a refresh shows the same order.
 */
export function optionOrder(learnerId: string, lessonId: string, questionId: string, count: number): number[] {
  return createRng(`checks:${learnerId}:${lessonId}:${questionId}`).shuffle(Array.from({ length: count }, (_, i) => i));
}

const orderFor = (set: CheckSet, q: CheckSet["questions"][number], learnerId?: string) =>
  learnerId ? optionOrder(learnerId, set.lesson, q.id, q.options.length) : q.options.map((_, i) => i);

/** What the browser may see: prompts and option texts in the learner's order, never which is correct or why. */
export function toPublicChecks(set: CheckSet, learnerId?: string): PublicQuestion[] {
  return set.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: orderFor(set, q, learnerId).map((i) => q.options[i].text),
  }));
}

/** `shownIndex` is the position the learner saw (see toPublicChecks); explanations come back in that order. */
export function gradeCheck(
  set: CheckSet,
  questionId: string,
  shownIndex: number,
  learnerId?: string,
): { correct: boolean; explanations: string[] } {
  const question = set.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`unknown question ${questionId}`);
  if (!Number.isInteger(shownIndex) || shownIndex < 0 || shownIndex >= question.options.length) {
    throw new Error(`option ${shownIndex} out of range for ${questionId}`);
  }
  const order = orderFor(set, question, learnerId);
  return {
    correct: question.options[order[shownIndex]].correct,
    explanations: order.map((i) => question.options[i].explanation),
  };
}
