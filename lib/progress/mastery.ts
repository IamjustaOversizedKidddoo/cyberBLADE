import type { Lesson } from "@/lib/content/schema";
import type { LessonProgress, ReviewItemRecord } from "./types";

export type MasteryLevel = "solid" | "developing" | "needs_review";

export type LessonMastery = {
  lessonId: string;
  title: string;
  rank: number;
  level: MasteryLevel;
  reason: string;
};

export type MasteryOverview = {
  solidCount: number;
  developingCount: number;
  needsReviewCount: number;
  totalCount: number;
  lessons: LessonMastery[];
};

export function computeMasteryOverview(
  lessons: Lesson[],
  progress: LessonProgress[],
  reviewItems: ReviewItemRecord[],
): MasteryOverview {
  const reviewMap = new Map<string, ReviewItemRecord>();
  for (const item of reviewItems) {
    reviewMap.set(item.lessonId, item);
  }

  const progressMap = new Map<string, LessonProgress>();
  for (const p of progress) {
    progressMap.set(p.lessonId, p);
  }

  const results: LessonMastery[] = [];

  for (const lesson of lessons) {
    const prog = progressMap.get(lesson.id);
    const rev = reviewMap.get(lesson.id);

    let level: MasteryLevel = "developing";
    let reason = "Not started or in progress";

    if (!prog) {
      level = "developing";
      reason = "Curriculum mission not yet initiated";
    } else if (rev && (rev.lapses > 0 || new Date(rev.dueAt).getTime() <= Date.now())) {
      level = "needs_review";
      reason = rev.lapses > 0 ? "Recent lapses recorded during spaced retrieval" : "Scheduled retrieval target is overdue";
    } else if (prog.status === "completed" && (!rev || rev.repetitions >= 2)) {
      level = "solid";
      reason = "Mission completed with verified retrieval recall";
    } else if (prog.status === "completed") {
      level = "developing";
      reason = "Mission completed; reinforce through spaced review";
    } else {
      level = "developing";
      reason = "Mission currently in progress";
    }

    results.push({
      lessonId: lesson.id,
      title: lesson.title,
      rank: lesson.rank,
      level,
      reason,
    });
  }

  return {
    solidCount: results.filter((r) => r.level === "solid").length,
    developingCount: results.filter((r) => r.level === "developing").length,
    needsReviewCount: results.filter((r) => r.level === "needs_review").length,
    totalCount: results.length,
    lessons: results,
  };
}
