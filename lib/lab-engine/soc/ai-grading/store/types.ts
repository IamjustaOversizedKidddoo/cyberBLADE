import type {
  AiCalibrationConsentRecord,
  AiCriterionGradeRecord,
  AiGradingJobRecord,
  AiHumanReviewRequestRecord,
  AiRawOutputRecord,
  AiReviewItemRecord,
  AiUsageRecord,
} from "../types";

export type NewJob = Omit<AiGradingJobRecord, "id" | "createdAt" | "updatedAt">;
export type NewGrade = Omit<AiCriterionGradeRecord, "id" | "createdAt">;
export type NewRawOutput = Omit<AiRawOutputRecord, "id" | "createdAt">;
export type NewReviewItem = Omit<AiReviewItemRecord, "id" | "createdAt" | "status">;

/** Learner-facing export: no raw outputs, prompts, cache keys or input hashes. */
export interface AiGradingExport {
  grades: Array<Pick<AiCriterionGradeRecord, "submissionId" | "criterionId" | "status" | "band" | "confidence" | "feedback" | "verifiedSpans" | "source" | "modelId" | "aiRubricVersion" | "promptVersion" | "createdAt">>;
  humanReviewRequests: Array<Pick<AiHumanReviewRequestRecord, "submissionId" | "createdAt" | "status">>;
  calibrationConsent: Pick<AiCalibrationConsentRecord, "granted" | "consentVersion" | "updatedAt"> | null;
}

export interface AiGradingStore {
  /** Idempotent on idempotencyKey: an existing job is returned with created=false. */
  enqueueJob(job: NewJob): Promise<{ job: AiGradingJobRecord; created: boolean }>;
  /** Claims due jobs (pending and due, or running with an expired lease) and leases them. */
  claimDueJobs(nowIso: string, limit: number, leaseMs: number): Promise<AiGradingJobRecord[]>;
  updateJob(id: string, patch: Partial<Pick<AiGradingJobRecord, "status" | "attempts" | "nextRunAt" | "leaseUntil" | "lastErrorCode">>): Promise<AiGradingJobRecord>;
  listJobsForSubmission(submissionId: string): Promise<AiGradingJobRecord[]>;

  saveGrade(grade: NewGrade): Promise<AiCriterionGradeRecord>;
  getGrade(id: string): Promise<AiCriterionGradeRecord | null>;
  /** Cache lookup is always scoped by user: identical text from two learners never shares a result. */
  findGradeByCacheKey(userId: string, cacheKey: string): Promise<AiCriterionGradeRecord | null>;
  /** All versions, oldest first. */
  listGradesForSubmission(submissionId: string): Promise<AiCriterionGradeRecord[]>;

  saveRawOutputs(rows: NewRawOutput[]): Promise<void>;
  listRawOutputs(gradeId: string): Promise<AiRawOutputRecord[]>;

  addReviewItem(item: NewReviewItem): Promise<AiReviewItemRecord>;
  listReviewItems(filter: { status?: "open" | "resolved"; submissionId?: string; limit?: number }): Promise<AiReviewItemRecord[]>;
  resolveReviewItem(id: string, patch: { resolution: "accepted" | "overridden"; resolvedGradeId: string; resolvedAt: string }): Promise<AiReviewItemRecord>;

  /** At most one per submission: returns created=false if one exists. */
  createHumanReviewRequest(submissionId: string, userId: string, nowIso: string): Promise<{ request: AiHumanReviewRequestRecord; created: boolean }>;
  getHumanReviewRequest(submissionId: string): Promise<AiHumanReviewRequestRecord | null>;

  getConsent(userId: string): Promise<AiCalibrationConsentRecord | null>;
  setConsent(record: AiCalibrationConsentRecord): Promise<AiCalibrationConsentRecord>;
  listConsentingUserIds(consentVersion: string): Promise<string[]>;

  getUsage(key: string): Promise<AiUsageRecord>;
  addUsage(key: string, delta: { submissionsGraded?: number; inputTokens?: number; outputTokens?: number }): Promise<AiUsageRecord>;

  deleteUserData(userId: string): Promise<void>;
  exportUserData(userId: string): Promise<AiGradingExport>;
}
