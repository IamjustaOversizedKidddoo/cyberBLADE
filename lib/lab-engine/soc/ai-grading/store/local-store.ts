/**
 * AiGradingStore over the project's JsonStore (file for local-first, memory for tests).
 * Raw model outputs live in a second store so the learner-readable data file never holds them.
 */
import { randomUUID } from "node:crypto";
import { createJsonStore, dataPath, type JsonStore } from "@/lib/storage/json-store";
import { createMemoryStore } from "@/lib/storage/memory-store";
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

interface MainData {
  jobs: Record<string, AiGradingJobRecord>;
  grades: Record<string, AiCriterionGradeRecord>;
  review: Record<string, AiReviewItemRecord>;
  requests: Record<string, AiHumanReviewRequestRecord>;
  consent: Record<string, AiCalibrationConsentRecord>;
  usage: Record<string, AiUsageRecord>;
}
interface RawData {
  raw: Record<string, AiRawOutputRecord>;
}

const emptyMain = (): MainData => ({ jobs: {}, grades: {}, review: {}, requests: {}, consent: {}, usage: {} });
const emptyRaw = (): RawData => ({ raw: {} });
const emptyUsage = (key: string): AiUsageRecord => ({ key, submissionsGraded: 0, inputTokens: 0, outputTokens: 0 });

export class LocalAiGradingStore implements AiGradingStore {
  constructor(
    private main: JsonStore<MainData>,
    private rawStore: JsonStore<RawData>,
    private now: () => Date = () => new Date(),
  ) {}

  async enqueueJob(job: NewJob) {
    let result!: { job: AiGradingJobRecord; created: boolean };
    await this.main.update((d) => {
      const existing = Object.values(d.jobs).find((j) => j.idempotencyKey === job.idempotencyKey);
      if (existing) {
        result = { job: existing, created: false };
        return;
      }
      const at = this.now().toISOString();
      const rec: AiGradingJobRecord = { ...job, id: randomUUID(), createdAt: at, updatedAt: at };
      d.jobs[rec.id] = rec;
      result = { job: rec, created: true };
    });
    return result;
  }

  async claimDueJobs(nowIso: string, limit: number, leaseMs: number) {
    const claimed: AiGradingJobRecord[] = [];
    await this.main.update((d) => {
      const due = Object.values(d.jobs)
        .filter(
          (j) =>
            (j.status === "pending" && j.nextRunAt <= nowIso) ||
            (j.status === "running" && (!j.leaseUntil || j.leaseUntil <= nowIso)),
        )
        .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
        .slice(0, limit);
      const leaseUntil = new Date(Date.parse(nowIso) + leaseMs).toISOString();
      for (const j of due) {
        j.status = "running";
        j.leaseUntil = leaseUntil;
        j.updatedAt = nowIso;
        claimed.push({ ...j });
      }
    });
    return claimed;
  }

  async updateJob(id: string, patch: Parameters<AiGradingStore["updateJob"]>[1]) {
    let out!: AiGradingJobRecord;
    await this.main.update((d) => {
      const j = d.jobs[id];
      if (!j) throw new Error("AI grading job not found");
      Object.assign(j, patch, { updatedAt: this.now().toISOString() });
      out = { ...j };
    });
    return out;
  }

  async listJobsForSubmission(submissionId: string) {
    return Object.values((await this.main.read()).jobs).filter((j) => j.submissionId === submissionId);
  }

  async saveGrade(grade: NewGrade) {
    const rec: AiCriterionGradeRecord = { ...grade, id: randomUUID(), createdAt: this.now().toISOString() };
    await this.main.update((d) => {
      d.grades[rec.id] = rec;
    });
    return rec;
  }

  async getGrade(id: string) {
    return (await this.main.read()).grades[id] ?? null;
  }

  async findGradeByCacheKey(userId: string, cacheKey: string) {
    return (
      Object.values((await this.main.read()).grades).find(
        (g) => g.userId === userId && g.cacheKey === cacheKey && g.source === "ai",
      ) ?? null
    );
  }

