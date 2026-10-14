/**
 * SOC L1 track structure for the track landing page, module pages, glossary, practice paths and
 * module checkpoints. Node-only (reads content files); used by server pages and the content linter.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { termAnchor } from "@/components/lesson/KeyTerms";
import type { Lesson } from "./schema";
import { keyTermsOf } from "./soc-lesson-lint";
import { SOC_L1_DIR, type TrackConfig } from "./soc-track";

export const SOC_TRACK_BASE = "/learn/soc-l1";

export type TrackModule = TrackConfig["modules"][number] & { lessons: Lesson[]; minutes: number };

/** Modules in order, each with its visible lessons in order. */
export function groupModules(track: TrackConfig, lessons: Lesson[]): TrackModule[] {
  return [...track.modules]
    .sort((a, b) => a.order - b.order)
    .map((m) => {
      const ls = lessons.filter((l) => l.track === "soc" && l.module === m.key).sort((a, b) => a.order - b.order);
      return { ...m, lessons: ls, minutes: ls.reduce((n, l) => n + l.estimated_minutes, 0) };
    });
}

// ---------------------------------------------------------------------------
// Glossary
// ---------------------------------------------------------------------------

export type GlossaryEntry = { term: string; definition: string; anchor: string; lessonId: string; lessonTitle: string };

export function buildGlossary(lessons: Lesson[]): GlossaryEntry[] {
  return lessons
    .filter((l) => l.track === "soc")
    .flatMap((l) => keyTermsOf(l.body).map((t) => ({ ...t, anchor: termAnchor(t.term), lessonId: l.id, lessonTitle: l.title })))
    .sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
}

// Single common English words that would produce misleading tooltips in ordinary sentences.
const TOOLTIP_STOPLIST = new Set([
  "alert", "case", "queue", "field", "pipe", "context", "priority", "impact", "incident", "recovery", "assumption",
  "grouping", "procedure", "duplicate", "hypothesis", "loader", "containment", "eradication", "severity", "reputation",
  "correlation", "aggregation", "escalation", "timeline", "baseline", "payload", "tactic", "technique", "triage",
]);

/** Glossary entries eligible for first-use tooltips (multi-word terms, acronyms, or uncommon single words). */
export function tooltipTerms(glossary: GlossaryEntry[]): GlossaryEntry[] {
  return glossary.filter((g) => g.term.length >= 3 && !TOOLTIP_STOPLIST.has(g.term.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Practice paths
// ---------------------------------------------------------------------------

const stepSchema = z.union([z.object({ lesson: z.string() }), z.object({ practice: z.string() })]);
export const practicePathsSchema = z.object({
  paths: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string().min(1),
        description: z.string().min(1),
        steps: z.array(stepSchema).min(2),
      }),
    )
    .min(1),
});
export type PracticePaths = z.infer<typeof practicePathsSchema>;

export function loadPracticePaths(dir = SOC_L1_DIR): PracticePaths {
  return practicePathsSchema.parse(parseYaml(fs.readFileSync(path.join(dir, "paths.yaml"), "utf8")));
}

// A drill, tool or report-section exercise has no recorded duration; this is the stated assumption.
export const DEFAULT_PRACTICE_MINUTES = 10;

/** Duration range of a practice target from its own metadata (families and shifts), else the default. */
export function practiceMinutes(target: string, root = "content/soc"): { min: number; max: number; estimated: boolean } {
  const [kind, id] = target.split(":");
  const file = kind === "family" ? path.join(root, "families", `${id}.yaml`) : kind === "shift" ? path.join(root, "shifts", `${id}.yaml`) : null;
  if (file && fs.existsSync(file)) {
    const doc = parseYaml(fs.readFileSync(file, "utf8")) as { estimatedMinutes?: { min: number; max: number }; metadata?: { estimatedMinutes?: { min: number; max: number } } };
    const m = doc.estimatedMinutes ?? doc.metadata?.estimatedMinutes;
    if (m) return { min: m.min, max: m.max, estimated: false };
  }
  return { min: DEFAULT_PRACTICE_MINUTES, max: DEFAULT_PRACTICE_MINUTES, estimated: true };
}

/** Total time of a path: computed lesson minutes plus practice ranges. */
export function pathMinutes(steps: PracticePaths["paths"][number]["steps"], lessons: Lesson[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const s of steps) {
    if ("lesson" in s) {
      const l = lessons.find((x) => x.id === s.lesson);
      min += l?.estimated_minutes ?? 0;
      max += l?.estimated_minutes ?? 0;
    } else {
      const p = practiceMinutes(s.practice);
      min += p.min;
      max += p.max;
    }
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// Module checkpoints
// ---------------------------------------------------------------------------

/** Checkpoint question ids are "<lessonId>~<questionId>"; the last two check questions of each lesson. */
export const CHECKPOINT_PER_LESSON = 2;

export function checkpointIds(lessonIds: string[], questionIdsByLesson: Map<string, string[]>): string[] {
  return lessonIds.flatMap((id) => (questionIdsByLesson.get(id) ?? []).slice(-CHECKPOINT_PER_LESSON).map((q) => `${id}~${q}`));
}

export function splitCheckpointId(id: string): { lessonId: string; questionId: string } | null {
  const m = /^([a-z0-9-]+)~([a-z0-9_-]+)$/.exec(id);
  return m ? { lessonId: m[1], questionId: m[2] } : null;
}
