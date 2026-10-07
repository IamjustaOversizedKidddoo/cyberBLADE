import { answerCheck, startLab, submitObjective, tryCompleteLesson } from "@/lib/progress/service";
import { LAB, LESSONS, makeCtx, readFromWorld, RIGHT, WRONG } from "./fakes";

const [ALPHA, BETA] = LESSONS.map((l) => l.id);
const USER = "op-1";

async function solveLab(ctx: ReturnType<typeof makeCtx>["ctx"], user = USER) {
  const { attemptId, env } = await startLab(ctx, user, LAB.id);
  await submitObjective(ctx, user, attemptId, "o1", readFromWorld(env, "flag.txt"));
  return submitObjective(ctx, user, attemptId, "o2", readFromWorld(env, "word.txt"));
}

describe("terminal checks and lesson completion", () => {
  test("a lesson without a lab completes when every question is answered correctly", async () => {
    const { ctx } = makeCtx();
    const first = await answerCheck(ctx, USER, BETA, "q1", RIGHT(USER, BETA, "q1"));
    expect(first).toMatchObject({ correct: true, lessonCompleted: false });
    expect([...first.explanations].sort()).toEqual(["no", "yes"]);
    expect((await answerCheck(ctx, USER, BETA, "q2", WRONG(USER, BETA, "q2"))).correct).toBe(false);
    expect((await answerCheck(ctx, USER, BETA, "q2", RIGHT(USER, BETA, "q2"))).lessonCompleted).toBe(false);
    expect((await answerCheck(ctx, USER, BETA, "q3", RIGHT(USER, BETA, "q3"))).lessonCompleted).toBe(true);
    expect(await ctx.repo.getXpTotal(USER)).toBe(100);
    expect(await ctx.repo.getLessonProgress(USER, BETA)).toMatchObject({ status: "completed", completedAt: "2026-10-07T10:00:00.000Z" });
  });

  test("a wrong answer never counts, even after a right one elsewhere", async () => {
    const { ctx } = makeCtx();
    await answerCheck(ctx, USER, BETA, "q1", WRONG(USER, BETA, "q1"));
    expect((await ctx.repo.getLessonProgress(USER, BETA))?.checksPassed).toEqual([]);
  });

  test("a lesson with a lab needs the lab solved too, in either order", async () => {
    const { ctx } = makeCtx();
    for (const q of ["q1", "q2", "q3"]) await answerCheck(ctx, USER, ALPHA, q, RIGHT(USER, ALPHA, q));
    expect((await ctx.repo.getLessonProgress(USER, ALPHA))?.status).toBe("in_progress");
    await solveLab(ctx);
    expect((await ctx.repo.getLessonProgress(USER, ALPHA))?.status).toBe("completed");
    expect(await ctx.repo.getXpTotal(USER)).toBe(100 + 150);
  });

  test("XP is awarded once however many times completion is attempted", async () => {
    const { ctx } = makeCtx();
    for (const q of ["q1", "q2", "q3"]) await answerCheck(ctx, USER, BETA, q, RIGHT(USER, BETA, q));
    await tryCompleteLesson(ctx, USER, BETA);
    await tryCompleteLesson(ctx, USER, BETA);
    await answerCheck(ctx, USER, BETA, "q1", RIGHT(USER, BETA, "q1"));
    expect(await ctx.repo.getXpTotal(USER)).toBe(100);
  });

  test("unknown lesson or question is rejected", async () => {
    const { ctx } = makeCtx();
    await expect(answerCheck(ctx, USER, "nope", "q1", 0)).rejects.toThrow(/not found/);
    await expect(answerCheck(ctx, USER, BETA, "q9", RIGHT(USER, BETA, "q9"))).rejects.toThrow();
  });
});

describe("labs", () => {
  test("startLab twice reuses the attempt and world; never leaks seed or answers", async () => {
    const { ctx } = makeCtx();
    const first = await startLab(ctx, USER, LAB.id);
    const second = await startLab(ctx, USER, LAB.id);
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.env).toEqual(first.env);
    const json = JSON.stringify(first);
    expect(json).not.toMatch(/"seed"|"answers"/);
    expect(first.objectives).toEqual([
      { id: "o1", prompt: "flag?", solved: false },
      { id: "o2", prompt: "word?", solved: false },
    ]);
  });

  test("different learners get different worlds", async () => {
    const { ctx } = makeCtx();
    const a = await startLab(ctx, "op-1", LAB.id);
    const b = await startLab(ctx, "op-2", LAB.id);
    expect(readFromWorld(a.env, "flag.txt")).not.toBe(readFromWorld(b.env, "flag.txt"));
  });

  test("solved objectives survive a refresh", async () => {
    const { ctx } = makeCtx();
    const { attemptId, env } = await startLab(ctx, USER, LAB.id);
    await submitObjective(ctx, USER, attemptId, "o1", ` ${readFromWorld(env, "flag.txt")}\n`);
    const again = await startLab(ctx, USER, LAB.id);
    expect(again.objectives.map((o) => o.solved)).toEqual([true, false]);
  });

  test("wrong answers change nothing", async () => {
    const { ctx } = makeCtx();
    const { attemptId } = await startLab(ctx, USER, LAB.id);
    expect(await submitObjective(ctx, USER, attemptId, "o1", "NEON{000000000000}")).toEqual({
      correct: false,
      labCompleted: false,
      solved: [],
    });
  });

  test("solving every objective completes the lab once and awards XP once", async () => {
    const { ctx } = makeCtx();
    expect(await solveLab(ctx)).toEqual({ correct: true, labCompleted: true, solved: ["o1", "o2"] });
    const { attemptId, env } = await startLab(ctx, USER, LAB.id);
    await submitObjective(ctx, USER, attemptId, "o2", readFromWorld(env, "word.txt"));
    expect(await ctx.repo.getXpTotal(USER)).toBe(150);
  });

  test("concurrent submissions for different objectives keep both", async () => {
    const { ctx } = makeCtx();
    const { attemptId, env } = await startLab(ctx, USER, LAB.id);
    await Promise.all([
      submitObjective(ctx, USER, attemptId, "o1", readFromWorld(env, "flag.txt")),
      submitObjective(ctx, USER, attemptId, "o2", readFromWorld(env, "word.txt")),
    ]);
    expect((await ctx.repo.getAttempt(attemptId))?.objectivesSolved.sort()).toEqual(["o1", "o2"]);
    expect(await ctx.repo.getXpTotal(USER)).toBe(150);
  });

  test("another learner's attempt id is not found", async () => {
    const { ctx } = makeCtx();
    const { attemptId } = await startLab(ctx, "op-1", LAB.id);
    await expect(submitObjective(ctx, "op-2", attemptId, "o1", "x")).rejects.toThrow("not found");
    await expect(submitObjective(ctx, "op-1", "made-up", "o1", "x")).rejects.toThrow("not found");
  });
});

test("opening a lab in two tabs at once creates one attempt (same world in both)", async () => {
  const { ctx } = makeCtx();
  const [a, b] = await Promise.all([startLab(ctx, USER, LAB.id), startLab(ctx, USER, LAB.id)]);
  expect(b.attemptId).toBe(a.attemptId);
  expect(b.env).toEqual(a.env);
});
