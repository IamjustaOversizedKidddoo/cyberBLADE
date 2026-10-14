/**
 * Content rules for SOC L1 track lessons (docs/design/soc-curriculum.md §2, §6). Pure functions:
 * check-content.mts gathers the files and calls these, and the unit tests plant violations.
 */
import type { CheckSet } from "./checks";
import { normalizeAnswer, type ExerciseSet } from "./exercises";
import type { Lesson } from "./schema";

export type LessonCard = { id: string; front: string; back: string };

export type SocLintInput = {
  lesson: Lesson;
  checks: CheckSet | undefined;
  exercises: ExerciseSet | null;
  cards: LessonCard[] | null;
  skillIds: Set<string>;
  moduleKeys: Set<string>;
  minCoreRank: number;
  /** Returns an error message for a practice target that does not resolve, else null. */
  practiceError: (target: string) => string | null;
  /** Lower-case generator vocabulary markers (IOCs, subjects, sender addresses) lessons must never reuse. */
  markers: string[];
};

// SOC L1 template, in order (H2 only; Core ideas may hold any ### sections).
export const SOC_SECTIONS = [
  "## Why this matters on shift",
  "## Before you start",
  "## Core ideas",
  "## Worked example",
  "## Try it",
  "## Common mistakes",
  "## What good looks like",
  "## In the real world",
  "## Remember it like this",
  "## Interview answer",
  "## Check your understanding",
  "## Key terms",
  "## Practice this",
] as const;

export const MIN_CHECKS = 4;
export const SPLIT_WARNING_MINUTES = 15;

// Lessons never name certifications (content rule: original wording, objectives mapped internally).
const CERT_NAMES = /\b(CompTIA|Security\+|CySA\+|Network\+|CEH|OSCP|GCIH|GCIA|BTL1|SC-200|CISSP|CCNA)(?![\w+])/;
// No hype and no absolute promises about security.
const HYPE = [
  /\b100\s?% (safe|secure|accurate|certain)\b/i,
  /\bunhackable\b/i,
  /\balways malicious\b/i,
  /\bnever a false positive\b/i,
  /\bguaranteed? (to|that)\b/i,
  /\belite hackers?\b/i,
];
// Canonical disposition wording used across the track and the simulator.
const TERM_VARIANTS: Array<[RegExp, string]> = [
  [/\bbenign positive\b/i, "benign true positive"],
  [/\btrue-positive\b/i, "true positive"],
  [/\bfalse-positive (alert|result|verdict)s?\b/i, "false positive"],
];

const RESERVED_V4 = [/^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./, /^0\.0\.0\.0$/];
// Real-world TLDs that must not appear in lesson data (reserved .example/.test/.invalid are fine).
const REAL_TLDS = new Set([
  "com", "net", "org", "io", "co", "ru", "cn", "info", "biz", "xyz", "top", "us", "uk", "de", "fr", "in", "gov", "edu", "mil",
  "ai", "me", "cc", "tk", "online", "site", "club", "live", "shop", "su", "ir", "kp",
]);

