import {
  abandonChallenge,
  challengeState,
  getChallengeSession,
  getRankSummary,
  startChallenge,
  submitChallengeObjective,
} from "@/lib/progress/challenge";
import { answerCheck, startLab, submitObjective } from "@/lib/progress/service";
import { LAB, LESSONS, makeCtx, readFromWorld, RIGHT } from "./fakes";

const USER = "op-1";
const T0 = new Date("2026-10-07T10:00:00Z");
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

describe("challengeState (pure)", () => {
  const base = { allLessonsDone: true, passed: false, cooldownMinutes: 30, now: T0 };

  test("locked until every lesson is done", () => {
    expect(challengeState({ ...base, allLessonsDone: false })).toEqual({ kind: "locked" });
  });

  test("ready when lessons are done", () => {
    expect(challengeState(base)).toEqual({ kind: "ready" });
  });

  test("active while the clock runs", () => {
    expect(challengeState({ ...base, active: { attemptId: "a", expiresAt: minutes(T0, 10) } })).toEqual({
      kind: "active",
      attemptId: "a",
      expiresAt: minutes(T0, 10).toISOString(),
    });
  });

  test("an active attempt past its time is a cooldown counted from expiry", () => {
    expect(challengeState({ ...base, active: { attemptId: "a", expiresAt: minutes(T0, -5) } })).toEqual({
      kind: "cooldown",
      retryAt: minutes(T0, 25).toISOString(),
    });
  });

  test("cooldown after a failure, then ready again", () => {
    expect(challengeState({ ...base, lastFailedAt: minutes(T0, -10) })).toEqual({
      kind: "cooldown",
      retryAt: minutes(T0, 20).toISOString(),
    });
    expect(challengeState({ ...base, lastFailedAt: minutes(T0, -30) })).toEqual({ kind: "ready" });
  });

  test("passed wins over everything", () => {
    expect(
      challengeState({ ...base, passed: true, allLessonsDone: false, lastFailedAt: T0, active: { attemptId: "a", expiresAt: T0 } }),
    ).toEqual({ kind: "passed" });
  });
});

async function completeLessons(ctx: ReturnType<typeof makeCtx>["ctx"]) {
  for (const lesson of LESSONS) for (const q of ["q1", "q2", "q3"]) await answerCheck(ctx, USER, lesson.id, q, RIGHT(USER, lesson.id, q));
  const { attemptId, env } = await startLab(ctx, USER, LAB.id);
  await submitObjective(ctx, USER, attemptId, "o1", readFromWorld(env, "flag.txt"));
  await submitObjective(ctx, USER, attemptId, "o2", readFromWorld(env, "word.txt"));
}

