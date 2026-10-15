/**
 * Regression tests for the L1 audit (docs/ops/l1-audit.md). Each test names the finding it covers
 * and fails on the code before the fix.
 */
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 60_000 });

import { makeCtx } from "../ai-grading/pipeline-harness";
import { resolveScenarioForAttempt } from "@/lib/lab-engine/soc/engine";
import { generateScenarioQuestions } from "@/lib/lab-engine/soc/query/questions";
import { getQueryWorkspace, submitInvestigationAnswer } from "@/lib/lab-engine/soc/query/question-service";
import { getExamState, startExam, submitExam } from "@/lib/lab-engine/soc/exam/service";
import { loadKnowledgeBank } from "@/lib/lab-engine/soc/exam/knowledge";
import { buildLearnerExport } from "@/lib/identity/learner-export";
import type { Ctx } from "@/lib/progress/service";

const T0 = new Date("2026-10-15T09:00:00Z");

async function investigationWithCorrectAnswer(ctx: Ctx, userId: string) {
  const s = await startExam(ctx, userId, "investigation");
  const attempt = (await ctx.repo.getSocAttempt(s.socAttemptId!))!;
  const scenario = await resolveScenarioForAttempt(attempt);
  const truth = generateScenarioQuestions(scenario, attempt.seed, attempt.familyId ?? attempt.scenarioId).serverTruths[0];
  await submitInvestigationAnswer(ctx, userId, { attemptId: attempt.id, questionId: truth.id, answer: truth.referenceAnswer });
  return { s, attempt, truth };
}

describe("L1-A-04: exam answers are not marked before submission", () => {
  it("stores a correct exam answer unmarked, then marks it at submission", async () => {
    const ctx = makeCtx({ t: T0 });
    const { s, attempt, truth } = await investigationWithCorrectAnswer(ctx, "u-a04");
    const stored = await ctx.repo.listSocQuestionAttempts(attempt.id);
    expect(stored).toHaveLength(1);
    expect(stored[0].isCorrect).toBe(false); // was true before the fix: a readable oracle

    const done = await submitExam(ctx, "u-a04", s.examId);
    expect(done.result?.components.find((c) => c.id === "questions")?.percent).toBeGreaterThan(0);
    const review = await getQueryWorkspace(ctx, "u-a04", attempt.id);
    expect(review.questions.find((q) => q.id === truth.id)?.status).toBe("correct");
  });
});

describe("L1-A-05: the data export is no oracle during an exam", () => {
  it("exports no correctness, score or variant for a running exam", async () => {
    const ctx = makeCtx({ t: T0 });
    const { s, attempt } = await investigationWithCorrectAnswer(ctx, "u-a05");
    const out = await buildLearnerExport(ctx, "u-a05", { grades: [], humanReviewRequests: [], calibrationConsent: null });
    const soc = out.soc.find((a) => a.attemptId === attempt.id)!;
    expect(soc.questionAnswers.every((q) => q.correct === null)).toBe(true);
    expect(soc.scenarioId).not.toMatch(/soc-f-|shift-/);
    const exam = out.socExams.find((e) => e.examId === s.examId)!;
    expect(exam.variantId).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/soc-f-[a-z]|shift-[a-z]/);
  });
});

describe("knowledge item ids never leave the server", () => {
  it("shows only opaque per-exam keys (bank ids such as kb-win-4625 name the answer)", async () => {
    const ctx = makeCtx({ t: T0 });
    const s = await startExam(ctx, "u-kb", "knowledge");
    const json = JSON.stringify(await getExamState(ctx, "u-kb", s.examId));
    for (const item of loadKnowledgeBank().items) expect(json).not.toContain(item.id);
    expect(s.knowledgeItems!.every((i) => /^q[0-9a-f]{12}$/.test(i.id))).toBe(true);
  });
});
