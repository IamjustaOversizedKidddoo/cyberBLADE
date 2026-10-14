import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000 });

import { startSocSession, resolveScenarioForAttempt } from "@/lib/lab-engine/soc/engine";
import { generateScenarioQuestions } from "@/lib/lab-engine/soc/query/questions";
import { ANSWER_RESPONSE_FLOOR_MS, getQueryWorkspace, submitInvestigationAnswer } from "@/lib/lab-engine/soc/query/question-service";
import { executeInvestigationQuery } from "@/lib/lab-engine/soc/query/pipeline";
import { MAX_QUESTION_ATTEMPTS } from "@/lib/lab-engine/soc/query/question-model";
import { makeCtx } from "./ai-grading/pipeline-harness";

const USER = "u-analyst";
let ctx: ReturnType<typeof makeCtx>;
let attemptId: string;

async function truthsFor(id: string) {
  const attempt = (await ctx.repo.getSocAttempt(id))!;
  const scenario = await resolveScenarioForAttempt(attempt);
  return generateScenarioQuestions(scenario, attempt.seed, attempt.familyId ?? attempt.scenarioId).serverTruths;
}

const pause = () => new Promise((r) => setTimeout(r, 1600)); // per-question rate limit window

beforeEach(async () => {
  ctx = makeCtx({ t: new Date("2026-10-14T10:00:00Z") });
  attemptId = (await startSocSession(ctx, USER, "soc-f-phishing-cred-01")).attempt.id;
});

