import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import { startSocSession, getSocSession, submitSocAttempt } from "@/lib/lab-engine/soc/engine";

describe("SOC Engine Integration with Scenario Families", () => {
  let repo: MemoryProgressRepo;
  const now = () => new Date("2026-10-13T09:00:00Z");

  beforeEach(() => {
    repo = new MemoryProgressRepo();
  });

  it("starts session for a family ID, generates variant, and records version metadata", async () => {
    const session = await startSocSession(
      { repo, now },
      "test-analyst-1",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    expect(session.attempt.id).toBeDefined();
    expect(session.attempt.scenarioId).toBe("soc-f-mixed-signal-01");
    expect(session.scenario.alerts.length).toBeGreaterThan(10);

    // Verify client projection: No ground truth, no seed
    expect((session.scenario as any).groundTruth).toBeUndefined();
    expect((session.attempt as any).seed).toBeUndefined();

    // Verify stored attempt in repo has versions and scenarioHash
    const rawAttempt = await repo.getSocAttempt(session.attempt.id);
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
      { repo, now },
      "test-analyst-2",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    // Resuming via getSocSession must produce exact same client view
    const resumedSession = await getSocSession(
      { repo, now },
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
      { repo, now },
      "test-analyst-3",
      "soc-f-mixed-signal-01",
      { difficulty: "intermediate" },
    );

    // Artificially corrupt the scenarioHash in the underlying store
    await (repo as any).store.update((d: any) => {
      d.socAttempts[session.attempt.id].scenarioHash = "corrupted_hash_value_ffffffff";
    });

    // Attempting to resolve/resume should throw tamper error
    await expect(
      getSocSession({ repo, now }, "test-analyst-3", session.attempt.id),
    ).rejects.toThrow(/Scenario hash mismatch/);
  });

  it("enforces non-repeating seeds per user and family", async () => {
    const userId = "test-analyst-retake";
    const familyId = "soc-f-mixed-signal-01";

    // First attempt
    const session1 = await startSocSession({ repo, now }, userId, familyId);
    const attempt1 = (await repo.getSocAttempt(session1.attempt.id))!;

    // Check used seeds recorded
    const usedSeeds = await repo.listUsedSeeds(userId, familyId);
    expect(usedSeeds).toContain(attempt1.seed);

    // Complete/submit first attempt properly through engine
    await submitSocAttempt({ repo, now }, userId, session1.attempt.id);

    // Second attempt
    const session2 = await startSocSession({ repo, now }, userId, familyId);
    const attempt2 = (await repo.getSocAttempt(session2.attempt.id))!;

    expect(attempt2.id).not.toBe(attempt1.id);
    expect(attempt2.seed).not.toBe(attempt1.seed);
    expect(attempt2.scenarioHash).not.toBe(attempt1.scenarioHash);
  });
});
