import "server-only";
/**
 * Learner-facing exam insights: trend, provisional readiness and study plan, plus the optional,
 * consented outcome self-report. Self-reports are stored owner-only, treated as untrusted, and
 * never change any score, gate or result here; they are read only by the offline calibration
 * script.
 */
import { z } from "zod";
import type { Ctx } from "@/lib/progress/service";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { isSocQueryEnabled } from "@/lib/config/env";
import { loadExamConfig, loadReadinessConfig } from "./config";
import { evaluateReadiness, type ReadinessResult } from "./readiness";
import { buildStudyPlan, examTrend, socSkillTitle, type StudyPlan } from "./study-plan";
import { getActiveExam } from "./service";

export type ExamInsightsView = {
  trend: ReturnType<typeof examTrend>;
  readiness: ReadinessResult & { lowestSkillTitle: string | null };
  studyPlan: StudyPlan;
  outcomeReportsCount: number;
};

export async function getExamInsights(ctx: Ctx, userId: string): Promise<ExamInsightsView> {
  await getActiveExam(ctx, userId); // finalises an expired exam first
  const config = loadExamConfig();
  const cfg = loadReadinessConfig();
  const exams = await ctx.repo.listSocExamAttempts(userId);
  const readiness = evaluateReadiness(exams, (f) => config.formats[f as keyof typeof config.formats]?.countsForReadiness ?? false, cfg);
  const recent = exams.filter((e) => readiness.examIds.includes(e.id));
  // The study plan also uses mini-queue drills, which do not count for readiness.
  const planExams = recent.length ? recent : exams.filter((e) => e.status === "submitted").slice(0, cfg.windowAttempts);

  const lessons = await ctx.content.getLessons();
  const titles = new Map(lessons.map((l) => [l.id, l.title]));
  const now = ctx.now().toISOString();
  const due = new Map<string, number>();
  for (const r of await ctx.repo.listReviewItems(userId)) if (r.dueAt <= now) due.set(r.lessonId, (due.get(r.lessonId) ?? 0) + 1);

  const lowest = readiness.criteria.find((c) => c.id === "skill_floor")?.detail.match(/Lowest skill: (\S+)/)?.[1] ?? null;
  return {
    trend: examTrend(exams),
    readiness: { ...readiness, lowestSkillTitle: lowest ? socSkillTitle(lowest) : null },
    studyPlan: buildStudyPlan({ exams: planExams, threshold: cfg.ready.skillFloor, lessonTitle: (id) => titles.get(id) ?? null, dueReviewByLesson: due, drillsEnabled: isSocQueryEnabled() }),
    outcomeReportsCount: (await ctx.repo.listSocExamOutcomeReports(userId)).length,
  };
}

export const OUTCOME_CONSENT_VERSION = "exam-outcome-v1";
/** Generic families only: the platform never names or claims equivalence with a specific exam. */
export const OUTCOME_CERT_FAMILIES = ["practical-soc-analyst", "security-fundamentals", "soc-analyst-knowledge", "other"] as const;
const MAX_OUTCOME_REPORTS = 20;

export const outcomeInputSchema = z.object({
  certFamily: z.enum(OUTCOME_CERT_FAMILIES),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passed: z.boolean(),
  consent: z.literal(true),
});

export async function submitExamOutcomeReport(ctx: Ctx, userId: string, raw: unknown): Promise<{ saved: true }> {
  const input = outcomeInputSchema.parse(raw);
  const date = Date.parse(`${input.examDate}T00:00:00Z`);
  const now = ctx.now().getTime();
  if (!Number.isFinite(date) || date > now || date < Date.parse("2020-01-01T00:00:00Z")) throw new Error("Enter the date you took the exam (not in the future).");
  if (!checkRateLimit(`soc_exam_outcome:${userId}`, 5, 3_600_000).allowed) throw new Error("Too many reports. Please try again later.");
  if ((await ctx.repo.listSocExamOutcomeReports(userId)).length >= MAX_OUTCOME_REPORTS) throw new Error("You have reached the limit of outcome reports.");
  await ctx.repo.saveSocExamOutcomeReport({ userId, certFamily: input.certFamily, examDate: input.examDate, passed: input.passed, consentVersion: OUTCOME_CONSENT_VERSION });
  return { saved: true };
}
