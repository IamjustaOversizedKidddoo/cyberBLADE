import { describe, expect, it } from "vitest";
import {
  computeMasteryOverview,
  type MasteryLevel,
} from "@/lib/progress/mastery";
import type { Lesson } from "@/lib/content/schema";
import type { LessonProgress, ReviewItemRecord } from "@/lib/progress/types";

// Minimal mock lessons for deterministic tests
const mockLessons: Lesson[] = [
  {
    id: "les-1",
    title: "Linux Fundamentals",
    track: "core",
    rank: 0,
    module: "linux",
    order: 1,
    estimated_minutes: 15,
    objectives_covered: [],
    mitre: [],
    xp: 100,
    status: "draft",
    last_reviewed: null,
    slug: "les-1",
    filePath: "les-1.mdx",
    body: "",
  },
  {
    id: "les-2",
    title: "Network Basics",
    track: "core",
    rank: 1,
    module: "networking",
    order: 2,
    estimated_minutes: 20,
    objectives_covered: [],
    mitre: [],
    xp: 100,
    status: "draft",
    last_reviewed: null,
    slug: "les-2",
    filePath: "les-2.mdx",
    body: "",
  },
  {
    id: "les-3",
    title: "Web Security",
    track: "core",
    rank: 2,
    module: "web",
    order: 3,
    estimated_minutes: 25,
    objectives_covered: [],
    mitre: [],
    xp: 100,
    status: "draft",
    last_reviewed: null,
    slug: "les-3",
    filePath: "les-3.mdx",
    body: "",
  },
];

describe("Mastery Overview Computation", () => {
  it("marks all lessons as developing when nothing has been started", () => {
    const overview = computeMasteryOverview(mockLessons, [], []);
    expect(overview.totalCount).toBe(3);
    expect(overview.developingCount).toBe(3);
    expect(overview.solidCount).toBe(0);
    expect(overview.needsReviewCount).toBe(0);

    for (const lesson of overview.lessons) {
      expect(lesson.level).toBe("developing");
    }
  });

  it("marks lesson as solid when completed + review repetitions >= 2", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
    ];
    const reviews: ReviewItemRecord[] = [
      {
        id: "ri-1",
        userId: "u1",
        cardId: "fc-1",
        lessonId: "les-1",
        easeFactor: 2.5,
        intervalDays: 15,
        repetitions: 3,
        lapses: 0,
        dueAt: "2026-11-01T12:00:00Z", // Not overdue
        lastReviewedAt: "2026-10-12T12:00:00Z",
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-12T12:00:00Z",
      },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, reviews);
    const les1 = overview.lessons.find((l) => l.lessonId === "les-1")!;
    expect(les1.level).toBe("solid");
    expect(overview.solidCount).toBe(1);
  });

  it("marks lesson as needs_review when review has lapses", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-2", status: "completed", checksPassed: [], completedAt: "now" },
    ];
    const reviews: ReviewItemRecord[] = [
      {
        id: "ri-2",
        userId: "u1",
        cardId: "fc-2",
        lessonId: "les-2",
        easeFactor: 2.0,
        intervalDays: 1,
        repetitions: 0,
        lapses: 2,
        dueAt: "2026-11-01T12:00:00Z",
        lastReviewedAt: "2026-10-12T12:00:00Z",
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-12T12:00:00Z",
      },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, reviews);
    const les2 = overview.lessons.find((l) => l.lessonId === "les-2")!;
    expect(les2.level).toBe("needs_review");
    expect(overview.needsReviewCount).toBe(1);
  });

  it("marks lesson as needs_review when review item is overdue", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
    ];
    const reviews: ReviewItemRecord[] = [
      {
        id: "ri-3",
        userId: "u1",
        cardId: "fc-3",
        lessonId: "les-1",
        easeFactor: 2.5,
        intervalDays: 6,
        repetitions: 2,
        lapses: 0,
        dueAt: "2020-01-01T12:00:00Z", // Way in the past → overdue
        lastReviewedAt: "2019-12-25T12:00:00Z",
        createdAt: "2019-12-01T12:00:00Z",
        updatedAt: "2019-12-25T12:00:00Z",
      },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, reviews);
    const les1 = overview.lessons.find((l) => l.lessonId === "les-1")!;
    expect(les1.level).toBe("needs_review");
  });

  it("marks completed-but-unreviewed lesson as solid (all checks passed)", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-3", status: "completed", checksPassed: [], completedAt: "now" },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, []);
    const les3 = overview.lessons.find((l) => l.lessonId === "les-3")!;
    // Completed + no review record → treated as solid (learner passed all in-lesson checks)
    expect(les3.level).toBe("solid");
    expect(les3.reason).toContain("verified");
  });

  it("marks in-progress lesson as developing", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-1", status: "in_progress", checksPassed: [], completedAt: null },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, []);
    const les1 = overview.lessons.find((l) => l.lessonId === "les-1")!;
    expect(les1.level).toBe("developing");
    expect(les1.reason).toContain("in progress");
  });

  it("counts aggregated overview correctly for mixed states", () => {
    const progress: LessonProgress[] = [
      { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
      { userId: "u1", lessonId: "les-2", status: "completed", checksPassed: [], completedAt: "now" },
      // les-3 not started
    ];
    const reviews: ReviewItemRecord[] = [
      {
        id: "ri-1",
        userId: "u1",
        cardId: "fc-1",
        lessonId: "les-1",
        easeFactor: 2.6,
        intervalDays: 15,
        repetitions: 3,
        lapses: 0,
        dueAt: "2026-11-01T12:00:00Z",
        lastReviewedAt: "2026-10-12T12:00:00Z",
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-12T12:00:00Z",
      },
      {
        id: "ri-2",
        userId: "u1",
        cardId: "fc-2",
        lessonId: "les-2",
        easeFactor: 1.8,
        intervalDays: 1,
        repetitions: 0,
        lapses: 3,
        dueAt: "2026-11-01T12:00:00Z",
        lastReviewedAt: "2026-10-12T12:00:00Z",
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-12T12:00:00Z",
      },
    ];

    const overview = computeMasteryOverview(mockLessons, progress, reviews);
    expect(overview.solidCount).toBe(1);       // les-1 completed + reviewed >=2 reps
    expect(overview.needsReviewCount).toBe(1);  // les-2 has lapses
    expect(overview.developingCount).toBe(1);   // les-3 not started
    expect(overview.totalCount).toBe(3);
  });
});
