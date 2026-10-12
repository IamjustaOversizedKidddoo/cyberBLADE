import { describe, expect, it } from "vitest";
import { getNextBestAction } from "@/lib/progress/next-action";

describe("NextBestAction Engine", () => {
  const sampleLessons = [
    { id: "les-1", title: "Lesson One", order: 1, estimated_minutes: 10, xp: 50 },
    { id: "les-2", title: "Lesson Two", order: 2, estimated_minutes: 15, xp: 50 },
    { id: "les-3", title: "Lesson Three", order: 3, estimated_minutes: 20, xp: 100 },
  ];

  it("prioritizes spaced review when cards are overdue", () => {
    const action = getNextBestAction({
      dueReviewCount: 4,
      failedLab: { id: "lab-1", title: "Terminal Triage" },
      rankLessons: sampleLessons,
      progress: [],
      operatorRank: 0,
    });

    expect(action.type).toBe("review");
    expect(action.href).toBe("/review");
    expect(action.reason).toContain("4 target concepts due");
  });

  it("prioritizes failed lab retry when no reviews are overdue", () => {
    const action = getNextBestAction({
      dueReviewCount: 0,
      failedLab: { id: "lab-1", title: "Terminal Triage", estimatedMinutes: 15 },
      rankLessons: sampleLessons,
      progress: [],
      operatorRank: 0,
    });

    expect(action.type).toBe("retry_lab");
    expect(action.href).toBe("/labs/lab-1");
    expect(action.badge).toBe("HANDS-ON RETRY");
  });

  it("points to resume an in-progress lesson", () => {
    const action = getNextBestAction({
      dueReviewCount: 0,
      rankLessons: sampleLessons,
      progress: [
        { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
        { userId: "u1", lessonId: "les-2", status: "in_progress", checksPassed: [], completedAt: null },
      ],
      operatorRank: 0,
    });

    expect(action.type).toBe("resume_lesson");
    expect(action.href).toBe("/learn/les-2");
    expect(action.badge).toBe("RESUME MISSION");
  });

  it("points to the next unstarted lesson in sequence", () => {
    const action = getNextBestAction({
      dueReviewCount: 0,
      rankLessons: sampleLessons,
      progress: [
        { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
      ],
      operatorRank: 0,
    });

    expect(action.type).toBe("start_lesson");
    expect(action.href).toBe("/learn/les-2");
    expect(action.badge).toBe("NEXT MISSION");
  });

  it("points to rank challenge certification when all lessons are completed", () => {
    const action = getNextBestAction({
      dueReviewCount: 0,
      rankLessons: sampleLessons,
      progress: [
        { userId: "u1", lessonId: "les-1", status: "completed", checksPassed: [], completedAt: "now" },
        { userId: "u1", lessonId: "les-2", status: "completed", checksPassed: [], completedAt: "now" },
        { userId: "u1", lessonId: "les-3", status: "completed", checksPassed: [], completedAt: "now" },
      ],
      operatorRank: 0,
      challengeReady: true,
    });

    expect(action.type).toBe("rank_challenge");
    expect(action.href).toBe("/challenge/0");
    expect(action.badge).toBe("RANK CERTIFICATION");
  });
});