describe("S7: investigation answers are checked on the server only", () => {
  it("the workspace view carries stems, types and counts, never answers, seeds or datasets", async () => {
    const ws = await getQueryWorkspace(ctx, USER, attemptId);
    const attempt = (await ctx.repo.getSocAttempt(attemptId))!;
    const json = JSON.stringify(ws);
    expect(ws.questions.length).toBeGreaterThan(0);
    expect(json).not.toContain(attempt.seed);
    for (const k of ["referenceAnswer", "serverTruths", "acceptableAnswers", "toleranceSeconds", "\"events\"", "\"seed\""]) expect(json, k).not.toContain(k);
    for (const t of await truthsFor(attemptId)) {
      // Choice questions list their options (the answer is one of them by design); free-answer ones must not leak.
      const choice = t.type === "single_choice" || t.type === "multi_select" || t.type === "ordering";
      if (!choice && typeof t.referenceAnswer === "string" && t.referenceAnswer.length > 6) expect(json).not.toContain(t.referenceAnswer);
    }
    expect(ws.questions.every((q) => q.debrief === null && q.referenceQuery === null && q.attemptsLeft === MAX_QUESTION_ATTEMPTS)).toBe(true);
  });

  it("verifies a correct answer against the attempt-pinned seed and only then reveals the debrief", async () => {
    const truth = (await truthsFor(attemptId)).find((t) => t.type === "numeric" || t.type === "entity")!;
    const res = await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truth.id, answer: truth.referenceAnswer });
    expect(res).toMatchObject({ isCorrect: true, status: "correct", pointsAwarded: 10 });
    expect(res.debrief).toBe(truth.debrief);
    // Persisted: a fresh read (e.g. after reload) shows it solved.
    const q = (await getQueryWorkspace(ctx, USER, attemptId)).questions.find((x) => x.id === truth.id)!;
    expect(q.status).toBe("correct");
  });

  it("locks after the attempt cap, persists counts, and never re-evaluates a locked question", async () => {
    const truth = (await truthsFor(attemptId))[0];
    let res;
    for (let i = 0; i < MAX_QUESTION_ATTEMPTS; i++) {
      res = await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truth.id, answer: `wrong-${i}` });
      expect(res.isCorrect).toBe(false);
      if (i < MAX_QUESTION_ATTEMPTS - 1) {
        expect(res).toMatchObject({ status: "incorrect", attemptsLeft: MAX_QUESTION_ATTEMPTS - 1 - i, debrief: null, referenceQuery: null });
        await pause();
      }
    }
    expect(res).toMatchObject({ status: "locked", attemptsLeft: 0 });
    await pause();
    // Even the right answer cannot score after lockout.
    const after = await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truth.id, answer: truth.referenceAnswer });
    expect(after).toMatchObject({ status: "locked", isCorrect: false, pointsAwarded: 0 });
    expect((await ctx.repo.listSocQuestionAttempts(attemptId)).filter((r) => r.questionId === truth.id)).toHaveLength(MAX_QUESTION_ATTEMPTS);
  }, 60_000);

  it("rate-limits rapid re-submission of the same question", async () => {
    const truth = (await truthsFor(attemptId))[0];
    await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truth.id, answer: "x1" });
    await expect(submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truth.id, answer: "x2" })).rejects.toThrow(/Rate limit/);
  });

  it("right and wrong answers have the same response shape and timing floor", async () => {
    const truths = await truthsFor(attemptId);
    const t0 = Date.now();
    const wrong = await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truths[0].id, answer: "definitely-wrong" });
    const wrongMs = Date.now() - t0;
    const t1 = Date.now();
    const right = await submitInvestigationAnswer(ctx, USER, { attemptId, questionId: truths[1].id, answer: truths[1].referenceAnswer });
    const rightMs = Date.now() - t1;
    expect(Object.keys(wrong).sort()).toEqual(Object.keys(right).sort());
    expect(wrongMs).toBeGreaterThanOrEqual(ANSWER_RESPONSE_FLOOR_MS - 5);
    expect(rightMs).toBeGreaterThanOrEqual(ANSWER_RESPONSE_FLOOR_MS - 5);
  });

  it("rejects other users and unknown questions", async () => {
    const truth = (await truthsFor(attemptId))[0];
    await expect(submitInvestigationAnswer(ctx, "u-mallory", { attemptId, questionId: truth.id, answer: "x" })).rejects.toThrow(/not owned/);
    await expect(getQueryWorkspace(ctx, "u-mallory", attemptId)).rejects.toThrow(/not owned/);
    await expect(submitInvestigationAnswer(ctx, USER, { attemptId, questionId: "q-not-real", answer: "x" })).rejects.toThrow(/Unknown question/);
  });

  it("reference answers are findable with the learner's own server-side queries (same dataset)", async () => {
    const truth = (await truthsFor(attemptId)).find((t) => t.id === "q-top-source-ip");
    expect(truth).toBeDefined();
    const { result } = await executeInvestigationQuery(ctx, USER, { attemptId, query: truth!.referenceQuery });
    expect(JSON.stringify(result.events)).toContain(String(truth!.referenceAnswer));
  });
});

describe("S7: answer logic is unreachable from client code", () => {
  const SERVER_ONLY_MODULES = ["query/questions", "query/question-service", "query/investigation-dataset", "query/pipeline", "query/dataset-generator"];

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") ? [] : walk(p);
      return /\.(tsx?|mts)$/.test(e.name) ? [p] : [];
    });
  }

  it("no 'use client' module imports question, truth or dataset code", () => {
    const offenders: string[] = [];
    for (const file of [...walk("components"), ...walk("app"), ...walk("lib")]) {
      const src = fs.readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      for (const m of SERVER_ONLY_MODULES) if (src.includes(`soc/${m}"`)) offenders.push(`${file} -> ${m}`);
      if (/generateScenarioQuestions|serverTruths|generateScenarioDataset/.test(src)) offenders.push(`${file} uses truth/dataset code`);
    }
    expect(offenders).toEqual([]);
  });

  it("the modules that compute answers are marked server-only", () => {
    for (const m of ["questions", "question-service", "investigation-dataset", "pipeline"]) {
      expect(fs.readFileSync(`lib/lab-engine/soc/query/${m}.ts`, "utf8"), m).toMatch(/^import "server-only";$/m);
    }
  });
});
