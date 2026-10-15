/**
 * Study plan: links each weak skill from recent exams to the lessons that teach it, the learner's
 * due review cards for those lessons, practice targets (scenarios, shifts, tools; query drills only
 * when searching is switched on) and the timed mini-queue drill. Pure apart from content reads.
 */
import fs from "node:fs";
import { parse as parseYaml } from "yaml";
import { resolvePracticeTarget, type PracticeCard } from "@/lib/content/practice";
import { loadSocCoverage } from "@/lib/content/soc-track";
import type { SocExamAttemptRecord } from "./types";

export type StudyPlanEntry = {
  skill: string;
  title: string;
  percent: number;
  lessons: Array<{ id: string; title: string; href: string }>;
  reviewDue: number;
  practice: PracticeCard[];
};

export type StudyPlan = {
  basedOnExams: number;
  entries: StudyPlanEntry[];
  miniQueueHref: string;
  reviewHref: string;
};

let skillTitles: Map<string, string> | null = null;
export function socSkillTitle(id: string): string {
  if (!skillTitles) {
    const doc = parseYaml(fs.readFileSync("content/soc/skills.yaml", "utf8")) as { skills: Array<{ id: string; title: string }> };
    skillTitles = new Map(doc.skills.map((s) => [s.id, s.title]));
  }
  return skillTitles.get(id) ?? id.replace(/^soc_/, "").replace(/_/g, " ");
}

/** Average per-skill percent over the given submitted exams (each exam weighted equally). */
export function skillAverages(exams: SocExamAttemptRecord[]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const e of exams) for (const s of e.result?.perSkill ?? []) {
    if (s.possible <= 0) continue;
    const a = sums.get(s.skill) ?? { total: 0, n: 0 };
    a.total += s.percent;
    a.n += 1;
    sums.set(s.skill, a);
  }
  return new Map([...sums].map(([k, v]) => [k, Math.round(v.total / v.n)]));
}

export function buildStudyPlan(input: {
  exams: SocExamAttemptRecord[];
  threshold: number;
  lessonTitle: (id: string) => string | null;
  dueReviewByLesson: Map<string, number>;
  drillsEnabled: boolean;
  maxEntries?: number;
}): StudyPlan {
  const coverage = loadSocCoverage();
  const averages = skillAverages(input.exams);
  const weak = [...averages].filter(([, p]) => p < input.threshold).sort((a, b) => a[1] - b[1]).slice(0, input.maxEntries ?? 5);
  const entries = weak.map(([skill, percent]) => {
    const cov = coverage.skills.find((s) => s.id === skill);
    const lessons = (cov?.lessons ?? []).flatMap((id) => {
      const title = input.lessonTitle(id);
      return title ? [{ id, title, href: `/learn/${id}` }] : [];
    });
    const practice = (cov?.practice ?? [])
      .filter((t) => input.drillsEnabled || !t.startsWith("drill:"))
      .map((t) => resolvePracticeTarget(t, input.lessonTitle))
      .filter((c): c is PracticeCard => typeof c !== "string");
    const reviewDue = lessons.reduce((a, l) => a + (input.dueReviewByLesson.get(l.id) ?? 0), 0);
    return { skill, title: socSkillTitle(skill), percent, lessons, reviewDue, practice };
  });
  return { basedOnExams: input.exams.length, entries, miniQueueHref: "/labs/soc/exams#mini-queue", reviewHref: "/review" };
}

/** Score history per format, oldest first, for the trend view. */
export function examTrend(exams: SocExamAttemptRecord[]) {
  const out: Record<string, Array<{ examId: string; submittedAt: string; scorePercent: number; variantId: string }>> = {};
  for (const e of [...exams].filter((x) => x.status === "submitted" && x.result && x.submittedAt).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))) {
    (out[e.format] ??= []).push({ examId: e.id, submittedAt: e.submittedAt!, scorePercent: e.result!.scorePercent, variantId: e.variantId });
  }
  return out;
}
