import remarkGfm from "remark-gfm";
import { z } from "zod";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import type { CheckSet } from "./checks";
import type { Lesson } from "./schema";

export const coverageSchema = z
  .object({
    built_ranks: z.array(z.number().int().min(0).max(5)),
    certs: z.record(z.string().regex(/^[a-z0-9]+$/), z.object({ name: z.string(), exam: z.string() })),
    objectives: z.array(
      z.object({
        id: z.string().regex(/^[a-z0-9]+:[\w.-]+$/),
        summary: z.string().min(1),
        target_rank: z.number().int().min(0).max(5),
      }),
    ),
  })
  .refine((c) => c.objectives.every((o) => Object.hasOwn(c.certs, o.id.split(":")[0])), "every objective must belong to a listed cert")
  .refine((c) => new Set(c.objectives.map((o) => o.id)).size === c.objectives.length, "objective ids must be unique");

export type Coverage = z.infer<typeof coverageSchema>;

export type ContentInput = {
  lessons: Lesson[];
  checks: Map<string, CheckSet>;
  labs: LoadedLab[];
  coverage: Coverage;
  /** Registered generator names. */
  generators: string[];
  /** Commands from the lesson that the lab shell cannot run (see lesson-commands.ts). */
  runLessonCommands: (lesson: Lesson) => string[];
  now: Date;
};

// CLAUDE.md lesson template, in order.
const REQUIRED_SECTIONS = [
  "## Briefing",
  "### 1.",
  "### 2.",
  "### 3.",
  "### 4.",
  "### 5.",
  "### 6.",
  "### 7.",
  "### Remember it like this",
  "### Interview answer",
  "## Terminal Check",
  "## Lab",
  "## Debrief",
];

function headings(body: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (line.trim().startsWith("```")) fenced = !fenced;
    else if (!fenced && /^#{2,3} /.test(line)) out.push(line.trim());
  }
  return out;
}

function structureErrors(lesson: Lesson): string[] {
  const errors: string[] = [];
  const found = headings(lesson.body);
  let from = 0;
  for (const section of REQUIRED_SECTIONS) {
    const exactLevel = (h: string) => h.startsWith(section) && (section.endsWith(".") || h === section || h.startsWith(`${section} `));
    const i = found.findIndex((h, idx) => idx >= from && exactLevel(h));
    if (i === -1) errors.push(`${lesson.id}: missing section "${section}" (or out of order)`);
    else from = i + 1;
  }
  if (!/<TerminalCheck\s*\/>/.test(lesson.body)) errors.push(`${lesson.id}: "## Terminal Check" must contain <TerminalCheck />`);
  if (lesson.lab && !/<LabLink\s*\/>/.test(lesson.body)) errors.push(`${lesson.id}: "## Lab" must contain <LabLink /> (lesson has lab ${lesson.lab})`);
  return errors;
}

async function mdxErrors(lesson: Lesson): Promise<string[]> {
  try {
    // Dynamic import: @mdx-js/mdx is ESM-only and this module also runs under the CJS script runner.
    const { compile } = await import("@mdx-js/mdx");
    await compile(lesson.body, { remarkPlugins: [remarkGfm] });
    return [];
  } catch (err) {
    return [`${lesson.id}: MDX does not compile — ${(err as Error).message.split("\n")[0]}`];
  }
}

/** Every rule a lesson must pass before it can ship (spec §4, CLAUDE.md). */
export async function validateContent(input: ContentInput): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const objectiveIds = new Set(input.coverage.objectives.map((o) => o.id));
  const labsById = new Map(input.labs.map((l) => [l.id, l]));

  for (const lab of input.labs) {
    if (!input.generators.includes(lab.dataset.generator)) {
      errors.push(`lab ${lab.id}: generator ${lab.dataset.generator} is not registered`);
    }
  }

  for (const lesson of input.lessons) {
    errors.push(...structureErrors(lesson), ...(await mdxErrors(lesson)));

    const checks = input.checks.get(lesson.id);
    if (!checks) errors.push(`${lesson.id}: no checks file`);
    else {
      if (checks.lesson !== lesson.id) errors.push(`${lesson.id}: checks file says lesson ${checks.lesson}`);
      for (const q of checks.questions) {
        for (const o of q.objectives) {
          if (!objectiveIds.has(o)) errors.push(`${lesson.id}: check ${q.id} objective ${o} is not in the coverage matrix`);
        }
      }
    }

    if (lesson.lab) {
      const lab = labsById.get(lesson.lab);
      if (!lab) errors.push(`${lesson.id}: unknown lab ${lesson.lab}`);
      else if (lab.challenge) errors.push(`${lesson.id}: ${lesson.lab} is a challenge lab and cannot be a lesson lab`);
    }

    for (const o of lesson.objectives_covered) {
      if (!objectiveIds.has(o)) errors.push(`${lesson.id}: objective ${o} is not in the coverage matrix`);
    }

    for (const problem of input.runLessonCommands(lesson)) {
      errors.push(`${lesson.id}: lesson command fails in the lab shell: ${problem}`);
    }

    if (lesson.last_reviewed) {
      const ageDays = (input.now.getTime() - new Date(lesson.last_reviewed).getTime()) / 86_400_000;
      if (ageDays > 365) warnings.push(`${lesson.id}: last reviewed ${lesson.last_reviewed} — older than 12 months, due for review`);
    }
  }

  const covered = new Set(input.lessons.flatMap((l) => l.objectives_covered));
  for (const o of input.coverage.objectives) {
    if (input.coverage.built_ranks.includes(o.target_rank) && !covered.has(o.id)) {
      errors.push(`coverage: ${o.id} (target rank ${o.target_rank}) has no lesson`);
    }
  }

  return { errors, warnings };
}
