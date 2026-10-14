/**
 * Human review. Reviewers accept or override an AI grade; either way a NEW grade record is
 * written (append-only) that supersedes the old one. Learners may request review once per
 * submission.
 */
import { latestGrades } from "./compose";
import { GRADER_ID } from "./calibration/packets";
import type { AiGradingStore } from "./store/types";
import type { AiCriterionGradeRecord, AiReviewItemRecord, AiRubric, Band } from "./types";

function assertPseudonym(reviewer: string): void {
  if (!GRADER_ID.test(reviewer)) throw new Error("reviewer must be a pseudonym (letters, digits, _ or -)");
}

async function openItem(store: AiGradingStore, itemId: string): Promise<{ item: AiReviewItemRecord; grade: AiCriterionGradeRecord }> {
  const [item] = (await store.listReviewItems({ status: "open" })).filter((r) => r.id === itemId);
  if (!item) throw new Error("open review item not found");
  const grade = await store.getGrade(item.gradeId);
  if (!grade) throw new Error("graded record not found");
  return { item, grade };
}

function successor(grade: AiCriterionGradeRecord, patch: Partial<AiCriterionGradeRecord>): Omit<AiCriterionGradeRecord, "id" | "createdAt"> {
  const { id, createdAt, ...rest } = grade;
  void createdAt;
  return { ...rest, supersedesId: id, flags: [], eligibleToCount: true, status: "graded", inputTokens: 0, outputTokens: 0, ...patch };
}

export async function acceptReviewItem(store: AiGradingStore, args: { itemId: string; reviewer: string; now: Date }): Promise<AiCriterionGradeRecord> {
  assertPseudonym(args.reviewer);
  const { item, grade } = await openItem(store, args.itemId);
  if (grade.band === undefined) throw new Error("nothing to accept: the AI did not produce a band");
  const next = await store.saveGrade(successor(grade, { source: "human_accept", reviewerPseudonym: args.reviewer, confidence: "high" }));
  await store.resolveReviewItem(item.id, { resolution: "accepted", resolvedGradeId: next.id, resolvedAt: args.now.toISOString() });
  return next;
}

export async function overrideReviewItem(
  store: AiGradingStore,
  args: { itemId: string; reviewer: string; band: Band; rubric: AiRubric; now: Date },
): Promise<AiCriterionGradeRecord> {
  assertPseudonym(args.reviewer);
  const { item, grade } = await openItem(store, args.itemId);
  const crit = args.rubric.criteria.find((c) => c.id === grade.criterionId);
  if (!crit) throw new Error("criterion not in current AI rubric");
  const b = crit.bands[args.band];
  const next = await store.saveGrade(
    successor(grade, {
      source: "human_override",
      reviewerPseudonym: args.reviewer,
      band: args.band,
      confidence: "high",
      notGradedReason: undefined,
      // Model prose is dropped on override; the learner sees the rubric wording for the new band.
      feedback: { summary: `${b.label}: ${b.descriptor}`, strengths: [], improvements: [] },
      verifiedSpans: [],
    }),
  );
  await store.resolveReviewItem(item.id, { resolution: "overridden", resolvedGradeId: next.id, resolvedAt: args.now.toISOString() });
  return next;
}

export type HumanReviewRequestResult = { status: "created" | "already_requested"; queued: number };

/** One request per submission; queues every current AI grade that has a band. */
export async function requestHumanReview(
  store: AiGradingStore,
  args: { userId: string; submissionId: string; submissionOwnerId: string; now: Date },
): Promise<HumanReviewRequestResult> {
  if (args.submissionOwnerId !== args.userId) throw new Error("Forbidden: submission does not belong to operator");
  const grades = [...latestGrades(await store.listGradesForSubmission(args.submissionId)).values()].filter(
    (g) => g.userId === args.userId && g.band !== undefined,
  );
  if (grades.length === 0) throw new Error("There is no AI feedback on this report to review.");
  const { created } = await store.createHumanReviewRequest(args.submissionId, args.userId, args.now.toISOString());
  if (!created) return { status: "already_requested", queued: 0 };
  for (const g of grades) {
    await store.addReviewItem({ gradeId: g.id, submissionId: g.submissionId, userId: g.userId, criterionId: g.criterionId, reason: "learner_request" });
  }
  return { status: "created", queued: grades.length };
}
