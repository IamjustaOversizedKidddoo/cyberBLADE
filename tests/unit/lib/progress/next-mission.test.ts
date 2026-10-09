import { nextMission } from "@/lib/progress/next-mission";
import type { LessonProgress } from "@/lib/progress/types";

const lesson = (order: number) => ({ id: `core-r0-x-${order}`, title: `Lesson ${order}`, order, estimated_minutes: 20 + order, xp: 100 });
const lessons = [lesson(3), lesson(1), lesson(2)];
const p = (id: string, status: LessonProgress["status"]): LessonProgress => ({ userId: "u", lessonId: id, status, checksPassed: [], completedAt: null });

test("a brand-new operator is sent to the first lesson by order, not by array position", () => {
  expect(nextMission(0, lessons, [])).toEqual({ kind: "lesson", lesson: lesson(1), resume: false });
});

test("the next mission is the first lesson not yet completed, and says when it's a resume", () => {
  const progress = [p("core-r0-x-1", "completed"), p("core-r0-x-2", "in_progress")];
  expect(nextMission(0, lessons, progress)).toEqual({ kind: "lesson", lesson: lesson(2), resume: true });
});

test("a skipped-ahead operator is still pointed at the earliest gap", () => {
  const progress = [p("core-r0-x-3", "completed")];
  expect(nextMission(0, lessons, progress)).toMatchObject({ kind: "lesson", lesson: { order: 1 } });
});

test("every lesson completed: the next mission is the rank challenge", () => {
  const progress = lessons.map((l) => p(l.id, "completed"));
  expect(nextMission(0, lessons, progress)).toEqual({ kind: "challenge", rank: 0 });
});

test("a rank with no published lessons yet has no next mission", () => {
  expect(nextMission(2, [], [])).toEqual({ kind: "none" });
});
