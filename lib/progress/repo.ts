import { randomUUID } from "node:crypto";
import type { JsonStore } from "@/lib/storage/json-store";
import type {
  AttemptMode,
  LabAttempt,
  LessonProgress,
  ProgressData,
  RankChallenge,
  XpEvent,
  ReviewItemRecord,
  ReviewEventRecord,
  LearningEventRecord,
  ExamReportRecord,
} from "./types";
import type {
  SocAttemptRecord,
  SocDecisionRecord,
  SocCaseRecord,
} from "@/lib/lab-engine/soc/types";
import type { SocEnrichmentLookupRecord } from "@/lib/lab-engine/soc/enrichment/types";

/**
 * Progress storage. Every mutation is a single atomic operation (no read-then-write in callers),
 * so two tabs or a double-click can't lose each other's progress.
 */
export interface ProgressRepo {
  getLessonProgress(userId: string, lessonId: string): Promise<LessonProgress | null>;
  listLessonProgress(userId: string): Promise<LessonProgress[]>;
  addCheckPassed(userId: string, lessonId: string, questionId: string): Promise<LessonProgress>;
  /** Touches the lesson (in_progress) without passing anything, e.g. after a wrong answer. */
  touchLesson(userId: string, lessonId: string): Promise<void>;
  markLessonCompleted(userId: string, lessonId: string, at: string): Promise<void>;

  getAttempt(id: string): Promise<LabAttempt | null>;
  /** Most recent attempt that has not failed (open or completed). */
  findLatestAttempt(userId: string, labId: string, mode: AttemptMode): Promise<LabAttempt | null>;
  hasCompletedAttempt(userId: string, labId: string, mode: AttemptMode): Promise<boolean>;
  createAttempt(attempt: Omit<LabAttempt, "id">): Promise<LabAttempt>;
  /** Latest non-failed attempt, or a new one from `make()` — in one atomic step (two tabs → one attempt). */
  findOrCreateAttempt(userId: string, labId: string, mode: AttemptMode, make: () => Omit<LabAttempt, "id">): Promise<LabAttempt>;
  addSolvedObjective(id: string, objectiveId: string): Promise<LabAttempt>;
  updateAttempt(id: string, patch: Partial<Pick<LabAttempt, "completedAt" | "failedAt" | "hintsUsed">>): Promise<LabAttempt>;

  /** False if this source already paid out (idempotent). */
  awardXp(userId: string, source: string, amount: number): Promise<boolean>;
  getXpTotal(userId: string): Promise<number>;
  listXpEvents(userId: string): Promise<XpEvent[]>;
  listAttempts(userId: string): Promise<LabAttempt[]>;

  getActiveChallenge(userId: string, rank: number): Promise<RankChallenge | null>;
  getLastFailedChallenge(userId: string, rank: number): Promise<RankChallenge | null>;
  hasPassedChallenge(userId: string, rank: number): Promise<boolean>;
  createChallenge(challenge: Omit<RankChallenge, "id">): Promise<RankChallenge>;
  /**
   * Starts a rank challenge only if none is active (and unexpired), none has passed and no cooldown
   * is running — checked and written in one atomic step. Throws "challenge is <state>" otherwise.
   */
  startChallengeAtomic(input: {
    userId: string;
    rank: number;
    attempt: Omit<LabAttempt, "id">;
    cooldownMinutes: number;
    now: Date;
  }): Promise<LabAttempt>;
  updateChallenge(id: string, patch: Partial<Pick<RankChallenge, "status" | "finishedAt">>): Promise<RankChallenge>;

  listReviewItems(userId: string): Promise<ReviewItemRecord[]>;
  saveReviewItem(item: Omit<ReviewItemRecord, "id"> & { id?: string }): Promise<ReviewItemRecord>;
  logReviewEvent(event: Omit<ReviewEventRecord, "id">): Promise<ReviewEventRecord>;
  logLearningEvent(event: Omit<LearningEventRecord, "id">): Promise<LearningEventRecord>;
  saveExamReport(report: Omit<ExamReportRecord, "id">): Promise<ExamReportRecord>;
  listExamReports(userId: string): Promise<ExamReportRecord[]>;