  async listGradesForSubmission(submissionId: string) {
    return Object.values((await this.main.read()).grades)
      .filter((g) => g.submissionId === submissionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveRawOutputs(rows: NewRawOutput[]) {
    const at = this.now().toISOString();
    await this.rawStore.update((d) => {
      for (const r of rows) {
        const rec: AiRawOutputRecord = { ...r, id: randomUUID(), createdAt: at };
        d.raw[rec.id] = rec;
      }
    });
  }

  async listRawOutputs(gradeId: string) {
    return Object.values((await this.rawStore.read()).raw)
      .filter((r) => r.gradeId === gradeId)
      .sort((a, b) => a.sampleIndex - b.sampleIndex || a.attempt - b.attempt);
  }

  async addReviewItem(item: NewReviewItem) {
    const rec: AiReviewItemRecord = { ...item, id: randomUUID(), status: "open", createdAt: this.now().toISOString() };
    await this.main.update((d) => {
      d.review[rec.id] = rec;
    });
    return rec;
  }

  async listReviewItems(filter: { status?: "open" | "resolved"; submissionId?: string; limit?: number }) {
    return Object.values((await this.main.read()).review)
      .filter((r) => (!filter.status || r.status === filter.status) && (!filter.submissionId || r.submissionId === filter.submissionId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, filter.limit ?? 1000);
  }

  async resolveReviewItem(id: string, patch: { resolution: "accepted" | "overridden"; resolvedGradeId: string; resolvedAt: string }) {
    let out!: AiReviewItemRecord;
    await this.main.update((d) => {
      const r = d.review[id];
      if (!r) throw new Error("review item not found");
      if (r.status === "resolved") throw new Error("review item already resolved");
      Object.assign(r, patch, { status: "resolved" });
      out = { ...r };
    });
    return out;
  }

  async createHumanReviewRequest(submissionId: string, userId: string, nowIso: string) {
    let result!: { request: AiHumanReviewRequestRecord; created: boolean };
    await this.main.update((d) => {
      const existing = d.requests[submissionId];
      if (existing) {
        result = { request: existing, created: false };
        return;
      }
      const rec: AiHumanReviewRequestRecord = { id: randomUUID(), submissionId, userId, createdAt: nowIso, status: "open" };
      d.requests[submissionId] = rec;
      result = { request: rec, created: true };
    });
    return result;
  }

  async getHumanReviewRequest(submissionId: string) {
    return (await this.main.read()).requests[submissionId] ?? null;
  }

  async getConsent(userId: string) {
    return (await this.main.read()).consent[userId] ?? null;
  }

  async setConsent(record: AiCalibrationConsentRecord) {
    await this.main.update((d) => {
      d.consent[record.userId] = record;
    });
    return record;
  }

  async listConsentingUserIds(consentVersion: string) {
    return Object.values((await this.main.read()).consent)
      .filter((c) => c.granted && c.consentVersion === consentVersion)
      .map((c) => c.userId);
  }

  async getUsage(key: string) {
    return (await this.main.read()).usage[key] ?? emptyUsage(key);
  }

  async addUsage(key: string, delta: { submissionsGraded?: number; inputTokens?: number; outputTokens?: number }) {
    let out!: AiUsageRecord;
    await this.main.update((d) => {
      const u = d.usage[key] ?? emptyUsage(key);
      u.submissionsGraded += delta.submissionsGraded ?? 0;
      u.inputTokens += delta.inputTokens ?? 0;
      u.outputTokens += delta.outputTokens ?? 0;
      d.usage[key] = u;
      out = { ...u };
    });
    return out;
  }

  async deleteUserData(userId: string) {
    const gradeIds = new Set<string>();
    await this.main.update((d) => {
      for (const [k, v] of Object.entries(d.jobs)) if (v.userId === userId) delete d.jobs[k];
      for (const [k, v] of Object.entries(d.grades)) {
        if (v.userId === userId) {
          gradeIds.add(k);
          delete d.grades[k];
        }
      }
      for (const [k, v] of Object.entries(d.review)) if (v.userId === userId) delete d.review[k];
      for (const [k, v] of Object.entries(d.requests)) if (v.userId === userId) delete d.requests[k];
      delete d.consent[userId];
      for (const k of Object.keys(d.usage)) if (k.startsWith(`${userId}:`)) delete d.usage[k];
    });
    await this.rawStore.update((d) => {
      for (const [k, v] of Object.entries(d.raw)) if (v.userId === userId || gradeIds.has(v.gradeId)) delete d.raw[k];
    });
  }

  async exportUserData(userId: string): Promise<AiGradingExport> {
    const d = await this.main.read();
    const consent = d.consent[userId];
    return {
      grades: Object.values(d.grades)
        .filter((g) => g.userId === userId)
        .map((g) => ({
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
      humanReviewRequests: Object.values(d.requests)
        .filter((r) => r.userId === userId)
        .map((r) => ({ submissionId: r.submissionId, createdAt: r.createdAt, status: r.status })),
      calibrationConsent: consent ? { granted: consent.granted, consentVersion: consent.consentVersion, updatedAt: consent.updatedAt } : null,
    };
  }
}

export function createMemoryAiGradingStore(now?: () => Date): LocalAiGradingStore {
  return new LocalAiGradingStore(createMemoryStore(emptyMain), createMemoryStore(emptyRaw), now);
}

export function createFileAiGradingStore(): LocalAiGradingStore {
  return new LocalAiGradingStore(
    createJsonStore(dataPath("soc-ai-grading.json"), emptyMain),
    createJsonStore(dataPath("soc-ai-raw-outputs.json"), emptyRaw),
  );
}
