/**
 * Beta data (invites, redemptions, notice acknowledgements, feedback). Two implementations with the
 * same rules: a local JSON store (development and the E2E harness) and Supabase (hosted; tables and
 * the atomic redemption function in migration 20261016120000). Learner reads are own-rows only;
 * writes happen on the server.
 */
import { randomUUID } from "node:crypto";
import { createJsonStore, dataPath, type JsonStore } from "@/lib/storage/json-store";
import { createMemoryStore } from "@/lib/storage/memory-store";

export type BetaInvite = { id: string; codeHash: string; label: string; maxUses: number; uses: number; expiresAt: string; revokedAt: string | null; createdBy: string; createdAt: string };
export type FeedbackKind = "general" | "lesson_check" | "exam_question" | "scenario";
export type FeedbackRecord = { id: string; userId: string; kind: FeedbackKind; contentId: string; route: string; message: string; requestId: string; createdAt: string };

export interface BetaStore {
  createInvite(input: Omit<BetaInvite, "id" | "uses" | "revokedAt" | "createdAt">): Promise<BetaInvite>;
  listInvites(): Promise<BetaInvite[]>;
  revokeInvite(id: string, at: string): Promise<boolean>;
  /** Usable = exists, not revoked, not expired, not used up. Does not consume. */
  inviteUsable(codeHash: string, now: string): Promise<boolean>;
  /** Atomic; idempotent for an admitted learner; false for every failure alike. */
  redeemInvite(codeHash: string, userId: string, now: string): Promise<boolean>;
  isAdmitted(userId: string): Promise<boolean>;
  hasAckedNotice(userId: string, version: string): Promise<boolean>;
  ackNotice(userId: string, version: string, at: string): Promise<void>;
  saveFeedback(input: Omit<FeedbackRecord, "id" | "createdAt">, at: string): Promise<FeedbackRecord>;
  listFeedback(): Promise<FeedbackRecord[]>;
  listFeedbackForUser(userId: string): Promise<FeedbackRecord[]>;
  noticeAcksForUser(userId: string): Promise<Array<{ version: string; ackedAt: string }>>;
  deleteUser(userId: string): Promise<void>;
}

type Data = {
  invites: Record<string, BetaInvite>;
  redemptions: Record<string, { inviteId: string; userId: string; redeemedAt: string }>;
  acks: Record<string, { userId: string; version: string; ackedAt: string }>;
  feedback: Record<string, FeedbackRecord>;
};
const empty = (): Data => ({ invites: {}, redemptions: {}, acks: {}, feedback: {} });

const usable = (i: BetaInvite | undefined, now: string) => !!i && !i.revokedAt && i.expiresAt > now && i.uses < i.maxUses;

export class FileBetaStore implements BetaStore {
  private store: JsonStore<Data>;
  constructor(store?: JsonStore<Data>) {
    this.store = store ?? createJsonStore(dataPath("beta.json"), empty);
  }
  private find(d: Data, codeHash: string) {
    return Object.values(d.invites).find((i) => i.codeHash === codeHash);
  }
  async createInvite(input: Omit<BetaInvite, "id" | "uses" | "revokedAt" | "createdAt">) {
    const inv: BetaInvite = { ...input, id: randomUUID(), uses: 0, revokedAt: null, createdAt: new Date().toISOString() };
    await this.store.update((d) => {
      if (this.find(d, inv.codeHash)) throw new Error("duplicate code");
      d.invites[inv.id] = inv;
    });
    return inv;
  }
  async listInvites() {
    return Object.values((await this.store.read()).invites).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async revokeInvite(id: string, at: string) {
    let ok = false;
    await this.store.update((d) => {
      const i = d.invites[id];
      if (i && !i.revokedAt) {
        i.revokedAt = at;
        ok = true;
      }
    });
    return ok;
  }
  async inviteUsable(codeHash: string, now: string) {
    return usable(this.find(await this.store.read(), codeHash), now);
  }
  async redeemInvite(codeHash: string, userId: string, now: string) {
    let ok = false;
    await this.store.update((d) => {
      if (d.redemptions[userId]) {
        ok = true;
        return;
      }
      const i = this.find(d, codeHash);
      if (!usable(i, now)) return;
      i!.uses += 1;
      d.redemptions[userId] = { inviteId: i!.id, userId, redeemedAt: now };
      ok = true;
    });
    return ok;
  }
  async isAdmitted(userId: string) {
    return Boolean((await this.store.read()).redemptions[userId]);
  }
  async hasAckedNotice(userId: string, version: string) {
    return Boolean((await this.store.read()).acks[`${userId}:${version}`]);
  }
  async ackNotice(userId: string, version: string, at: string) {
    await this.store.update((d) => {
      d.acks[`${userId}:${version}`] ??= { userId, version, ackedAt: at };
    });
  }
  async saveFeedback(input: Omit<FeedbackRecord, "id" | "createdAt">, at: string) {
    const rec: FeedbackRecord = { ...input, id: randomUUID(), createdAt: at };
    await this.store.update((d) => {
      d.feedback[rec.id] = rec;
    });
    return rec;
  }
  async listFeedback() {
    return Object.values((await this.store.read()).feedback).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async listFeedbackForUser(userId: string) {
    return (await this.listFeedback()).filter((f) => f.userId === userId);
  }
  async noticeAcksForUser(userId: string) {
    return Object.values((await this.store.read()).acks).filter((a) => a.userId === userId).map((a) => ({ version: a.version, ackedAt: a.ackedAt }));
  }
  async deleteUser(userId: string) {
    await this.store.update((d) => {
      delete d.redemptions[userId];
      for (const [k, a] of Object.entries(d.acks)) if (a.userId === userId) delete d.acks[k];
      for (const [k, f] of Object.entries(d.feedback)) if (f.userId === userId) delete d.feedback[k];
    });
  }
}

/** In-memory variant for tests. */
export class MemoryBetaStore extends FileBetaStore {
  constructor() {
    super(createMemoryStore(empty));
  }
}
