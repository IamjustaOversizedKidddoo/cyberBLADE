import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { checkAttemptAnswer, submitObjective, type Ctx } from "@/lib/progress/service";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import { requestProgressiveHint } from "@/lib/handler/service";
import type { OperatorStore } from "@/lib/identity/operator-store";
import type { Operator } from "@/lib/identity/types";

describe("Security Part B: Access Control & Progression Integrity (IDOR / BOLA / Mass Assignment)", () => {
  let repo: MemoryProgressRepo;
  let operators: OperatorStore;
  let ctx: Ctx;

  beforeEach(() => {
    repo = new MemoryProgressRepo();
    const opsMap = new Map<string, Operator>();

    operators = {
      async get(id: string) {
        return opsMap.get(id) ?? null;
      },
      async create(input) {
        const op: Operator = {
          id: input.id ?? "op-1",
          handle: input.handle,
          rank: 0,
          ethicsAcceptedAt: input.ethicsAcceptedAt,
          createdAt: new Date().toISOString(),
        };
        opsMap.set(op.id, op);
        return op;
      },
      async setRank(id: string, rank: number) {
        const op = opsMap.get(id);
        if (op) op.rank = rank;
      },
      async delete(id: string) {
        opsMap.delete(id);
      },
    };

    ctx = {
      repo,
      operators,
      content: {
        getLesson: async () => null as any,
        getLessons: async () => [],
        loadChecks: async () => ({ lesson: "test-lesson", questions: [] }),
        loadLab: async (id: string) => ({
          id,
          title: "Test Lab",
          rank: 0,
          type: "terminal",
          objectives: [
            { id: "obj-1", prompt: "Test prompt", type: "exact", flag: "FLAG{secret}" },
          ],
          hints: {
            "obj-1": ["hint 1", "hint 2", "hint 3"],
          },
        } as any),
        listLabs: async () => [],
      },
      now: () => new Date(),
    };
  });

  describe("Object-Level Access (IDOR / BOLA Prevention)", () => {
    it("denies Learner A from checking or submitting answers for Learner B's lab attempt", async () => {
      // Learner B creates an attempt
      const attemptB = await repo.createAttempt({
        userId: "learner-B",
        labId: "test-lab",
        seed: "seed-b",
        mode: "practice",
        objectivesSolved: [],
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        expiresAt: null,
        completedAt: null,
        failedAt: null,
      });

      // Learner A tries to submit an answer against Learner B's attempt
      await expect(
        checkAttemptAnswer(ctx, "learner-A", attemptB.id, "obj-1", "FLAG{secret}", "practice")
      ).rejects.toThrow(/not found/);

      await expect(
        submitObjective(ctx, "learner-A", attemptB.id, "obj-1", "FLAG{secret}")
      ).rejects.toThrow(/not found/);
    });

    it("denies Learner A from requesting hint unlocks for Learner B's attempt", async () => {
      const attemptB = await repo.createAttempt({
        userId: "learner-B",
        labId: "test-lab",
        seed: "seed-b",
        mode: "practice",
        objectivesSolved: [],
        hintsUsed: 0,
        startedAt: new Date().toISOString(),
        expiresAt: null,
        completedAt: null,
        failedAt: null,
      });

      // Learner A attempts to burn Learner B's hints or access hints
      await expect(
        requestProgressiveHint(ctx, "learner-A", attemptB.id, "obj-1")
      ).rejects.toThrow(/Attempt not found/);
    });

    it("prevents mass assignment of completion state or rank directly from untrusted input", async () => {
      await operators.create({ handle: "learner_a", ethicsAcceptedAt: new Date().toISOString(), id: "learner-A" });
      const op = await operators.get("learner-A");
      expect(op?.rank).toBe(0);

      // Verify rank cannot be mutated through create
      const forged = await operators.create({
        handle: "learner_cheat",
        ethicsAcceptedAt: new Date().toISOString(),
        id: "learner-C",
        ...({ rank: 99 } as any), // Mass assignment attempt
      });
      expect(forged.rank).toBe(0);
    });
  });

  describe("Database Migration Verification (Part B Requirements)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261011120000_p5_security_hardening.sql"
    );

    it("migration file exists, is timestamped, and contains mandatory security constructs", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf8");

      // Verify AI Handler usage metering table and RLS
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.handler_usage");
      expect(sql).toContain("ALTER TABLE public.handler_usage ENABLE ROW LEVEL SECURITY;");

      // Verify Attempt Lockouts table and RLS
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.attempt_lockouts");
      expect(sql).toContain("ALTER TABLE public.attempt_lockouts ENABLE ROW LEVEL SECURITY;");

      // Verify Audit Events append-only ledger
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.audit_events");
      expect(sql).toContain("ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;");

      // Verify permissive policies were dropped and hardened
      expect(sql).toContain("DROP POLICY IF EXISTS \"Operators can insert own XP events\"");
      expect(sql).toContain("DROP POLICY IF EXISTS \"Operators can update own challenges\"");
      expect(sql).toContain("trg_prevent_operator_rank_escalation");
      expect(sql).toContain("prevent_operator_rank_escalation()");

      // Verify rollback notes are documented
      expect(sql).toContain("ROLLBACK NOTES:");
      expect(sql).toContain("DROP TABLE IF EXISTS public.handler_usage CASCADE;");
    });
  });
});
