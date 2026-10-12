import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";
import { startSocSession, getSocSession, submitSocAttempt } from "@/lib/lab-engine/soc/engine";

function createMockCtx(): Ctx {
  const repo = new MemoryProgressRepo();
  const simulatedTime = new Date("2026-10-13T09:00:00Z");
  return {
    repo,
    now: () => simulatedTime,
    operators: {
      get: async () => null,
      create: async () => { throw new Error("not implemented"); },
      setRank: async () => {},
      delete: async () => {},
    },
    content: {
      getLesson: async () => null,
      getLessons: async () => [],
      loadChecks: async () => { throw new Error("not implemented"); },
      loadLab: async () => { throw new Error("not implemented"); },
      listLabs: async () => [],
      generators: {},
    },
  };
}

describe("SOC Engine Integration with Scenario Families", () => {
  let ctx: Ctx;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it("starts session for a family ID, generates variant, and records version metadata", async () => {
    const session = await startSocSession(
      ctx,
      "test-analyst-1",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    expect(session.attempt.id).toBeDefined();
    expect(session.attempt.scenarioId).toBe("soc-f-mixed-signal-01");
    expect(session.scenario.alerts.length).toBeGreaterThan(10);

    // Verify client projection: No ground truth, no seed
    expect((session.scenario as unknown as Record<string, unknown>).groundTruth).toBeUndefined();
    expect((session.attempt as unknown as Record<string, unknown>).seed).toBeUndefined();

    // Verify stored attempt in repo has versions and scenarioHash
    const rawAttempt = await ctx.repo.getSocAttempt(session.attempt.id);
    expect(rawAttempt).not.toBeNull();
    expect(rawAttempt?.familyId).toBe("soc-f-mixed-signal-01");
    expect(rawAttempt?.familyVersion).toBe(1);
    expect(rawAttempt?.generatorVersion).toBe("1.0.0");
    expect(rawAttempt?.difficulty).toBe("intermediate");
    expect(rawAttempt?.scenarioHash).toBeDefined();
    expect(rawAttempt?.seed).toBeDefined();
  });

  it("resumes active attempt deterministically and verifies scenario hash match", async () => {
    const initialSession = await startSocSession(
      ctx,
      "test-analyst-2",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    // Resuming via getSocSession must produce exact same client view
    const resumedSession = await getSocSession(
      ctx,
      "test-analyst-2",
      initialSession.attempt.id,
    );

    expect(resumedSession).not.toBeNull();
    expect(resumedSession?.attempt.id).toBe(initialSession.attempt.id);
    expect(resumedSession?.scenario.alerts.length).toBe(initialSession.scenario.alerts.length);
    expect(resumedSession?.scenario.alerts.map((a) => a.id)).toEqual(
      initialSession.scenario.alerts.map((a) => a.id),
    );
  });

  it("fails safely if scenario content hash drifts / is tampered", async () => {
    const session = await startSocSession(
      ctx,
      "test-analyst-3",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    // Artificially corrupt the scenarioHash in the underlying store
    await (ctx.repo as unknown as { store: { update: (fn: (d: { socAttempts: Record<string, { scenarioHash: string }> }) => void) => Promise<void> } }).store.update((d) => {
      d.socAttempts[session.attempt.id].scenarioHash = "corrupted_hash_value_ffffffff";
    });

    // Attempting to resolve/resume should throw tamper error
    await expect(
      getSocSession(ctx, "test-analyst-3", session.attempt.id),
    ).rejects.toThrow(/Scenario hash mismatch/);
  });

  it("enforces non-repeating seeds per user and family", async () => {
    const userId = "test-analyst-retake";
    const familyId = "soc-f-mixed-signal-01";

    // First attempt
    const session1 = await startSocSession(ctx, userId, familyId);
    const attempt1 = (await ctx.repo.getSocAttempt(session1.attempt.id))!;

    // Check used seeds recorded
    const usedSeeds = await ctx.repo.listUsedSeeds(userId, familyId);
    expect(usedSeeds).toContain(attempt1.seed);

    // Complete/submit first attempt properly through engine
    await submitSocAttempt(ctx, userId, session1.attempt.id);

    // Second attempt
    const session2 = await startSocSession(ctx, userId, familyId);
    const attempt2 = (await ctx.repo.getSocAttempt(session2.attempt.id))!;

    expect(attempt2.id).not.toBe(attempt1.id);
    expect(attempt2.seed).not.toBe(attempt1.seed);
    expect(attempt2.scenarioHash).not.toBe(attempt1.scenarioHash);
  });
});
