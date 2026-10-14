import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { enqueueAiGrading, processAiGradingJobs, aiCacheKey } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { createContentHeuristicMock, createThrowingMock } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { loadAiGradingConfig } from "@/lib/lab-engine/soc/ai-grading/config";
import { harness } from "./pipeline-harness";

const base = loadAiGradingConfig();

describe("AI grading pipeline", () => {
  it("does nothing in off mode (the default)", async () => {
    const h = harness({ env: { SOC_AI_GRADING_MODE: "off" } });
    const { submissionId } = await h.submit("u-off");
    const r = await enqueueAiGrading(h.deps, submissionId);
    expect(r).toMatchObject({ enqueued: 0, skippedReason: "mode_off" });
    expect(await h.store.listJobsForSubmission(submissionId)).toEqual([]);
  });

  it("kill switch beats every mode", async () => {
    const h = harness({ env: { SOC_AI_GRADING_MODE: "preview", SOC_AI_GRADING_KILL_SWITCH: "1" } });
    const { submissionId } = await h.submit("u-kill");
    expect(await enqueueAiGrading(h.deps, submissionId)).toMatchObject({ enqueued: 0, skippedReason: "kill_switch" });
  });

  it("enqueues one idempotent job per criterion and grades them asynchronously", async () => {
    const provider = createContentHeuristicMock();
    const h = harness({ provider });
    const { submissionId } = await h.submit("u-1");
    expect((await enqueueAiGrading(h.deps, submissionId)).enqueued).toBe(6);
    expect((await enqueueAiGrading(h.deps, submissionId)).enqueued).toBe(0); // replay is a no-op

    const s = await processAiGradingJobs(h.deps);
    expect(s.claimed).toBe(6);
    expect(s.graded + s.notGraded).toBe(6);
    const grades = await h.store.listGradesForSubmission(submissionId);
    expect(grades).toHaveLength(6);
    for (const g of grades) {
      expect(g.modelId === "" || g.modelId === "mock:content-heuristic").toBe(true);
      expect(g.inputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(g.params).toEqual({ temperature: 0, samples: 3, maxOutputTokens: base.sampling.maxOutputTokens });
    }
    const graded = grades.filter((g) => g.status !== "not_graded");
    expect(graded.length).toBeGreaterThanOrEqual(4);
    expect((await h.store.listRawOutputs(graded[0].id)).length).toBeGreaterThanOrEqual(3);
    // Second worker pass finds nothing to do.
    expect((await processAiGradingJobs(h.deps)).claimed).toBe(0);
    const usage = await h.store.getUsage(`sub:${submissionId}`);
    expect(usage.inputTokens).toBeGreaterThan(0);
  });

  it("records Not graded (user_quota) once the daily submission quota is used", async () => {
    const h = harness({ config: { budgets: { ...base.budgets, perUserDailySubmissions: 1 } } });
    const a = await h.submit("u-q");
    await enqueueAiGrading(h.deps, a.submissionId);
    const b = await h.submit("u-q", undefined, "soc-f-phishing-cred-01");
    const r = await enqueueAiGrading(h.deps, b.submissionId);
    expect(r).toMatchObject({ enqueued: 0, skippedReason: "user_quota" });
    const grades = await h.store.listGradesForSubmission(b.submissionId);
    expect(grades.map((g) => g.notGradedReason)).toEqual(Array(6).fill("user_quota"));
  });

  it("degrades to Not graded (global_ceiling) when the global daily token ceiling is reached", async () => {
    const h = harness({ config: { budgets: { ...base.budgets, globalDailyTokenCeiling: 500 } } });
    const { submissionId } = await h.submit("u-ceil");
    await enqueueAiGrading(h.deps, submissionId);
    await processAiGradingJobs(h.deps);
    const reasons = (await h.store.listGradesForSubmission(submissionId)).map((g) => g.notGradedReason);
    expect(reasons.filter((r) => r === "global_ceiling").length).toBeGreaterThanOrEqual(4);
    expect(reasons.every((r) => r !== undefined)).toBe(true);
  });

  it("retries provider outages with exponential backoff, then dead-letters with Not graded", async () => {
    const provider = createThrowingMock("Groq API error (503)");
    const h = harness({ provider, config: { jobs: { ...base.jobs, maxAttempts: 3, baseBackoffMs: 1000 } } });
    const { submissionId } = await h.submit("u-down");
    await enqueueAiGrading(h.deps, submissionId);

    expect((await processAiGradingJobs(h.deps)).retried).toBeGreaterThan(0);
    const jobs1 = await h.store.listJobsForSubmission(submissionId);
    const retrying = jobs1.filter((j) => j.status === "pending");
    expect(retrying.every((j) => j.attempts === 1 && j.nextRunAt === "2026-10-14T10:00:01.000Z")).toBe(true);

    expect((await processAiGradingJobs(h.deps)).claimed).toBe(0); // not due yet
    h.clock.t = new Date("2026-10-14T10:00:01Z");
    await processAiGradingJobs(h.deps);
    expect((await h.store.listJobsForSubmission(submissionId)).filter((j) => j.status === "pending").every((j) => j.nextRunAt === "2026-10-14T10:00:03.000Z")).toBe(true);
    h.clock.t = new Date("2026-10-14T10:00:03Z");
    const last = await processAiGradingJobs(h.deps);
    expect(last.dead).toBe(retrying.length);
    const grades = await h.store.listGradesForSubmission(submissionId);
    expect(grades.filter((g) => g.notGradedReason === "provider_unavailable")).toHaveLength(retrying.length);
  });

  it("re-claims a job whose worker died mid-lease, without duplicating its grade", async () => {
    const h = harness();
    const { submissionId } = await h.submit("u-lease");
    await enqueueAiGrading(h.deps, submissionId);
    const claimed = await h.store.claimDueJobs(h.clock.t.toISOString(), 1, base.jobs.leaseMs);
    expect(claimed).toHaveLength(1);
    // Worker crashed: lease expires, another worker picks it up.
    h.clock.t = new Date(h.clock.t.getTime() + base.jobs.leaseMs + 1);
    await processAiGradingJobs(h.deps);
    const grades = await h.store.listGradesForSubmission(submissionId);
    expect(new Set(grades.map((g) => g.criterionId)).size).toBe(grades.length);
  });

  it("isolates caches per user: identical reports never share a result", async () => {
    const h = harness();
    const a = await h.submit("u-alice");
    const b = await h.submit("u-bob");
    await enqueueAiGrading(h.deps, a.submissionId);
    await enqueueAiGrading(h.deps, b.submissionId);
    await processAiGradingJobs(h.deps, { limit: 50 });
    const ga = await h.store.listGradesForSubmission(a.submissionId);
    const gb = await h.store.listGradesForSubmission(b.submissionId);
    expect(ga.every((g) => g.userId === "u-alice")).toBe(true);
    expect(gb.every((g) => g.userId === "u-bob")).toBe(true);
    const aKeys = new Set(ga.map((g) => g.cacheKey));
    expect(gb.some((g) => aKeys.has(g.cacheKey))).toBe(false);
    expect(await h.store.findGradeByCacheKey("u-bob", ga[0].cacheKey)).toBeNull();
    // Same parts except the user id produce a different key.
    const parts = { submissionId: "s", criterionId: "coherence" as const, aiRubricVersion: "0.1.0", promptVersion: "p1", graderVersion: "0.1.0", modelId: "m", inputHash: "h" };
    expect(aiCacheKey({ userId: "a", ...parts })).not.toBe(aiCacheKey({ userId: "b", ...parts }));
  });

  it("refuses to grade drafts", async () => {
    const h = harness();
    const { submissionId } = await h.submit("u-d");
    const sub = await h.ctx.repo.getSocReportSubmission(submissionId);
    h.deps.getSubmission = async () => (sub ? { ...sub, status: "draft" } : null);
    await expect(enqueueAiGrading(h.deps, submissionId)).rejects.toThrow(/Only submitted/);
  });
});
