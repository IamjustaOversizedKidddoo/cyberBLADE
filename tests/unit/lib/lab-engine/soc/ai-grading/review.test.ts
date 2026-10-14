import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Each test submits and grades full reports; allow for a loaded CI machine.
vi.setConfig({ testTimeout: 30_000 });

import { enqueueAiGrading, processAiGradingJobs } from "@/lib/lab-engine/soc/ai-grading/pipeline";
import { acceptReviewItem, overrideReviewItem, requestHumanReview } from "@/lib/lab-engine/soc/ai-grading/review";
import { latestGrades } from "@/lib/lab-engine/soc/ai-grading/compose";
import { loadAiRubric } from "@/lib/lab-engine/soc/ai-grading/config";
import { createScriptedProvider, extractFencedReport, respondWithBand } from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { harness } from "./pipeline-harness";

const rubric = loadAiRubric();

async function gradedSubmission(userId = "u-rev") {
  // Disagreeing samples -> low confidence -> every graded criterion lands in the review queue.
  const bands = [0, 2, 3] as const;
  const provider = createScriptedProvider((req, i) => respondWithBand(bands[i % 3], extractFencedReport(req.userMessage).sections));
  const h = harness({ provider });
  const { submissionId } = await h.submit(userId);
  await enqueueAiGrading(h.deps, submissionId);
  await processAiGradingJobs(h.deps);
  return { h, submissionId };
}

describe("human review", () => {
  it("routes low-confidence grades to the queue", async () => {
    const { h, submissionId } = await gradedSubmission();
    const open = await h.store.listReviewItems({ status: "open", submissionId });
    expect(open.some((r) => r.reason === "low_confidence")).toBe(true);
  });

  it("accept writes a new superseding record and resolves the item once", async () => {
    const { h, submissionId } = await gradedSubmission();
    const item = (await h.store.listReviewItems({ status: "open", submissionId }))[0];
    const next = await acceptReviewItem(h.store, { itemId: item.id, reviewer: "rev_01", now: h.clock.t });
    expect(next).toMatchObject({ source: "human_accept", supersedesId: item.gradeId, reviewerPseudonym: "rev_01", eligibleToCount: true });
    const current = latestGrades(await h.store.listGradesForSubmission(submissionId)).get(item.criterionId)!;
    expect(current.id).toBe(next.id);
    expect((await h.store.getGrade(item.gradeId))?.source).toBe("ai"); // original kept (append-only)
    await expect(acceptReviewItem(h.store, { itemId: item.id, reviewer: "rev_01", now: h.clock.t })).rejects.toThrow(/not found/);
  });

  it("override sets the band and replaces model prose with rubric wording", async () => {
    const { h, submissionId } = await gradedSubmission();
    const item = (await h.store.listReviewItems({ status: "open", submissionId }))[0];
    const next = await overrideReviewItem(h.store, { itemId: item.id, reviewer: "rev_02", band: 1, rubric, now: h.clock.t });
    const crit = rubric.criteria.find((c) => c.id === item.criterionId)!;
    expect(next).toMatchObject({ source: "human_override", band: 1, feedback: { summary: `${crit.bands[1].label}: ${crit.bands[1].descriptor}`, strengths: [], improvements: [] } });
  });

  it("rejects reviewer ids that are not pseudonyms", async () => {
    const { h, submissionId } = await gradedSubmission();
    const item = (await h.store.listReviewItems({ status: "open", submissionId }))[0];
    await expect(acceptReviewItem(h.store, { itemId: item.id, reviewer: "Asha Rao <asha@corp.example>", now: h.clock.t })).rejects.toThrow(/pseudonym/);
  });

  it("learners can request review once per submission, only for their own report", async () => {
    const { h, submissionId } = await gradedSubmission("u-owner");
    await expect(requestHumanReview(h.store, { userId: "u-intruder", submissionId, submissionOwnerId: "u-owner", now: h.clock.t })).rejects.toThrow(/Forbidden/);
    const first = await requestHumanReview(h.store, { userId: "u-owner", submissionId, submissionOwnerId: "u-owner", now: h.clock.t });
    expect(first.status).toBe("created");
    expect(first.queued).toBeGreaterThan(0);
    const again = await requestHumanReview(h.store, { userId: "u-owner", submissionId, submissionOwnerId: "u-owner", now: h.clock.t });
    expect(again).toEqual({ status: "already_requested", queued: 0 });
    const learnerItems = (await h.store.listReviewItems({ submissionId })).filter((r) => r.reason === "learner_request");
    expect(learnerItems).toHaveLength(first.queued);
  });

  it("refuses a review request when there is no AI feedback", async () => {
    const h = harness({ env: { SOC_AI_GRADING_MODE: "off" } });
    const { submissionId } = await h.submit("u-none");
    await expect(requestHumanReview(h.store, { userId: "u-none", submissionId, submissionOwnerId: "u-none", now: h.clock.t })).rejects.toThrow(/no AI feedback/);
  });
});
