import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Each test submits and grades full reports; allow for a loaded CI machine.
vi.setConfig({ testTimeout: 30_000 });
const session = vi.hoisted(() => ({ userId: "u-alice" }));
const holder = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => ({ id: session.userId, handle: `h_${session.userId}` }) }));
vi.mock("@/lib/progress/context", () => ({ getCtx: () => holder.ctx }));
vi.mock("@/lib/security/audit-logger", () => ({ logSecurityEvent: vi.fn(async () => {}) }));
vi.mock("@/app/(app)/labs/soc/ai-schedule", () => ({ scheduleAiWorker: vi.fn(), enqueueAiGradingAfterSubmit: vi.fn() }));

import * as aiActions from "@/app/(app)/labs/soc/ai-actions";
import { setAiGradingStoreForTests } from "@/lib/lab-engine/soc/ai-grading/runtime";
import { enqueueAiGrading, processAiGradingJobs } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { getAiGradingProvider } from "@/lib/lab-engine/soc/ai-grading/provider";
import { harness, type Harness } from "../unit/lib/lab-engine/soc/ai-grading/pipeline-harness";
import { sampleReport } from "../unit/lib/lab-engine/soc/ai-grading/helpers";

let h: Harness;
let submissionId: string;

async function gradedFor(userId: string): Promise<string> {
  const { submissionId: id } = await h.submit(userId, sampleReport());
  await enqueueAiGrading(h.deps, id);
  await processAiGradingJobs(h.deps, { limit: 50 });
  return id;
}

beforeEach(async () => {
  vi.stubEnv("SOC_AI_GRADING_MODE", "preview");
  h = harness();
  holder.ctx = h.ctx;
  setAiGradingStoreForTests(h.store);
  submissionId = await gradedFor("u-alice");
  session.userId = "u-alice";
});

describe("AI grading server actions (adversarial)", () => {
  it("exposes only four browser-callable actions; enqueueing is not one of them", () => {
    expect(Object.keys(aiActions).sort()).toEqual(["getSocAiConsentAction", "getSocAiResultAction", "requestSocAiHumanReviewAction", "setSocAiConsentAction"]);
  });

  it("rejects malformed ids before touching storage", async () => {
    await expect(aiActions.getSocAiResultAction("../../etc/passwd")).rejects.toThrow();
    await expect(aiActions.requestSocAiHumanReviewAction("1 OR 1=1")).rejects.toThrow();
    await expect(aiActions.setSocAiConsentAction("yes" as unknown as boolean)).rejects.toThrow();
  });

  it("IDOR: another learner cannot read results, and the error leaks nothing", async () => {
    session.userId = "u-mallory";
    const err = await aiActions.getSocAiResultAction(submissionId).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/^Something went wrong\. Reference: [0-9a-f]{8}$/);
    expect((err as Error).message).not.toMatch(/Forbidden|submission|u-alice/);
  });

  it("IDOR: another learner cannot request review of someone else's report", async () => {
    session.userId = "u-mallory";
    await expect(aiActions.requestSocAiHumanReviewAction(submissionId)).rejects.toThrow(/Reference/);
    expect(await h.store.getHumanReviewRequest(submissionId)).toBeNull();
  });

  it("the learner's result payload carries no raw outputs, prompts, hashes or canaries", async () => {
    const view = await aiActions.getSocAiResultAction(submissionId);
    const json = JSON.stringify(view);
    for (const forbidden of ["rawText", "raw_text", "promptHash", "cacheKey", "inputHash", "systemPrompt", "CANARY-", "<<<REPORT", "groundTruth", "modelReport"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(view.mode).toBe("preview");
    expect(view.criteria.every((c) => !c.countsInTotal)).toBe(true);
  });

  it("live requested without a signed gate is served as preview and nothing counts", async () => {
    vi.stubEnv("SOC_AI_GRADING_MODE", "live");
    const view = await aiActions.getSocAiResultAction(submissionId);
    expect(view.mode).toBe("preview");
    expect(view.calibrated).toBe(false);
    expect(view.displayedTotal).toBe(view.deterministicTotal);
  });

  it("human review: once per submission, then rate-limited", async () => {
    expect(await aiActions.requestSocAiHumanReviewAction(submissionId)).toEqual({ status: "created" });
    expect(await aiActions.requestSocAiHumanReviewAction(submissionId)).toEqual({ status: "already_requested" });
    await aiActions.requestSocAiHumanReviewAction(submissionId);
    await expect(aiActions.requestSocAiHumanReviewAction(submissionId)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("consent is off by default, owner-scoped, and revocable", async () => {
    session.userId = "u-consent";
    expect(await aiActions.getSocAiConsentAction()).toMatchObject({ granted: false });
    await aiActions.setSocAiConsentAction(true);
    expect(await aiActions.getSocAiConsentAction()).toMatchObject({ granted: true });
    session.userId = "u-other";
    expect(await aiActions.getSocAiConsentAction()).toMatchObject({ granted: false });
    session.userId = "u-consent";
    await aiActions.setSocAiConsentAction(false);
    expect(await h.store.listConsentingUserIds("c1")).not.toContain("u-consent");
  });

  it("mock models can never be selected in a real production deployment", () => {
    expect(() => getAiGradingProvider({ NODE_ENV: "production", SOC_AI_PROVIDER: "mock-e2e" } as NodeJS.ProcessEnv)).toThrow(/not allowed/);
  });
});

describe("privacy: export and erasure", () => {
  it("export holds learner-facing fields only", async () => {
    const out = await h.store.exportUserData("u-alice");
    expect(out.grades.length).toBeGreaterThan(0);
    const json = JSON.stringify(out);
    for (const forbidden of ["rawText", "promptHash", "cacheKey", "inputHash", "idempotencyKey"]) expect(json, forbidden).not.toContain(forbidden);
  });

  it("erasure removes grades, raw outputs, jobs, reviews, requests, consent and usage for that user only", async () => {
    const other = await gradedFor("u-bob");
    await h.store.setConsent({ userId: "u-alice", granted: true, consentVersion: "c1", updatedAt: "t" });
    const gradeIds = (await h.store.listGradesForSubmission(submissionId)).map((g) => g.id);
    await h.store.deleteUserData("u-alice");
    expect(await h.store.listGradesForSubmission(submissionId)).toEqual([]);
    expect(await h.store.listJobsForSubmission(submissionId)).toEqual([]);
    for (const id of gradeIds) expect(await h.store.listRawOutputs(id)).toEqual([]);
    expect(await h.store.getConsent("u-alice")).toBeNull();
    expect((await h.store.listReviewItems({})).some((r) => r.userId === "u-alice")).toBe(false);
    expect((await h.store.getUsage(`u-alice:${h.clock.t.toISOString().slice(0, 10)}`)).submissionsGraded).toBe(0);
    expect((await h.store.listGradesForSubmission(other)).length).toBeGreaterThan(0);
  });
});