describe("rank challenge service", () => {
  test("summary lists lessons and is locked until they are done", async () => {
    const { ctx } = makeCtx(T0);
    const summary = await getRankSummary(ctx, USER, 0);
    expect(summary.lessons.map((l) => l.status)).toEqual(["not_started", "not_started"]);
    expect(summary.allLessonsDone).toBe(false);
    expect(summary.challenge).toEqual({ kind: "locked" });
    await expect(startChallenge(ctx, USER, 0)).rejects.toThrow(/locked/);
  });

  test("full solve in time promotes to Rank 1 and awards XP once", async () => {
    const { ctx, operators } = makeCtx(T0);
    await operators.create({ handle: "ghost", ethicsAcceptedAt: T0.toISOString() });
    await completeLessons(ctx);
    expect((await getRankSummary(ctx, USER, 0)).challenge).toEqual({ kind: "ready" });

    const started = await startChallenge(ctx, USER, 0);
    expect(started.expiresAt).toBe(minutes(T0, 45).toISOString());
    expect(JSON.stringify(started)).not.toMatch(/"seed"|"answers"/);

    const flag = readFromWorld(started.env, "flag.txt");
    const word = readFromWorld(started.env, "word.txt");
    expect(await submitChallengeObjective(ctx, USER, started.attemptId, "o1", flag)).toEqual({ correct: true, passed: false });
    expect(await submitChallengeObjective(ctx, USER, started.attemptId, "o2", word)).toEqual({ correct: true, passed: true });

    expect((await operators.get(USER))?.rank).toBe(1);
    expect((await getRankSummary(ctx, USER, 0)).challenge).toEqual({ kind: "passed" });
    const xp = await ctx.repo.getXpTotal(USER);
    await submitChallengeObjective(ctx, USER, started.attemptId, "o2", word);
    expect(await ctx.repo.getXpTotal(USER)).toBe(xp);
    expect(xp).toBe(100 + 100 + 150 + 300);
  });

  test("passing Rank 1 challenge promotes operator to Rank 2 (Watcher)", async () => {
    const { ctx, operators } = makeCtx(T0);
    const op = await operators.create({ handle: "ghost", ethicsAcceptedAt: T0.toISOString() });
    await operators.setRank(op.id, 1);

    for (const q of ["q1", "q2", "q3"]) await answerCheck(ctx, USER, "core-r1-test-alpha-01", q, RIGHT(USER, "core-r1-test-alpha-01", q));

    const started = await startChallenge(ctx, USER, 1);
    expect(started.expiresAt).toBe(minutes(T0, 30).toISOString());

    const flag = readFromWorld(started.env, "flag.txt");
    const word = readFromWorld(started.env, "word.txt");
    await submitChallengeObjective(ctx, USER, started.attemptId, "o1", flag);
    const finalSub = await submitChallengeObjective(ctx, USER, started.attemptId, "o2", word);

    expect(finalSub).toEqual({ correct: true, passed: true });
    expect((await operators.get(USER))?.rank).toBe(2);
    expect((await getRankSummary(ctx, USER, 1)).challenge).toEqual({ kind: "passed" });
  });

  test("answers after the time limit are rejected server-side and start the cooldown", async () => {
    const { ctx, operators, clock } = makeCtx(T0);
    await operators.create({ handle: "ghost", ethicsAcceptedAt: T0.toISOString() });
    await completeLessons(ctx);
    const started = await startChallenge(ctx, USER, 0);

    clock.now = minutes(T0, 46);
    const flag = readFromWorld(started.env, "flag.txt");
    expect(await submitChallengeObjective(ctx, USER, started.attemptId, "o1", flag)).toEqual({
      correct: false,
      expired: true,
    });
    expect((await operators.get(USER))?.rank).toBe(0);
    expect((await getRankSummary(ctx, USER, 0)).challenge).toEqual({
      kind: "cooldown",
      retryAt: minutes(T0, 45 + 30).toISOString(),
    });
    await expect(startChallenge(ctx, USER, 0)).rejects.toThrow(/cooldown/);
  });

  test("a retry after the cooldown gets a different world", async () => {
    const { ctx, clock } = makeCtx(T0);
    await completeLessons(ctx);
    const first = await startChallenge(ctx, USER, 0);
    await abandonChallenge(ctx, USER, first.attemptId);
    expect((await getRankSummary(ctx, USER, 0)).challenge.kind).toBe("cooldown");

    clock.now = minutes(T0, 31);
    const second = await startChallenge(ctx, USER, 0);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(readFromWorld(second.env, "flag.txt")).not.toBe(readFromWorld(first.env, "flag.txt"));
  });

  test("an expired-but-unsubmitted attempt is marked failed when the summary is read", async () => {
    const { ctx, clock } = makeCtx(T0);
    await completeLessons(ctx);
    const started = await startChallenge(ctx, USER, 0);
    clock.now = minutes(T0, 60);
    await getRankSummary(ctx, USER, 0);
    expect((await ctx.repo.getAttempt(started.attemptId))?.failedAt).toBe(minutes(T0, 45).toISOString());
    expect(await getChallengeSession(ctx, USER, 0)).toBeNull();
  });

  test("the active session can be reopened (refresh) with the same world", async () => {
    const { ctx } = makeCtx(T0);
    await completeLessons(ctx);
    const started = await startChallenge(ctx, USER, 0);
    const again = await getChallengeSession(ctx, USER, 0);
    expect(again?.attemptId).toBe(started.attemptId);
    expect(again?.env).toEqual(started.env);
  });

  test("starting twice while active is refused", async () => {
    const { ctx } = makeCtx(T0);
    await completeLessons(ctx);
    await startChallenge(ctx, USER, 0);
    await expect(startChallenge(ctx, USER, 0)).rejects.toThrow(/active/);
  });

  test("challenge attempts are not usable as practice attempts and vice versa", async () => {
    const { ctx } = makeCtx(T0);
    await completeLessons(ctx);
    const started = await startChallenge(ctx, USER, 0);
    await expect(submitObjective(ctx, USER, started.attemptId, "o1", "x")).rejects.toThrow("not found");
    const practice = await startLab(ctx, USER, LAB.id);
    await expect(submitChallengeObjective(ctx, USER, practice.attemptId, "o1", "x")).rejects.toThrow("not found");
    await expect(submitChallengeObjective(ctx, "op-2", started.attemptId, "o1", "x")).rejects.toThrow("not found");
  });
});

describe("concurrency", () => {
  test("two simultaneous starts create exactly one attempt (no cooldown bypass)", async () => {
    const { ctx } = makeCtx(T0);
    await completeLessons(ctx);
    const results = await Promise.allSettled([startChallenge(ctx, USER, 0), startChallenge(ctx, USER, 0), startChallenge(ctx, USER, 0)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const first = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ attemptId: string }>;
    await abandonChallenge(ctx, USER, first.value.attemptId);
    expect((await getRankSummary(ctx, USER, 0)).challenge.kind).toBe("cooldown");
  });
});