  getSocAttempt(id: string): Promise<SocAttemptRecord | null>;
  findActiveSocAttempt(userId: string, scenarioId: string): Promise<SocAttemptRecord | null>;
  createSocAttempt(attempt: Omit<SocAttemptRecord, "id">): Promise<SocAttemptRecord>;
  updateSocAttempt(id: string, patch: Partial<Pick<SocAttemptRecord, "status" | "scoreSummary" | "submittedAt">>): Promise<SocAttemptRecord>;
  saveSocDecision(decision: Omit<SocDecisionRecord, "id">): Promise<SocDecisionRecord>;
  listSocDecisions(attemptId: string): Promise<SocDecisionRecord[]>;
  saveSocCase(socCase: Omit<SocCaseRecord, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string }): Promise<SocCaseRecord>;
  deleteSocCase(id: string): Promise<void>;
  listSocCases(attemptId: string): Promise<SocCaseRecord[]>;
  listSocAttempts(userId: string): Promise<SocAttemptRecord[]>;
  saveSocEnrichmentLookup(lookup: Omit<SocEnrichmentLookupRecord, "id" | "createdAt">): Promise<SocEnrichmentLookupRecord>;
  listSocEnrichmentLookups(attemptId: string): Promise<SocEnrichmentLookupRecord[]>;
  listUsedSeeds(userId: string, familyId: string): Promise<string[]>;
  recordUsedSeed(userId: string, familyId: string, seed: string): Promise<void>;
  deleteUserData(userId: string): Promise<void>;
}

