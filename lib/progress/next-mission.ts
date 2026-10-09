import type { Lesson } from "@/lib/content/schema";
import type { LessonProgress } from "./types";

export type NextMission =
  | { kind: "lesson"; lesson: Pick<Lesson, "id" | "title" | "order" | "estimated_minutes" | "xp">; resume: boolean }
  | { kind: "challenge"; rank: number }
  | { kind: "none" };

/**
 * Returns the operator's next recommended action for the given rank:
 * - The first lesson not yet completed (in `order` order), flagged `resume: true` if it is in_progress.
 * - The rank challenge if all lessons are completed.
 * - `none` if there are no published lessons and no challenge.
 */
export function nextMission(
  rank: number,
  lessons: Pick<Lesson, "id" | "title" | "order" | "estimated_minutes" | "xp">[],
  progress: LessonProgress[],
): NextMission {
  if (lessons.length === 0) return { kind: "none" };

  const sorted = [...lessons].sort((a, b) => a.order - b.order);

  for (const lesson of sorted) {
    const record = progress.find((p) => p.lessonId === lesson.id);
    if (!record || record.status !== "completed") {
      return { kind: "lesson", lesson, resume: record?.status === "in_progress" };
    }
  }

  // All lessons done — point to the challenge
  return { kind: "challenge", rank };
}
