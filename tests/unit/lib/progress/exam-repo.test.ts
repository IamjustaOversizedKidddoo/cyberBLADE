import { describe, expect, it } from "vitest";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { SocExamAttemptRecord } from "@/lib/lab-engine/soc/exam/types";

const NOW = new Date("2026-10-15T10:00:00Z");
const make = (userId: string, format: SocExamAttemptRecord["format"], startedAt = NOW): Omit<SocExamAttemptRecord, "id"> => ({
  userId,
  format,
  configVersion: 1,
  variantId: "v",
  socAttemptId: null,
  seed: "s",
  itemIds: [],
  status: "active",
  submitReason: null,
  startedAt: startedAt.toISOString(),
  deadlineAt: new Date(startedAt.getTime() + 3_600_000).toISOString(),
  timeMultiplier: 1,
  submittedAt: null,
  result: null,
});
const start = (repo: MemoryProgressRepo, userId: string, format: SocExamAttemptRecord["format"], now = NOW, cooldown = 60, max = 3) =>
  repo.createSocExamAttemptAtomic({ attempt: make(userId, format, now), cooldownMinutes: cooldown, maxAttempts: max, windowDays: 7, now });

describe("local exam store parity with the Postgres rules", () => {
  it("allows one active exam per learner, across formats", async () => {
    const repo = new MemoryProgressRepo();
    await start(repo, "u1", "knowledge");
    await expect(start(repo, "u1", "alert-queue")).rejects.toThrow("exam is active");
    await expect(start(repo, "u2", "alert-queue")).resolves.toBeDefined();
  });

  it("two concurrent starts create exactly one exam", async () => {
    const repo = new MemoryProgressRepo();
    const results = await Promise.allSettled([start(repo, "u1", "knowledge"), start(repo, "u1", "knowledge")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("finalize is idempotent and answers freeze after submission", async () => {
    const repo = new MemoryProgressRepo();
    const e = await start(repo, "u1", "knowledge");
    await repo.saveSocExamAnswer({ examAttemptId: e.id, userId: "u1", itemId: "k1", answer: '"a"', answeredAt: NOW.toISOString() });
    await repo.saveSocExamAnswer({ examAttemptId: e.id, userId: "u1", itemId: "k1", answer: '"b"', answeredAt: NOW.toISOString() });
    expect((await repo.listSocExamAnswers(e.id)).map((a) => a.answer)).toEqual(['"b"']);
    const first = await repo.finalizeSocExamAttempt(e.id, { submitReason: "learner", submittedAt: NOW.toISOString(), result: null });
    const second = await repo.finalizeSocExamAttempt(e.id, { submitReason: "deadline", submittedAt: NOW.toISOString(), result: null });
    expect([first.changed, second.changed]).toEqual([true, false]);
    expect(second.record.submitReason).toBe("learner");
    await expect(repo.saveSocExamAnswer({ examAttemptId: e.id, userId: "u1", itemId: "k2", answer: '"c"', answeredAt: NOW.toISOString() })).rejects.toThrow("exam is closed");
  });

  it("refuses answers for another learner's exam", async () => {
    const repo = new MemoryProgressRepo();
    const e = await start(repo, "u1", "knowledge");
    await expect(repo.saveSocExamAnswer({ examAttemptId: e.id, userId: "u2", itemId: "k1", answer: '"x"', answeredAt: NOW.toISOString() })).rejects.toThrow("not found");
  });

  it("enforces cooldown per format and the retake cap in the window", async () => {
    const repo = new MemoryProgressRepo();
    const e = await start(repo, "u1", "knowledge");
    await repo.finalizeSocExamAttempt(e.id, { submitReason: "learner", submittedAt: NOW.toISOString(), result: null });
    await expect(start(repo, "u1", "knowledge", new Date(NOW.getTime() + 30 * 60_000))).rejects.toThrow("cooling down");
    const later = new Date(NOW.getTime() + 61 * 60_000);
    await expect(start(repo, "u1", "knowledge", later, 60, 1)).rejects.toThrow("retake limit");
  });

  it("erasure removes every exam record of the learner and nothing else", async () => {
    const repo = new MemoryProgressRepo();
    const e = await start(repo, "u1", "knowledge");
    await start(repo, "u2", "knowledge");
    await repo.saveSocExamAnswer({ examAttemptId: e.id, userId: "u1", itemId: "k1", answer: '"a"', answeredAt: NOW.toISOString() });
    await repo.saveSocExamOutcomeReport({ userId: "u1", certFamily: "soc", examDate: "2026-10-01", passed: true, consentVersion: "c1" });
    await repo.setSocExamAccommodation({ userId: "u1", multiplier: 1.5, reason: "r", setBy: "cli", setAt: NOW.toISOString() });
    await repo.deleteUserData("u1");
    expect(await repo.listSocExamAttempts("u1")).toEqual([]);
    expect(await repo.listSocExamAnswers(e.id)).toEqual([]);
    expect(await repo.listSocExamOutcomeReports("u1")).toEqual([]);
    expect(await repo.getSocExamAccommodation("u1")).toBeNull();
    expect(await repo.listSocExamAttempts("u2")).toHaveLength(1);
  });
});