function latestAttempt(d: ProgressData, userId: string, labId: string, mode: AttemptMode): LabAttempt | null {
  const attempts = Object.values(d.attempts)
    .filter((a) => a.userId === userId && a.labId === labId && a.mode === mode && !a.failedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return attempts[0] ?? null;
}

const own = <T>(record: Record<string, T>, key: string): T | null => (Object.hasOwn(record, key) ? record[key] : null);
const lessonKey = (userId: string, lessonId: string) => `${userId}:${lessonId}`;

/** ProgressRepo over any JsonStore (file on disk, or memory in tests). */
export class StoreProgressRepo implements ProgressRepo {
  constructor(private store: JsonStore<ProgressData>) {}

  async getLessonProgress(userId: string, lessonId: string) {
    return own((await this.store.read()).lessons, lessonKey(userId, lessonId));
  }

  async listLessonProgress(userId: string) {
    return Object.values((await this.store.read()).lessons).filter((p) => p.userId === userId);
  }

  private ensureLesson(d: ProgressData, userId: string, lessonId: string): LessonProgress {
    const key = lessonKey(userId, lessonId);
    d.lessons[key] ??= { userId, lessonId, status: "in_progress", checksPassed: [], completedAt: null };
    return d.lessons[key];
  }

  async addCheckPassed(userId: string, lessonId: string, questionId: string) {
    const d = await this.store.update((draft) => {
      const p = this.ensureLesson(draft, userId, lessonId);
      if (!p.checksPassed.includes(questionId)) p.checksPassed.push(questionId);
    });
    return d.lessons[lessonKey(userId, lessonId)];
  }

  async touchLesson(userId: string, lessonId: string) {
    await this.store.update((draft) => void this.ensureLesson(draft, userId, lessonId));
  }

  async markLessonCompleted(userId: string, lessonId: string, at: string) {
    await this.store.update((draft) => {
      const p = this.ensureLesson(draft, userId, lessonId);
      if (p.status !== "completed") {
        p.status = "completed";
        p.completedAt = at;
      }
    });
  }

  async getAttempt(id: string) {
    return own((await this.store.read()).attempts, id);
  }

  async findLatestAttempt(userId: string, labId: string, mode: AttemptMode) {
    return latestAttempt(await this.store.read(), userId, labId, mode);
  }

  async hasCompletedAttempt(userId: string, labId: string, mode: AttemptMode) {
    return Object.values((await this.store.read()).attempts).some(
      (a) => a.userId === userId && a.labId === labId && a.mode === mode && a.completedAt !== null,
    );
  }

  async createAttempt(attempt: Omit<LabAttempt, "id">) {
    const created = { ...attempt, id: randomUUID() };
    await this.store.update((d) => {
      d.attempts[created.id] = created;
    });
    return created;
  }

  async findOrCreateAttempt(userId: string, labId: string, mode: AttemptMode, make: () => Omit<LabAttempt, "id">) {
    let found: LabAttempt | null = null;
    await this.store.update((d) => {
      found = latestAttempt(d, userId, labId, mode);
      if (found) return;
      const created = { ...make(), id: randomUUID() };
      d.attempts[created.id] = created;
      found = created;
    });
    return found!;
  }

  private async mutateAttempt(id: string, fn: (a: LabAttempt) => void) {
    const d = await this.store.update((draft) => {
      const a = own(draft.attempts, id);
      if (!a) throw new Error("not found");
      fn(a);
    });
    return d.attempts[id];
  }

  addSolvedObjective(id: string, objectiveId: string) {
    return this.mutateAttempt(id, (a) => {
      if (!a.objectivesSolved.includes(objectiveId)) a.objectivesSolved.push(objectiveId);
    });
  }

  updateAttempt(id: string, patch: Partial<Pick<LabAttempt, "completedAt" | "failedAt" | "hintsUsed">>) {
    return this.mutateAttempt(id, (a) => Object.assign(a, patch));
  }

  async awardXp(userId: string, source: string, amount: number) {
    let awarded = false;
    await this.store.update((d) => {
      const key = `${userId}:${source}`;
      if (Object.hasOwn(d.xp, key)) return;
      d.xp[key] = { userId, source, amount, createdAt: new Date().toISOString() };
      awarded = true;
    });
    return awarded;
  }

  async getXpTotal(userId: string) {
    return Object.values((await this.store.read()).xp)
      .filter((e) => e.userId === userId)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  async listXpEvents(userId: string) {
    return Object.values((await this.store.read()).xp).filter((e) => e.userId === userId);
  }

  async listAttempts(userId: string) {
    return Object.values((await this.store.read()).attempts).filter((a) => a.userId === userId);
  }

  private async challenges(userId: string, rank: number) {
    return Object.values((await this.store.read()).challenges).filter((c) => c.userId === userId && c.rank === rank);
  }

  async getActiveChallenge(userId: string, rank: number) {
    return (await this.challenges(userId, rank)).find((c) => c.status === "active") ?? null;
  }

  async getLastFailedChallenge(userId: string, rank: number) {
    const failed = (await this.challenges(userId, rank))
      .filter((c) => c.status === "failed" && c.finishedAt)
      .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1));
    return failed[0] ?? null;
  }

  async hasPassedChallenge(userId: string, rank: number) {
    return (await this.challenges(userId, rank)).some((c) => c.status === "passed");
  }

  async createChallenge(challenge: Omit<RankChallenge, "id">) {
    const created = { ...challenge, id: randomUUID() };
    await this.store.update((d) => {
      d.challenges[created.id] = created;
    });
    return created;
  }

  async startChallengeAtomic(input: {
    userId: string;
    rank: number;
    attempt: Omit<LabAttempt, "id">;
    cooldownMinutes: number;
    now: Date;
  }) {
    const { userId, rank, cooldownMinutes, now } = input;
    let created: LabAttempt | null = null;
    await this.store.update((d) => {
      const mine = Object.values(d.challenges).filter((c) => c.userId === userId && c.rank === rank);
      if (mine.some((c) => c.status === "passed")) throw new Error("challenge is passed");
      for (const c of mine.filter((c) => c.status === "active")) {
        const attempt = own(d.attempts, c.labAttemptId);
        if (attempt?.expiresAt && now > new Date(attempt.expiresAt)) {
          // Ran out of time without being finalized: it failed at its deadline.
          attempt.failedAt = attempt.expiresAt;
          c.status = "failed";
          c.finishedAt = attempt.expiresAt;
        } else throw new Error("challenge is active");
      }
      const lastFailed = mine
        .filter((c) => c.status === "failed" && c.finishedAt)
        .map((c) => new Date(c.finishedAt!).getTime())
        .sort((a, b) => b - a)[0];
      if (lastFailed !== undefined && now.getTime() < lastFailed + cooldownMinutes * 60_000) {
        throw new Error("challenge is cooldown");
      }
      const attempt = { ...input.attempt, id: randomUUID() };
      d.attempts[attempt.id] = attempt;
      const challengeId = randomUUID();
      d.challenges[challengeId] = { id: challengeId, userId, rank, labAttemptId: attempt.id, status: "active", finishedAt: null };
      created = attempt;
    });
    return created!;
  }

  async updateChallenge(id: string, patch: Partial<Pick<RankChallenge, "status" | "finishedAt">>) {
    const d = await this.store.update((draft) => {
      const c = own(draft.challenges, id);
      if (!c) throw new Error("not found");
      Object.assign(c, patch);
    });
    return d.challenges[id];
  }

  async listReviewItems(userId: string): Promise<ReviewItemRecord[]> {
    const data = await this.store.read();
    return Object.values(data.reviewItems ?? {}).filter((i) => i.userId === userId);
  }

  async saveReviewItem(item: Omit<ReviewItemRecord, "id"> & { id?: string }): Promise<ReviewItemRecord> {
    const id = item.id ?? randomUUID();
    const record: ReviewItemRecord = { ...item, id };
    await this.store.update((d) => {
      d.reviewItems ??= {};
      const key = `${item.userId}:${item.cardId}`;
      d.reviewItems[key] = record;
    });
    return record;
  }

  async logReviewEvent(event: Omit<ReviewEventRecord, "id">): Promise<ReviewEventRecord> {
    const record: ReviewEventRecord = { ...event, id: randomUUID() };
    await this.store.update((d) => {
      d.reviewEvents ??= {};
      d.reviewEvents[record.id] = record;
    });
    return record;
  }

  async logLearningEvent(event: Omit<LearningEventRecord, "id">): Promise<LearningEventRecord> {
    const record: LearningEventRecord = { ...event, id: randomUUID() };
    await this.store.update((d) => {
      d.learningEvents ??= {};
      d.learningEvents[record.id] = record;
    });
    return record;
  }

  async saveExamReport(report: Omit<ExamReportRecord, "id">): Promise<ExamReportRecord> {
    const record: ExamReportRecord = { ...report, id: randomUUID() };
    await this.store.update((d) => {
      d.examReports ??= {};
      d.examReports[record.id] = record;
    });
    return record;
  }

  async listExamReports(userId: string): Promise<ExamReportRecord[]> {
    const data = await this.store.read();
    return Object.values(data.examReports ?? {}).filter((r) => r.userId === userId);
  }

  async getSocAttempt(id: string): Promise<SocAttemptRecord | null> {
    const data = await this.store.read();
    return data.socAttempts?.[id] ?? null;
  }

  async findActiveSocAttempt(userId: string, scenarioId: string): Promise<SocAttemptRecord | null> {
    const data = await this.store.read();
    const attempts = Object.values(data.socAttempts ?? {})
      .filter((a) => a.userId === userId && a.scenarioId === scenarioId && a.status === "in_progress")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return attempts[0] ?? null;
  }

  async createSocAttempt(attempt: Omit<SocAttemptRecord, "id">): Promise<SocAttemptRecord> {
    const id = randomUUID();
    const record: SocAttemptRecord = { ...attempt, id };
    await this.store.update((d) => {
      d.socAttempts ??= {};
      d.socAttempts[id] = record;
    });
    return record;
  }

  async updateSocAttempt(
    id: string,
    patch: Partial<Pick<SocAttemptRecord, "status" | "scoreSummary" | "submittedAt">>,
  ): Promise<SocAttemptRecord> {
    let updated: SocAttemptRecord | null = null;
    await this.store.update((d) => {
      d.socAttempts ??= {};
      const cur = d.socAttempts[id];
      if (!cur) throw new Error("not found");
      Object.assign(cur, patch, { updatedAt: new Date().toISOString() });
      updated = cur;
    });
    return updated!;
  }

  async saveSocDecision(decision: Omit<SocDecisionRecord, "id">): Promise<SocDecisionRecord> {
    const id = randomUUID();
    const record: SocDecisionRecord = { ...decision, id };
    await this.store.update((d) => {
      d.socDecisions ??= {};
      d.socDecisions[id] = record;
    });
    return record;
  }

  async listSocDecisions(attemptId: string): Promise<SocDecisionRecord[]> {
    const data = await this.store.read();
    return Object.values(data.socDecisions ?? {})
      .filter((d) => d.attemptId === attemptId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async saveSocCase(socCase: Omit<SocCaseRecord, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string }): Promise<SocCaseRecord> {
    const id = socCase.id ?? randomUUID();
    const now = new Date().toISOString();
    const record: SocCaseRecord = {
      ...socCase,
      id,
      createdAt: (socCase as SocCaseRecord).createdAt ?? now,
      updatedAt: now,
    };
    await this.store.update((d) => {
      d.socCases ??= {};
      d.socCases[id] = record;
    });
    return record;
  }

  async deleteSocCase(id: string): Promise<void> {
    await this.store.update((d) => {
      if (d.socCases) delete d.socCases[id];
    });
  }

  async listSocCases(attemptId: string): Promise<SocCaseRecord[]> {
    const data = await this.store.read();
    return Object.values(data.socCases ?? {}).filter((c) => c.attemptId === attemptId);
  }

  async listSocAttempts(userId: string): Promise<SocAttemptRecord[]> {
    const data = await this.store.read();
    return Object.values(data.socAttempts ?? {}).filter((a) => a.userId === userId);
  }

  async listUsedSeeds(userId: string, familyId: string): Promise<string[]> {
    const data = await this.store.read();
    const key = `${userId}:${familyId}`;
    return data.socUsedSeeds?.[key] ?? [];
  }

  async recordUsedSeed(userId: string, familyId: string, seed: string): Promise<void> {
    const key = `${userId}:${familyId}`;
    await this.store.update((d) => {
      d.socUsedSeeds ??= {};
      const list = d.socUsedSeeds[key] ?? [];
      if (!list.includes(seed)) list.push(seed);
      d.socUsedSeeds[key] = list;
    });
  }

  async saveSocEnrichmentLookup(lookup: Omit<SocEnrichmentLookupRecord, "id" | "createdAt">): Promise<SocEnrichmentLookupRecord> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const record: SocEnrichmentLookupRecord = {
      ...lookup,
      id,
      createdAt,
    };
    await this.store.update((d) => {
      d.socEnrichmentLookups ??= {};
      d.socEnrichmentLookups[id] = record;
    });
    return record;
  }

  async listSocEnrichmentLookups(attemptId: string): Promise<SocEnrichmentLookupRecord[]> {
    const data = await this.store.read();
    return Object.values(data.socEnrichmentLookups ?? {})
      .filter((l) => l.attemptId === attemptId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.store.update((d) => {
      for (const [k, v] of Object.entries(d.lessons)) {
        if (v.userId === userId) delete d.lessons[k];
      }
      for (const [k, v] of Object.entries(d.attempts)) {
        if (v.userId === userId) delete d.attempts[k];
      }
      for (const [k, v] of Object.entries(d.xp)) {
        if (v.userId === userId) delete d.xp[k];
      }
      for (const [k, v] of Object.entries(d.challenges)) {
        if (v.userId === userId) delete d.challenges[k];
      }
      if (d.reviewItems) {
        for (const [k, v] of Object.entries(d.reviewItems)) {
          if (v.userId === userId) delete d.reviewItems[k];
        }
      }
      if (d.reviewEvents) {
        for (const [k, v] of Object.entries(d.reviewEvents)) {
          if (v.userId === userId) delete d.reviewEvents[k];
        }
      }
      if (d.examReports) {
        for (const [k, v] of Object.entries(d.examReports)) {
          if (v.userId === userId) delete d.examReports[k];
        }
      }
      const userSocAttemptIds = new Set<string>();
      if (d.socAttempts) {
        for (const [k, v] of Object.entries(d.socAttempts)) {
          if (v.userId === userId) {
            userSocAttemptIds.add(k);
            delete d.socAttempts[k];
          }
        }
      }
      if (d.socDecisions) {
        for (const [k, v] of Object.entries(d.socDecisions)) {
          if (userSocAttemptIds.has(v.attemptId)) delete d.socDecisions[k];
        }
      }
      if (d.socCases) {
        for (const [k, v] of Object.entries(d.socCases)) {
          if (userSocAttemptIds.has(v.attemptId)) delete d.socCases[k];
        }
      }
      if (d.socUsedSeeds) {
        for (const k of Object.keys(d.socUsedSeeds)) {
          if (k.startsWith(`${userId}:`)) delete d.socUsedSeeds[k];
        }
      }
      if (d.socEnrichmentLookups) {
        for (const [k, v] of Object.entries(d.socEnrichmentLookups)) {
          if (v.userId === userId || userSocAttemptIds.has(v.attemptId)) {
            delete d.socEnrichmentLookups[k];
          }
        }
      }
    });
  }
}
