import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000 });

import { startSocSession, recordSocDecision, submitSocAttempt } from "@/lib/lab-engine/soc/engine";
import { submitSocReport } from "@/lib/lab-engine/soc/report-engine";
import { buildLearnerExport } from "@/lib/identity/learner-export";
import { makeCtx } from "../unit/lib/lab-engine/soc/ai-grading/pipeline-harness";
import { sampleReport } from "../unit/lib/lab-engine/soc/ai-grading/helpers";

const U = "u-export";

async function richUser() {
  const ctx = makeCtx({ t: new Date("2026-10-14T10:00:00Z") });
  const session = await startSocSession(ctx, U, "soc-f-phishing-cred-01");
  const attemptId = session.attempt.id;
  const alertId = session.scenario.alerts[0].id;
  await recordSocDecision(ctx, U, attemptId, alertId, { disposition: "true_positive", severity: "HIGH", escalate: false, rationale: "Sender domain is newly registered and the link harvested credentials." });
  await ctx.repo.saveSocQueryLog({ attemptId, userId: U, languageVersion: "1", queryText: 'source="auth"', resultRowCount: 3, executionSteps: 10, durationMs: 1, budgetFlags: {} });
  await ctx.repo.saveSocQuestionAttempt({ attemptId, userId: U, questionId: "q1", submittedAnswer: '"10.0.0.1"', isCorrect: false, attemptsUsed: 1, hintsUsed: 0 });
  await submitSocReport(ctx, U, attemptId, sampleReport());
  await submitSocAttempt(ctx, U, attemptId);
  await ctx.repo.logLearningEvent({ userId: U, eventType: "lesson_view", metadata: {}, createdAt: "2026-10-14T10:00:00Z" } as never);
  return { ctx, attemptId, attempt: (await ctx.repo.getSocAttempt(attemptId))! };
}

describe("S6: learner export", () => {
  it("covers every SOC table but contains no seeds, hashes, ground truth or AI internals", async () => {
    const { ctx, attempt } = await richUser();
    const out = await buildLearnerExport(ctx, U, { grades: [], humanReviewRequests: [], calibrationConsent: null });
    const soc = out.soc[0];
    expect(soc.decisions).toHaveLength(1);
    expect(soc.queries).toHaveLength(1);
    expect(soc.questionAnswers).toHaveLength(1);
    expect(soc.reports[0].evaluation?.totalScore).toEqual(expect.any(Number));
    expect(soc.score?.percentage).toEqual(expect.any(Number));

    const json = JSON.stringify(out);
    expect(json).not.toContain(attempt.seed);
    if (attempt.scenarioHash) expect(json).not.toContain(attempt.scenarioHash);
    for (const key of ["\"seed\"", "scenarioHash", "overallDebrief", "alertResults", "missedItems", "annotations", "modelReport", "groundTruth", "rawText", "promptHash", "expectedDisposition"]) {
      expect(json, key).not.toContain(key);
    }
  });

  it("includes SOC exam attempts, answers and the learner's own outcome reports, never the exam seed", async () => {
    const { ctx } = await richUser();
    const now = new Date("2026-10-14T11:00:00Z");
    const exam = await ctx.repo.createSocExamAttemptAtomic({
      attempt: {
        userId: U,
        format: "knowledge",
        configVersion: 1,
        variantId: "bank",
        socAttemptId: null,
        seed: "EXAM_SECRET_SEED_123",
        itemIds: ["k1"],
        status: "active",
        submitReason: null,
        startedAt: now.toISOString(),
        deadlineAt: new Date(now.getTime() + 3_600_000).toISOString(),
        timeMultiplier: 1,
        submittedAt: null,
        result: null,
      },
      cooldownMinutes: 0,
      maxAttempts: 9,
      windowDays: 7,
      now,
    });
    await ctx.repo.saveSocExamAnswer({ examAttemptId: exam.id, userId: U, itemId: "k1", answer: "[1]", answeredAt: now.toISOString() });
    await ctx.repo.saveSocExamOutcomeReport({ userId: U, certFamily: "soc-analyst", examDate: "2026-10-01", passed: true, consentVersion: "c1" });
    const out = await buildLearnerExport(ctx, U, { grades: [], humanReviewRequests: [], calibrationConsent: null });
    expect(out.socExams).toHaveLength(1);
    expect(out.socExams[0].answers).toEqual([{ itemId: "k1", answer: "[1]", answeredAt: now.toISOString() }]);
    expect(out.socExamOutcomeReports).toEqual([{ certFamily: "soc-analyst", examDate: "2026-10-01", passed: true, createdAt: expect.any(String) }]);
    expect(JSON.stringify(out)).not.toContain("EXAM_SECRET_SEED_123");
  });
});

describe("S6: local erasure", () => {
  it("removes learning events too (previously left behind)", async () => {
    const { ctx } = await richUser();
    await ctx.repo.deleteUserData(U);
    expect(await ctx.repo.listSocAttempts(U)).toEqual([]);
    const raw = await (ctx.repo as unknown as { store: { read(): Promise<{ learningEvents?: Record<string, { userId: string }> }> } }).store.read();
    expect(Object.values(raw.learningEvents ?? {}).filter((e) => e.userId === U)).toEqual([]);
  });
});