/** Words a learner reads. Log blocks count (they are read); component names and prop keys do not. */
export function lessonWordCount(body: string): number {
  const text = body
    .replace(/^(import|export) .*$/gm, " ")
    .replace(/<\/?[A-Z][A-Za-z]*/g, " ") // component tag names
    .replace(/\b(id|title|description|steps|label|detail|loopBackLabel|terms|term|definition|lines)\s*[:=]/g, " ") // prop keys
    .replace(/[#>*_`|{}[\]()]/g, " ");
  return (text.match(/[A-Za-z0-9]+(?:['’.\-][A-Za-z0-9]+)*/g) ?? []).length;
}

export type LessonTime = { words: number; exercises: number; checks: number; diagrams: number; minutes: number };

/** Computed time = words ÷ 200 + 3 per exercise + 1 per check + 0.5 per diagram, rounded up. */
export function computeLessonTime(lesson: Lesson, checks: CheckSet | undefined): LessonTime {
  const words = lessonWordCount(lesson.body);
  const exercises = (lesson.body.match(/<MicroExercise\b/g) ?? []).length;
  const diagrams = (lesson.body.match(/<FlowDiagram\b/g) ?? []).length;
  const checkCount = checks?.questions.length ?? 0;
  const minutes = Math.ceil(words / 200 + exercises * 3 + checkCount + diagrams * 0.5);
  return { words, exercises, checks: checkCount, diagrams, minutes };
}

function headingsOf(body: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (line.trim().startsWith("```")) fenced = !fenced;
    else if (!fenced && /^## /.test(line)) out.push(line.trim());
  }
  return out;
}

function lessonText(input: SocLintInput): string {
  return [input.lesson.body, JSON.stringify(input.exercises ?? {}), JSON.stringify(input.checks ?? {}), JSON.stringify(input.cards ?? [])].join("\n");
}

/** Generator markers that appear anywhere in the lesson, its exercises, checks or cards. */
export function leakedMarkers(text: string, markers: string[]): string[] {
  const lower = text.toLowerCase();
  return [...new Set(markers.filter((m) => m.length >= 6 && lower.includes(m)))];
}

/** IPv4 addresses and real-TLD domains that are not documentation/private ranges or reserved names. */
export function nonReservedIndicators(text: string): string[] {
  const bad = new Set<string>();
  for (const ip of text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? []) {
    if (!RESERVED_V4.some((r) => r.test(ip))) bad.add(ip);
  }
  for (const host of text.toLowerCase().match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/g) ?? []) {
    const labels = host.split(".");
    const tld = labels.at(-1)!;
    if (!REAL_TLDS.has(tld)) continue;
    if (/(^|\.)example\.(com|net|org)$/.test(host)) continue;
    bad.add(host);
  }
  return [...bad];
}

export function lintSocLesson(input: SocLintInput): { errors: string[]; warnings: string[] } {
  const { lesson, checks, exercises, cards } = input;
  const id = lesson.id;
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(`${id}: ${m}`);

  // Frontmatter
  if (lesson.track !== "soc") err(`track must be soc`);
  if (lesson.rank !== input.minCoreRank) err(`rank ${lesson.rank} must equal the track's min_core_rank ${input.minCoreRank}`);
  if (!input.moduleKeys.has(lesson.module)) err(`module ${lesson.module} is not in track.yaml`);
  if (lesson.status !== "draft") err(`status must stay draft until a human reviews it`);
  if (!lesson.review_status) err(`review_status is required (draft or agent-checked)`);
  if (!lesson.prerequisites?.length) err(`prerequisites must list at least one lesson`);
  if (!lesson.skills?.length) err(`skills must list at least one skill id`);
  for (const s of lesson.skills ?? []) if (!input.skillIds.has(s)) err(`unknown skill ${s}`);
  for (const o of lesson.objectives_covered) {
    const m = /^soc:(.+)$/.exec(o);
    if (!m) err(`objective ${o} must be soc:<skill>`);
    else if (!lesson.skills?.includes(m[1])) err(`objective ${o} is not one of the lesson's skills`);
  }
  if (!lesson.practice?.length) err(`practice must list at least one target`);
  for (const t of lesson.practice ?? []) {
    const problem = input.practiceError(t);
    if (problem) err(`practice ${t}: ${problem}`);
  }

  // Structure
  const firstH2 = lesson.body.search(/^## /m);
  if (!/^> \*\*Outcome:\*\* \S/m.test(firstH2 === -1 ? lesson.body : lesson.body.slice(0, firstH2))) err(`missing "> **Outcome:**" line before the first section`);
  const found = headingsOf(lesson.body);
  let from = 0;
  for (const section of SOC_SECTIONS) {
    const i = found.findIndex((h, idx) => idx >= from && h === section);
    if (i === -1) err(`missing section "${section}" (or out of order)`);
    else from = i + 1;
  }
  if (!/<TerminalCheck\s*\/>/.test(lesson.body)) err(`"## Check your understanding" must contain <TerminalCheck />`);
  if (!/<KeyTerms\b/.test(lesson.body)) err(`"## Key terms" must contain <KeyTerms>`);
  if (!/<PracticeThis\s*\/>/.test(lesson.body)) err(`"## Practice this" must contain <PracticeThis />`);
  if (!/<FlowDiagram\b/.test(lesson.body)) warnings.push(`${id}: no <FlowDiagram> in Core ideas`);

  // Checks
  if (!checks) err(`no checks file`);
  else if (checks.questions.length < MIN_CHECKS) err(`needs at least ${MIN_CHECKS} check questions (has ${checks.questions.length})`);

  // Exercises: every embed exists, hints never contain the answer
  const embedded = [...lesson.body.matchAll(/<MicroExercise\s+id="([a-z0-9-]+)"\s*\/>/g)].map((m) => m[1]);
  if (!embedded.length) err(`needs at least one <MicroExercise id="..." />`);
  if (embedded.length && !exercises) err(`embeds exercises but has no .exercises.yaml`);
  if (exercises) {
    if (exercises.lesson !== id) err(`exercises file says lesson ${exercises.lesson}`);
    const ids = new Set(exercises.exercises.map((e) => e.id));
    for (const e of embedded) if (!ids.has(e)) err(`<MicroExercise id="${e}" /> has no matching exercise`);
    for (const e of exercises.exercises) {
      if (!embedded.includes(e.id)) warnings.push(`${id}: exercise ${e.id} is never embedded`);
      for (const q of e.questions) {
        if (q.answer_type === "choice") {
          if (!q.options?.length) err(`exercise ${e.id}/${q.id}: choice question without options`);
          for (const a of q.accept) if (!q.options?.includes(a)) err(`exercise ${e.id}/${q.id}: accepted answer is not an option`);
        }
        for (const hint of q.hints) {
          const h = normalizeAnswer(hint, ["case", "whitespace", "refang"]);
          for (const a of q.accept) {
            const ans = normalizeAnswer(a, ["case", "whitespace", "refang"]);
            // Short choice answers ("fail") are common words; only leak-check answers with substance.
            if (ans.length >= 5 && h.includes(ans)) err(`exercise ${e.id}/${q.id}: hint reveals the answer`);
          }
        }
      }
    }
  }

  // Cards
  if (!cards?.length) err(`no flashcards (.cards.yaml)`);
  for (const c of cards ?? []) {
    if (!c.id.startsWith(`fc-${id.replace(/-\d{2}$/, "")}`)) err(`card ${c.id} must start with fc-${id.replace(/-\d{2}$/, "")}`);
  }

  // Leaks, indicators, wording
  const text = lessonText(input);
  for (const m of leakedMarkers(text, input.markers)) err(`reuses generator vocabulary "${m}" (worked examples must not share markers with scenarios)`);
  for (const ind of nonReservedIndicators(text)) err(`"${ind}" is not a documentation IP or reserved domain`);
  const cert = CERT_NAMES.exec(text);
  if (cert) err(`names a certification ("${cert[1]}"); lessons never name certs`);
  for (const r of HYPE) {
    const m = r.exec(text);
    if (m) err(`hype or absolute claim: "${m[0]}"`);
  }
  for (const [r, canonical] of TERM_VARIANTS) {
    const m = r.exec(lesson.body);
    if (m) err(`use "${canonical}" instead of "${m[0]}"`);
  }

  // Time
  const time = computeLessonTime(lesson, checks);
  if (time.minutes !== lesson.estimated_minutes) err(`estimated_minutes ${lesson.estimated_minutes} ≠ computed ${time.minutes} (${time.words} words, ${time.exercises} exercises, ${time.checks} checks, ${time.diagrams} diagrams)`);
  if (time.minutes > SPLIT_WARNING_MINUTES) warnings.push(`${id}: ${time.minutes} min, over ${SPLIT_WARNING_MINUTES}; consider splitting`);

  return { errors, warnings };
}

type GraphNode = Pick<Lesson, "id" | "track" | "rank" | "module" | "order" | "prerequisites">;

/** Prerequisites exist, form no cycle, and point backwards (earlier L1 lesson or core at/below the gate rank). */
export function prerequisiteGraphErrors(lessons: GraphNode[], minCoreRank: number): string[] {
  const errors: string[] = [];
  const byId = new Map(lessons.map((l) => [l.id, l]));
  for (const l of lessons) {
    for (const p of l.prerequisites ?? []) {
      const pre = byId.get(p);
      if (!pre) errors.push(`${l.id}: prerequisite ${p} does not exist`);
      else if (p === l.id) errors.push(`${l.id}: lists itself as a prerequisite`);
      else if (l.track === "soc" && pre.track === "core" && pre.rank > minCoreRank) errors.push(`${l.id}: prerequisite ${p} is above the track gate (rank ${pre.rank})`);
      else if (l.track === "soc" && pre.track === "soc" && pre.order >= l.order) errors.push(`${l.id}: prerequisite ${p} comes later in the track`);
    }
  }
  // Cycle detection (DFS, white/grey/black).
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      errors.push(`prerequisite cycle: ${[...trail.slice(trail.indexOf(id)), id].join(" → ")}`);
      return;
    }
    state.set(id, 1);
    for (const p of byId.get(id)?.prerequisites ?? []) if (byId.has(p)) visit(p, [...trail, id]);
    state.set(id, 2);
  };
  for (const l of lessons) visit(l.id, []);
  return errors;
}

/** Key terms declared in a lesson's <KeyTerms> block (feeds the glossary and the consistency check). */
export function keyTermsOf(body: string): Array<{ term: string; definition: string }> {
  return [...body.matchAll(/\{\s*term:\s*"([^"]+)",\s*definition:\s*"([^"]+)"\s*\}/g)].map((m) => ({ term: m[1], definition: m[2] }));
}
