import { randomUUID } from "node:crypto";
import type { JsonStore } from "@/lib/storage/json-store";
import type { AttemptMode, LabAttempt, LessonProgress, ProgressData, RankChallenge } from "./types";

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
  addSolvedObjective(id: string, objectiveId: string): Promise<LabAttempt>;
  updateAttempt(id: string, patch: Partial<Pick<LabAttempt, "completedAt" | "failedAt" | "hintsUsed">>): Promise<LabAttempt>;

  /** False if this source already paid out (idempotent). */
  awardXp(userId: string, source: string, amount: number): Promise<boolean>;
  getXpTotal(userId: string): Promise<number>;

  getActiveChallenge(userId: string, rank: number): Promise<RankChallenge | null>;
  getLastFailedChallenge(userId: string, rank: number): Promise<RankChallenge | null>;
  hasPassedChallenge(userId: string, rank: number): Promise<boolean>;
  createChallenge(challenge: Omit<RankChallenge, "id">): Promise<RankChallenge>;
  updateChallenge(id: string, patch: Partial<Pick<RankChallenge, "status" | "finishedAt">>): Promise<RankChallenge>;
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
    const attempts = Object.values((await this.store.read()).attempts)
      .filter((a) => a.userId === userId && a.labId === labId && a.mode === mode && !a.failedAt)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return attempts[0] ?? null;
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

  async updateChallenge(id: string, patch: Partial<Pick<RankChallenge, "status" | "finishedAt">>) {
    const d = await this.store.update((draft) => {
      const c = own(draft.challenges, id);
      if (!c) throw new Error("not found");
      Object.assign(c, patch);
    });
    return d.challenges[id];
  }
}
