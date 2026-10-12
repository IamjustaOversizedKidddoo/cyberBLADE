import type { Lesson } from "@/lib/content/schema";
import type { LessonProgress } from "./types";

export type NextActionType =
  | "review"
  | "retry_lab"
  | "resume_lesson"
  | "start_lesson"
  | "rank_challenge"
  | "all_complete";

export type NextBestAction = {
  type: NextActionType;
  href: string;
  title: string;
  reason: string;
  badge: string;
  estimatedMinutes: number;
};

export type FailedLabSummary = {
  id: string;
  title: string;
  estimatedMinutes?: number;
};

export function getNextBestAction(params: {
  dueReviewCount: number;
  failedLab?: FailedLabSummary | null;
  rankLessons: Pick<Lesson, "id" | "title" | "order" | "estimated_minutes" | "xp">[];
  progress: LessonProgress[];
  operatorRank: number;
  challengeReady?: boolean;
}): NextBestAction {
  const {
    dueReviewCount,
    failedLab,
    rankLessons,
    progress,
    operatorRank,
    challengeReady,
  } = params;

  // 1. Spaced Repetition Priority (prevent memory decay)
  if (dueReviewCount > 0) {
    return {
      type: "review",
      href: "/review",
      title: "Daily Spaced Retrieval Drill",
      reason: `${dueReviewCount} target concept${dueReviewCount === 1 ? "" : "s"} due for review to prevent memory decay.`,
      badge: "SPACED REVIEW",
      estimatedMinutes: Math.min(10, Math.ceil(dueReviewCount * 1.5)),
    };
  }

  // 2. Retry uncompleted/failed lab
  if (failedLab) {
    return {
      type: "retry_lab",
      href: `/labs/${failedLab.id}`,
      title: `Retry Lab: ${failedLab.title}`,
      reason: "You have an uncompleted lab attempt. Reinforce these practical hands-on objectives.",
      badge: "HANDS-ON RETRY",
      estimatedMinutes: failedLab.estimatedMinutes ?? 15,
    };
  }

  // 3. Find next lesson in rank order
  const sortedLessons = [...rankLessons].sort((a, b) => a.order - b.order);
  for (const lesson of sortedLessons) {
    const record = progress.find((p) => p.lessonId === lesson.id);
    if (!record || record.status !== "completed") {
      const isResume = record?.status === "in_progress";
      return {
        type: isResume ? "resume_lesson" : "start_lesson",
        href: `/learn/${lesson.id}`,
        title: isResume ? `Resume: ${lesson.title}` : `Next Mission: ${lesson.title}`,
        reason: isResume
          ? `Continue your in-progress mission in Rank ${operatorRank}.`
          : `Advance your curriculum along the core security path.`,
        badge: isResume ? "RESUME MISSION" : "NEXT MISSION",
        estimatedMinutes: lesson.estimated_minutes,
      };
    }
  }

  // 4. Rank Challenge Certification
  if (challengeReady) {
    return {
      type: "rank_challenge",
      href: `/challenge/${operatorRank}`,
      title: `Rank ${operatorRank} Certification Challenge`,
      reason: `All Rank ${operatorRank} lessons complete. Prove your operational competence under timed assessment.`,
      badge: "RANK CERTIFICATION",
      estimatedMinutes: 20,
    };
  }

  // 5. All completed
  return {
    type: "all_complete",
    href: "/learn/core",
    title: "All Core Missions Completed",
    reason: "You have mastered all available curriculum tiers. Maintain operational readiness with daily spaced review.",
    badge: "SYSTEMS OPERATIONAL",
    estimatedMinutes: 0,
  };
}
