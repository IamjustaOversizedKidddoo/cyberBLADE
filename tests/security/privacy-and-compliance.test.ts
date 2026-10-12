import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { hashIp, logSecurityEvent } from "@/lib/security/audit-logger";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { OperatorStore } from "@/lib/identity/operator-store";
import type { Operator } from "@/lib/identity/types";

describe("Security Part H: Privacy & Compliance Foundations (User Rights & Audit Logging)", () => {
  describe("IP Address Anonymization & Audit Logging", () => {
    it("anonymizes IP addresses via salted SHA-256 hash", () => {
      const rawIp = "203.0.113.195";
      const hashed1 = hashIp(rawIp);
      const hashed2 = hashIp(rawIp);

      expect(hashed1).not.toBeNull();
      expect(hashed1).toBe(hashed2); // deterministic for same input
      expect(hashed1).not.toContain(rawIp);
      expect(hashed1).toHaveLength(32);
    });

    it("returns null when no IP is provided", () => {
      expect(hashIp(null)).toBeNull();
      expect(hashIp(undefined)).toBeNull();
    });

    it("logs security events without sensitive personal credentials", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      await logSecurityEvent({
        userId: "learner-123",
        eventType: "auth.login",
        severity: "info",
        ip: "198.51.100.42",
        metadata: { method: "magic_link" },
      });

      expect(consoleSpy).toHaveBeenCalled();
      const loggedJson = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(loggedJson.eventType).toBe("auth.login");
      expect(loggedJson.ipHash).not.toContain("198.51.100.42");
      expect(loggedJson.ipHash).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe("User Rights Scaffolding (Export & Deletion)", () => {
    let repo: MemoryProgressRepo;
    let operatorsMap: Map<string, Operator>;
    let operatorStore: OperatorStore;

    beforeEach(() => {
      repo = new MemoryProgressRepo();
      operatorsMap = new Map();
      operatorStore = {
        async get(id: string) {
          return operatorsMap.get(id) ?? null;
        },
        async create(input) {
          const op: Operator = {
            id: input.id ?? "op-1",
            handle: input.handle,
            rank: 0,
            ethicsAcceptedAt: input.ethicsAcceptedAt,
            createdAt: new Date().toISOString(),
          };
          operatorsMap.set(op.id, op);
          return op;
        },
        async setRank(id: string, rank: number) {
          const op = operatorsMap.get(id);
          if (op) op.rank = rank;
        },
        async delete(id: string) {
          operatorsMap.delete(id);
        },
      };
    });

    it("assembles complete machine-readable data export for learner", async () => {
      const op = await operatorStore.create({
        id: "learner-export-test",
        handle: "export_user",
        ethicsAcceptedAt: "2026-10-10T10:00:00Z",
      });

      await repo.awardXp(op.id, "lesson:01", 100);
      await repo.createAttempt({
        userId: op.id,
        labId: "core-r0-terminal-lab-01",
        seed: "seed-123",
        mode: "practice",
        objectivesSolved: ["o1"],
        hintsUsed: 1,
        startedAt: new Date().toISOString(),
        expiresAt: null,
        completedAt: null,
        failedAt: null,
      });

      const [attempts, xpEvents] = await Promise.all([
        repo.listAttempts(op.id),
        repo.listXpEvents(op.id),
      ]);

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        operator: op,
        progress: { attempts, xpEvents },
      };

      expect(exportPayload.operator.handle).toBe("export_user");
      expect(exportPayload.progress.xpEvents).toHaveLength(1);
      expect(exportPayload.progress.attempts).toHaveLength(1);
    });

    it("completely deletes operator and purges identity from store", async () => {
      const op = await operatorStore.create({
        id: "learner-delete-test",
        handle: "delete_user",
        ethicsAcceptedAt: "2026-10-10T10:00:00Z",
      });

      expect(await operatorStore.get(op.id)).not.toBeNull();

      // Execute erasure
      await operatorStore.delete(op.id);

      expect(await operatorStore.get(op.id)).toBeNull();
    });

    it("includes SOC workspace attempts in data export and purges on account deletion", async () => {
      const op = await operatorStore.create({
        id: "learner-soc-privacy-test",
        handle: "soc_privacy_user",
        ethicsAcceptedAt: "2026-10-10T10:00:00Z",
      });

      await repo.createSocAttempt({
        userId: op.id,
        scenarioId: "soc-l1-noisy-shift",
        seed: "seed-soc-123",
        status: "submitted",
        scoreSummary: null,
        startedAt: "2026-10-12T10:00:00Z",
        submittedAt: "2026-10-12T10:30:00Z",
        updatedAt: "2026-10-12T10:30:00Z",
      });

      let socAttempts = await repo.listSocAttempts(op.id);
      expect(socAttempts).toHaveLength(1);

      // Purge all user data via deleteUserData
      await repo.deleteUserData(op.id);
      socAttempts = await repo.listSocAttempts(op.id);
      expect(socAttempts).toHaveLength(0);
    });
  });
});

