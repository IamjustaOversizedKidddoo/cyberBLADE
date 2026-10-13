import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createMemoryStore } from "@/lib/storage/memory-store";
import { StoreProgressRepo } from "@/lib/progress/repo";
import { emptyProgress } from "@/lib/progress/types";
import type { Ctx } from "@/lib/progress/service";
import { executeEnrichmentLookup, TARGET_EXECUTION_BASELINE_MS } from "@/lib/lab-engine/soc/enrichment/pipeline";
import type { SocAttemptRecord } from "@/lib/lab-engine/soc/types";

describe("Enrichment Pipeline & Server Execution Controls", () => {
  const userId = "test-operator-01";
  const otherUserId = "test-operator-02";
  const attemptId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  async function setupTestCtx() {
    const store = createMemoryStore(emptyProgress);
    const repo = new StoreProgressRepo(store);
    const ctx: Ctx = { repo } as unknown as Ctx;

    const attempt: SocAttemptRecord = {
      id: attemptId,
      userId,
      scenarioId: "soc-f-brute-force-auth-01",
      familyId: "soc-f-brute-force-auth-01",
      familyVersion: 1,
      generatorVersion: "1.0.0",
      difficulty: "intermediate",
      scenarioHash: "fc6534bde189f23ef5876a928e73ae4f0bb4fe18147d1327d1fad1d697faedc6",
      seed: "proof-seed-pipeline-test-001",
      status: "in_progress",
      scoreSummary: null,
      startedAt: new Date().toISOString(),
      submittedAt: null,
      updatedAt: new Date().toISOString(),
    };

    await store.update((d) => {
      d.socAttempts ??= {};
      d.socAttempts[attemptId] = attempt;
    });

    return { ctx, repo, store, attempt };
  }

  it("successfully executes deterministic lookup and records audit log", async () => {
    const { ctx, repo } = await setupTestCtx();

    const response = await executeEnrichmentLookup(
      ctx,
      userId,
      {
        attemptId,
        tool: "reputation",
        entityType: "ip",
        entityValue: "198.51.100.24",
      },
      { enforceTimingClamp: false },
    );

    expect(response.lookupId).toBeDefined();
    expect(response.attemptId).toBe(attemptId);
    expect(response.tool).toBe("reputation");
    expect(response.entityValue).toBe("198.51.100.24");
    expect(response.payload).toBeDefined();

    // Verify audit log
    const logs = await repo.listSocEnrichmentLookups(attemptId);
    expect(logs).toHaveLength(1);
    expect(logs[0].tool).toBe("reputation");
    expect(logs[0].entityValue).toBe("198.51.100.24");
    expect(logs[0].responseHash).toBeDefined();
  });

  it("deduplicates identical queries without inflating lookup count", async () => {
    const { ctx, repo } = await setupTestCtx();

    const res1 = await executeEnrichmentLookup(
      ctx,
      userId,
      {
        attemptId,
        tool: "reputation",
        entityType: "ip",
        entityValue: "198.51.100.24",
      },
      { enforceTimingClamp: false },
    );

    const res2 = await executeEnrichmentLookup(
      ctx,
      userId,
      {
        attemptId,
        tool: "reputation",
        entityType: "ip",
        entityValue: "198.51.100.24", // identical query
      },
      { enforceTimingClamp: false },
    );

    expect(res1.lookupId).toBe(res2.lookupId);
    const logs = await repo.listSocEnrichmentLookups(attemptId);
    expect(logs).toHaveLength(1);
  });

  it("enforces attempt ownership and rejects foreign requests", async () => {
    const { ctx } = await setupTestCtx();

    await expect(
      executeEnrichmentLookup(
        ctx,
        otherUserId, // unauthorized operator
        {
          attemptId,
          tool: "reputation",
          entityType: "ip",
          entityValue: "198.51.100.24",
        },
        { enforceTimingClamp: false },
      ),
    ).rejects.toThrow(/not found or not owned/i);
  });

  it("rejects lookups on submitted or abandoned attempts", async () => {
    const { ctx, store } = await setupTestCtx();

    await store.update((d) => {
      d.socAttempts![attemptId].status = "submitted";
    });

    await expect(
      executeEnrichmentLookup(
        ctx,
        userId,
        {
          attemptId,
          tool: "reputation",
          entityType: "ip",
          entityValue: "198.51.100.24",
        },
        { enforceTimingClamp: false },
      ),
    ).rejects.toThrow(/Cannot perform lookups on a submitted attempt/i);
  });

  it("enforces query budget cap per attempt", async () => {
    const { ctx } = await setupTestCtx();

    // With a cap of 2, 2 distinct lookups should succeed and 3rd should fail
    await executeEnrichmentLookup(
      ctx,
      userId,
      { attemptId, tool: "reputation", entityType: "ip", entityValue: "198.51.100.1" },
      { attemptLookupCap: 2, enforceTimingClamp: false },
    );
    await executeEnrichmentLookup(
      ctx,
      userId,
      { attemptId, tool: "reputation", entityType: "ip", entityValue: "198.51.100.2" },
      { attemptLookupCap: 2, enforceTimingClamp: false },
    );

    await expect(
      executeEnrichmentLookup(
        ctx,
        userId,
        { attemptId, tool: "reputation", entityType: "ip", entityValue: "198.51.100.3" },
        { attemptLookupCap: 2, enforceTimingClamp: false },
      ),
    ).rejects.toThrow(/budget exhausted/i);
  });

  it("enforces constant-time latency clamp profile", async () => {
    const { ctx } = await setupTestCtx();

    const start = Date.now();
    await executeEnrichmentLookup(
      ctx,
      userId,
      { attemptId, tool: "whois", entityType: "domain", entityValue: "example.corp.internal" },
      { enforceTimingClamp: true },
    );
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(TARGET_EXECUTION_BASELINE_MS - 5);
  });

  it("response payload contains zero ground-truth markers", async () => {
    const { ctx } = await setupTestCtx();

    const response = await executeEnrichmentLookup(
      ctx,
      userId,
      {
        attemptId,
        tool: "reputation",
        entityType: "ip",
        entityValue: "198.51.100.24",
      },
      { enforceTimingClamp: false },
    );

    const serialized = JSON.stringify(response.payload).toLowerCase();
    expect(serialized).not.toContain("attacker_infra");
    expect(serialized).not.toContain("groundtruth");
    expect(serialized).not.toContain("proof-seed");
  });
});
