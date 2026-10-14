/**
 * Lesson micro-exercises: small fixed synthetic datasets with server-checked answers.
 * The public shape (toPublicExercises) never carries accepted answers or explanations; the full
 * set is loaded only on the server (exercises-server.ts).
 */
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const logBlock = z.object({ type: z.literal("log"), title: z.string(), lines: z.array(z.string()).min(1) });
const tableBlock = z.object({
  type: z.literal("table"),
  title: z.string(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

export const NORMALIZE_RULES = ["case", "whitespace", "refang", "trailing-dot"] as const;

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    prompt: z.string().min(1),
    answer_type: z.enum(["choice", "text"]),
    options: z.array(z.string().min(1)).min(2).max(6).optional(),
    /** Accepted answers (server only). For choice questions: the exact option text. */
    accept: z.array(z.string().min(1)).min(1),
    normalize: z.array(z.enum(NORMALIZE_RULES)).default(["case", "whitespace"]),
    /** Method hints only: never the answer (linter checks). */
    hints: z.array(z.string().min(1)).min(1).max(3),
    /** Shown only after a correct answer (server only until then). */
    explanation: z.string().min(20),
  })
  .refine((q) => q.answer_type !== "choice" || (q.options && q.accept.every((a) => q.options!.includes(a))), {
    message: "choice questions need options that include every accepted answer",
  });

const exerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  kind: z.enum(["triage-queue", "header-analysis", "log-reading", "query", "timeline", "report-section"]),
  instructions: z.string().min(1),
  blocks: z.array(z.union([logBlock, tableBlock])).min(1),
  questions: z.array(questionSchema).min(1).max(6),
});

export const exerciseSetSchema = z.object({
  lesson: z.string().min(1),
  exercises: z.array(exerciseSchema).min(1),
});

export type ExerciseSet = z.infer<typeof exerciseSetSchema>;
export type Exercise = ExerciseSet["exercises"][number];

export interface PublicExerciseQuestion {
  id: string;
  prompt: string;
  answerType: "choice" | "text";
  options?: string[];
  hints: string[];
}

export interface PublicExercise {
  id: string;
  title: string;
  kind: Exercise["kind"];
  instructions: string;
  blocks: Exercise["blocks"];
  questions: PublicExerciseQuestion[];
}

export function parseExercises(yamlText: string, source: string): ExerciseSet {
  const r = exerciseSetSchema.safeParse(parseYaml(yamlText));
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`${source}: ${i.path.join(".")} — ${i.message}`);
  }
  return r.data;
}

export function toPublicExercises(set: ExerciseSet): Record<string, PublicExercise> {
  return Object.fromEntries(
    set.exercises.map((e) => [
      e.id,
      {
        id: e.id,
        title: e.title,
        kind: e.kind,
        instructions: e.instructions,
        blocks: e.blocks,
        questions: e.questions.map((q) => ({ id: q.id, prompt: q.prompt, answerType: q.answer_type, options: q.options, hints: q.hints })),
      },
    ]),
  );
}

/** Turns defanged indicators back into their plain form: 192.0.2[.]10 -> 192.0.2.10, hxxps -> https. */
export function refang(value: string): string {
  return value
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)/gi, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[@\]|\[at\]|\(at\)/gi, "@")
    .replace(/\bhxxp(s?)/gi, "http$1");
}

export function normalizeAnswer(value: string, rules: readonly (typeof NORMALIZE_RULES)[number][]): string {
  let v = value.normalize("NFKC");
  if (rules.includes("whitespace")) v = v.replace(/\s+/g, " ").trim();
  if (rules.includes("refang")) v = refang(v);
  if (rules.includes("trailing-dot")) v = v.replace(/\.+$/, "");
  if (rules.includes("case")) v = v.toLowerCase();
  return v;
}

export function isAcceptedAnswer(question: Exercise["questions"][number], answer: string): boolean {
  if (typeof answer !== "string" || answer.length > 500) return false;
  const got = normalizeAnswer(answer, question.normalize);
  return question.accept.some((a) => normalizeAnswer(a, question.normalize) === got);
}
