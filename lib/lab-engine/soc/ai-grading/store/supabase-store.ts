import "server-only";
/**
 * Hosted AiGradingStore. Uses the service-role admin client (the only writer); learners read
 * their own grades through RLS-scoped SELECT policies and can never reach raw outputs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiCalibrationConsentRecord,
  AiCriterionGradeRecord,
  AiGradingJobRecord,
  AiHumanReviewRequestRecord,
  AiRawOutputRecord,
  AiReviewItemRecord,
  AiUsageRecord,
} from "../types";
import type { AiGradingExport, AiGradingStore, NewGrade, NewJob, NewRawOutput, NewReviewItem } from "./types";

type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`AI grading store: ${what} failed (${res.error.message})`);
  return res.data;
}

/** For .single(): a missing row is an error, not a null. */
function checkOne(res: { data: Row | null; error: { message: string } | null }, what: string): Row {
  const row = check(res, what);
  if (!row) throw new Error(`AI grading store: ${what} returned no row`);
  return row;
}

const jobFromRow = (r: Row): AiGradingJobRecord => ({
  id: r.id as string,
  submissionId: r.submission_id as string,
  attemptId: r.attempt_id as string,
  userId: r.user_id as string,
  criterionId: r.criterion_id as AiGradingJobRecord["criterionId"],
  idempotencyKey: r.idempotency_key as string,
  status: r.status as AiGradingJobRecord["status"],
  attempts: r.attempts as number,
  nextRunAt: new Date(r.next_run_at as string).toISOString(),
  leaseUntil: r.lease_until ? new Date(r.lease_until as string).toISOString() : undefined,
  lastErrorCode: (r.last_error_code as string | null) ?? undefined,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

const gradeToRow = (g: NewGrade): Row => ({
  submission_id: g.submissionId,
  attempt_id: g.attemptId,
  user_id: g.userId,
  criterion_id: g.criterionId,
  status: g.status,
  not_graded_reason: g.notGradedReason ?? null,
  band: g.band ?? null,
  confidence: g.confidence ?? null,
  eligible_to_count: g.eligibleToCount,
  feedback: g.feedback,
  verified_spans: g.verifiedSpans,
  flags: g.flags,
  ai_rubric_id: g.aiRubricId,
  ai_rubric_version: g.aiRubricVersion,
  prompt_version: g.promptVersion,
  grader_version: g.graderVersion,
  model_id: g.modelId,
  params: g.params,
  input_hash: g.inputHash,
  cache_key: g.cacheKey,
  input_tokens: g.inputTokens,
  output_tokens: g.outputTokens,
  source: g.source,
  supersedes_id: g.supersedesId ?? null,
  reviewer_pseudonym: g.reviewerPseudonym ?? null,
});

const gradeFromRow = (r: Row): AiCriterionGradeRecord => ({
  id: r.id as string,
  submissionId: r.submission_id as string,
  attemptId: r.attempt_id as string,
  userId: r.user_id as string,
  criterionId: r.criterion_id as AiCriterionGradeRecord["criterionId"],
  status: r.status as AiCriterionGradeRecord["status"],
  notGradedReason: (r.not_graded_reason as AiCriterionGradeRecord["notGradedReason"] | null) ?? undefined,
  band: (r.band as AiCriterionGradeRecord["band"] | null) ?? undefined,
  confidence: (r.confidence as AiCriterionGradeRecord["confidence"] | null) ?? undefined,
  eligibleToCount: r.eligible_to_count as boolean,
  feedback: r.feedback as AiCriterionGradeRecord["feedback"],
  verifiedSpans: r.verified_spans as AiCriterionGradeRecord["verifiedSpans"],
  flags: r.flags as AiCriterionGradeRecord["flags"],
  aiRubricId: r.ai_rubric_id as string,
  aiRubricVersion: r.ai_rubric_version as string,
  promptVersion: r.prompt_version as string,
  graderVersion: r.grader_version as string,
  modelId: r.model_id as string,
  params: r.params as AiCriterionGradeRecord["params"],
  inputHash: r.input_hash as string,
  cacheKey: r.cache_key as string,
  inputTokens: r.input_tokens as number,
  outputTokens: r.output_tokens as number,
  source: r.source as AiCriterionGradeRecord["source"],
  supersedesId: (r.supersedes_id as string | null) ?? undefined,
  reviewerPseudonym: (r.reviewer_pseudonym as string | null) ?? undefined,
  createdAt: new Date(r.created_at as string).toISOString(),
});

const reviewFromRow = (r: Row): AiReviewItemRecord => ({
  id: r.id as string,
  gradeId: r.grade_id as string,
  submissionId: r.submission_id as string,
  userId: r.user_id as string,
  criterionId: r.criterion_id as AiReviewItemRecord["criterionId"],
  reason: r.reason as AiReviewItemRecord["reason"],
  status: r.status as AiReviewItemRecord["status"],
  resolution: (r.resolution as AiReviewItemRecord["resolution"] | null) ?? undefined,
  resolvedGradeId: (r.resolved_grade_id as string | null) ?? undefined,
  createdAt: new Date(r.created_at as string).toISOString(),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at as string).toISOString() : undefined,
});

const requestFromRow = (r: Row): AiHumanReviewRequestRecord => ({
  id: r.id as string,
  submissionId: r.submission_id as string,
  userId: r.user_id as string,
  status: r.status as AiHumanReviewRequestRecord["status"],
  createdAt: new Date(r.created_at as string).toISOString(),
});

const usageFromRow = (key: string, r: Row | null): AiUsageRecord => ({
  key,
  submissionsGraded: Number(r?.submissions_graded ?? 0),
  inputTokens: Number(r?.input_tokens ?? 0),
  outputTokens: Number(r?.output_tokens ?? 0),
});

export class SupabaseAiGradingStore implements AiGradingStore {
  private client(): SupabaseClient {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase is not configured");
    // The generated Database type does not yet include the soc_ai_* tables.
    return admin as unknown as SupabaseClient;
  }

  async enqueueJob(job: NewJob) {
    const db = this.client();
    const existing = check(await db.from("soc_ai_grading_jobs").select("*").eq("idempotency_key", job.idempotencyKey).maybeSingle(), "find job");
    if (existing) return { job: jobFromRow(existing), created: false };
    const res = await db
      .from("soc_ai_grading_jobs")
      .insert({
        submission_id: job.submissionId,
        attempt_id: job.attemptId,
        user_id: job.userId,
        criterion_id: job.criterionId,
        idempotency_key: job.idempotencyKey,
        status: job.status,
        attempts: job.attempts,
        next_run_at: job.nextRunAt,
      })
      .select("*")
      .single();
    if (res.error && /duplicate key/i.test(res.error.message)) {
      // Lost a race with a concurrent enqueue: the unique key makes this idempotent.
      const again = checkOne(await db.from("soc_ai_grading_jobs").select("*").eq("idempotency_key", job.idempotencyKey).single(), "find job");
      return { job: jobFromRow(again), created: false };
    }
    return { job: jobFromRow(check(res, "enqueue job")), created: true };
  }

  async claimDueJobs(_nowIso: string, limit: number, leaseMs: number) {
    const rows = check(await this.client().rpc("soc_ai_claim_jobs", { p_limit: limit, p_lease_seconds: Math.ceil(leaseMs / 1000) }), "claim jobs");
    return ((rows as Row[] | null) ?? []).map(jobFromRow);
  }

  async updateJob(id: string, patch: Parameters<AiGradingStore["updateJob"]>[1]) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.nextRunAt !== undefined) row.next_run_at = patch.nextRunAt;
    if ("leaseUntil" in patch) row.lease_until = patch.leaseUntil ?? null;
    if ("lastErrorCode" in patch) row.last_error_code = patch.lastErrorCode ?? null;
    return jobFromRow(checkOne(await this.client().from("soc_ai_grading_jobs").update(row).eq("id", id).select("*").single(), "update job"));
  }

  async listJobsForSubmission(submissionId: string) {
    const rows = check(await this.client().from("soc_ai_grading_jobs").select("*").eq("submission_id", submissionId), "list jobs");
    return ((rows as Row[] | null) ?? []).map(jobFromRow);
  }

  async saveGrade(grade: NewGrade) {
    return gradeFromRow(checkOne(await this.client().from("soc_ai_criterion_grades").insert(gradeToRow(grade)).select("*").single(), "save grade"));
  }

  async getGrade(id: string) {
    const r = check(await this.client().from("soc_ai_criterion_grades").select("*").eq("id", id).maybeSingle(), "get grade");
    return r ? gradeFromRow(r) : null;
  }

  async findGradeByCacheKey(userId: string, cacheKey: string) {
    const r = check(
      await this.client()
        .from("soc_ai_criterion_grades")
        .select("*")
        .eq("user_id", userId)
        .eq("cache_key", cacheKey)
        .eq("source", "ai")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      "find cached grade",
    );
    return r ? gradeFromRow(r) : null;
  }

  async listGradesForSubmission(submissionId: string) {
    const rows = check(
      await this.client().from("soc_ai_criterion_grades").select("*").eq("submission_id", submissionId).order("created_at", { ascending: true }),
      "list grades",
    );
    return ((rows as Row[] | null) ?? []).map(gradeFromRow);
  }

  async saveRawOutputs(rows: NewRawOutput[]) {
    if (rows.length === 0) return;
    check(
      await this.client()
        .from("soc_ai_raw_outputs")
        .insert(rows.map((r) => ({ grade_id: r.gradeId, user_id: r.userId, sample_index: r.sampleIndex, attempt: r.attempt, raw_text: r.rawText, prompt_hash: r.promptHash }))),
      "save raw outputs",
    );
  }

  async listRawOutputs(gradeId: string): Promise<AiRawOutputRecord[]> {
    const rows = check(await this.client().from("soc_ai_raw_outputs").select("*").eq("grade_id", gradeId).order("sample_index"), "list raw outputs");
    return ((rows as Row[] | null) ?? []).map((r) => ({
      id: r.id as string,
      gradeId: r.grade_id as string,
      userId: r.user_id as string,
      sampleIndex: r.sample_index as number,
      attempt: r.attempt as number,
      rawText: r.raw_text as string,
      promptHash: r.prompt_hash as string,
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }

  async addReviewItem(item: NewReviewItem) {
    return reviewFromRow(
      checkOne(
        await this.client()
          .from("soc_ai_review_items")
          .insert({ grade_id: item.gradeId, submission_id: item.submissionId, user_id: item.userId, criterion_id: item.criterionId, reason: item.reason })
          .select("*")
          .single(),
        "add review item",
      ),
    );
  }

  async listReviewItems(filter: { status?: "open" | "resolved"; submissionId?: string; limit?: number }) {
    let q = this.client().from("soc_ai_review_items").select("*").order("created_at", { ascending: true }).limit(filter.limit ?? 1000);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.submissionId) q = q.eq("submission_id", filter.submissionId);
    return ((check(await q, "list review items") as Row[] | null) ?? []).map(reviewFromRow);
  }

  async resolveReviewItem(id: string, patch: { resolution: "accepted" | "overridden"; resolvedGradeId: string; resolvedAt: string }) {
    const r = check(
      await this.client()
        .from("soc_ai_review_items")
        .update({ status: "resolved", resolution: patch.resolution, resolved_grade_id: patch.resolvedGradeId, resolved_at: patch.resolvedAt })
        .eq("id", id)
        .eq("status", "open")
        .select("*")
        .maybeSingle(),
      "resolve review item",
    );
    if (!r) throw new Error("review item not found or already resolved");
    return reviewFromRow(r);
  }

  async createHumanReviewRequest(submissionId: string, userId: string, nowIso: string) {
    const db = this.client();
    const res = await db.from("soc_ai_human_review_requests").insert({ submission_id: submissionId, user_id: userId, created_at: nowIso }).select("*").single();
    if (res.error && /duplicate key/i.test(res.error.message)) {
      const existing = checkOne(await db.from("soc_ai_human_review_requests").select("*").eq("submission_id", submissionId).single(), "find review request");
      return { request: requestFromRow(existing), created: false };
    }
    return { request: requestFromRow(check(res, "create review request")), created: true };
  }

  async getHumanReviewRequest(submissionId: string) {
    const r = check(await this.client().from("soc_ai_human_review_requests").select("*").eq("submission_id", submissionId).maybeSingle(), "get review request");
    return r ? requestFromRow(r) : null;
  }

  async getConsent(userId: string) {
    const r = check(await this.client().from("soc_ai_calibration_consent").select("*").eq("user_id", userId).maybeSingle(), "get consent");
    return r
      ? { userId, granted: r.granted as boolean, consentVersion: r.consent_version as string, updatedAt: new Date(r.updated_at as string).toISOString() }
      : null;
  }

  async setConsent(record: AiCalibrationConsentRecord) {
    check(
      await this.client()
        .from("soc_ai_calibration_consent")
        .upsert({ user_id: record.userId, granted: record.granted, consent_version: record.consentVersion, updated_at: record.updatedAt }),
      "set consent",
    );
    return record;
  }

  async listConsentingUserIds(consentVersion: string) {
    const rows = check(
      await this.client().from("soc_ai_calibration_consent").select("user_id").eq("granted", true).eq("consent_version", consentVersion),
      "list consent",
    );
    return ((rows as Row[] | null) ?? []).map((r) => r.user_id as string);
  }

  async getUsage(key: string) {
    const r = check(await this.client().from("soc_ai_usage_daily").select("*").eq("usage_key", key).maybeSingle(), "get usage");
    return usageFromRow(key, r);
  }

  async addUsage(key: string, delta: { submissionsGraded?: number; inputTokens?: number; outputTokens?: number }) {
    const r = check(
      await this.client().rpc("soc_ai_add_usage", {
        p_key: key,
        p_submissions: delta.submissionsGraded ?? 0,
        p_input: delta.inputTokens ?? 0,
        p_output: delta.outputTokens ?? 0,
      }),
      "add usage",
    );
    return usageFromRow(key, r as Row);
  }

  async deleteUserData(userId: string) {
    const db = this.client();
    // Children first; every table also cascades from auth.users as a backstop.
    for (const table of [
      "soc_ai_raw_outputs",
      "soc_ai_review_items",
      "soc_ai_human_review_requests",
      "soc_ai_grading_jobs",
      "soc_ai_criterion_grades",
      "soc_ai_calibration_consent",
    ]) {
      check(await db.from(table).delete().eq("user_id", userId), `delete ${table}`);
    }
    check(await db.from("soc_ai_usage_daily").delete().like("usage_key", `${userId}:%`), "delete usage");
  }

  async exportUserData(userId: string): Promise<AiGradingExport> {
    const db = this.client();
    const grades = (check(await db.from("soc_ai_criterion_grades").select("*").eq("user_id", userId), "export grades") as Row[] | null) ?? [];
    const requests = (check(await db.from("soc_ai_human_review_requests").select("*").eq("user_id", userId), "export requests") as Row[] | null) ?? [];
    const consent = await this.getConsent(userId);
    return {
      grades: grades.map(gradeFromRow).map((g) => ({
        submissionId: g.submissionId,
        criterionId: g.criterionId,
        status: g.status,
        band: g.band,
        confidence: g.confidence,
        feedback: g.feedback,
        verifiedSpans: g.verifiedSpans,
        source: g.source,
        modelId: g.modelId,
        aiRubricVersion: g.aiRubricVersion,
        promptVersion: g.promptVersion,
        createdAt: g.createdAt,
      })),
      humanReviewRequests: requests.map(requestFromRow).map((r) => ({ submissionId: r.submissionId, createdAt: r.createdAt, status: r.status })),
      calibrationConsent: consent ? { granted: consent.granted, consentVersion: consent.consentVersion, updatedAt: consent.updatedAt } : null,
    };
  }
}
