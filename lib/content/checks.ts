import { parse as parseYaml } from "yaml";
import { z } from "zod";

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

/** What the browser may see: prompts and option texts, never which is correct or why. */
export function toPublicChecks(set: CheckSet): PublicQuestion[] {
  return set.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => o.text) }));
}

export function gradeCheck(set: CheckSet, questionId: string, optionIndex: number): { correct: boolean; explanations: string[] } {
  const question = set.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`unknown question ${questionId}`);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw new Error(`option ${optionIndex} out of range for ${questionId}`);
  }
  return {
    correct: question.options[optionIndex].correct,
    explanations: question.options.map((o) => o.explanation),
  };
}
