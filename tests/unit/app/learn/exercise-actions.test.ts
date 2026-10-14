import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const operator = { id: "u-exercise", rank: 1 };
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => operator }));

import { checkLessonExerciseAction } from "@/app/(app)/learn/exercise-actions";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

const LESSON = "soc-l1-email-headers-01";

describe("checkLessonExerciseAction", () => {
  beforeEach(() => {
    process.env.NEON_SHOW_DRAFTS = "true";
    operator.rank = 1;
    operator.id = `u-${Math.random()}`;
    resetSubmissionRateLimits();
  });

  it("accepts a defanged correct answer and reveals the explanation", async () => {
    const r = await checkLessonExerciseAction(LESSON, "header-check", "delivering-ip", "192.0.2[.]58");
    expect(r.correct).toBe(true);
    expect(r.explanation).toContain("192.0.2.58");
  });

  it("rejects a wrong answer without leaking the explanation or the key", async () => {
    const r = await checkLessonExerciseAction(LESSON, "header-check", "delivering-ip", "172.16.40.25");
    expect(r).toEqual({ correct: false, explanation: null });
  });

  it("refuses learners below the track's rank", async () => {
    operator.rank = 0;
    await expect(checkLessonExerciseAction(LESSON, "header-check", "delivering-ip", "x")).rejects.toThrow("not available");
  });

  it("refuses unknown exercises and malformed ids", async () => {
    await expect(checkLessonExerciseAction(LESSON, "nope", "delivering-ip", "x")).rejects.toThrow("not available");
    await expect(checkLessonExerciseAction("../etc", "header-check", "delivering-ip", "x")).rejects.toThrow();
    await expect(checkLessonExerciseAction(LESSON, "header-check", "delivering-ip", "x".repeat(501))).rejects.toThrow();
  });

  it("hides draft lessons when drafts are off", async () => {
    process.env.NEON_SHOW_DRAFTS = "false";
    await expect(checkLessonExerciseAction(LESSON, "header-check", "delivering-ip", "x")).rejects.toThrow("not available");
  });

  it("rate-limits rapid guessing", async () => {
    for (let i = 0; i < 30; i++) await checkLessonExerciseAction(LESSON, "header-check", "spf-result", "pass");
    await expect(checkLessonExerciseAction(LESSON, "header-check", "spf-result", "pass")).rejects.toThrow("Rate limit");
  });
});
