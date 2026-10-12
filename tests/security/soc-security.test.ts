import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";
import {
  startSocSession,
  getSocSession,
  recordSocDecision,
  manageSocCase,
  submitSocAttempt,
  abandonSocAttempt,
  loadSocScenario,
} from "@/lib/lab-engine/soc/engine";
import { toClientView } from "@/lib/lab-engine/soc/schema";

function createMockCtx(): Ctx {
  const repo = new MemoryProgressRepo();
  const simulatedTime = new Date("2026-10-12T10:00:00Z");
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

describe("SOC Security Suite: Adversarial & Anti-Cheat Controls", () => {
  const scenarioId = "soc-l1-noisy-shift";
  const userA = "op-user-alice";
  const userB = "op-user-bob-attacker";

  describe("IDOR & Cross-User Tamper Prevention", () => {
    it("blocks User B from reading User A's session attempt", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);

      // User B attempts to access User A's attemptId
      await expect(getSocSession(ctx, userB, sessionA.attempt.id)).rejects.toThrow(
        /Forbidden|Unauthorized/i,
      );
    });

    it("blocks User B from recording decisions on User A's attempt", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);
      const alertId = sessionA.scenario.alerts[0].id;

      await expect(
        recordSocDecision(ctx, userB, sessionA.attempt.id, alertId, {
          disposition: "true_positive",
          severity: "HIGH",
          escalate: true,
          rationale: "Attacker tampering with Alice's queue.",
        }),
      ).rejects.toThrow(/Forbidden|belong to operator/i);
    });

    it("blocks User B from managing cases on User A's attempt", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);

      await expect(
        manageSocCase(ctx, userB, sessionA.attempt.id, {
          action: "create",
          title: "Malicious Case Insertion",
        }),
      ).rejects.toThrow(/Forbidden|belong to operator/i);
    });

    it("blocks User B from submitting User A's attempt", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);

      await expect(submitSocAttempt(ctx, userB, sessionA.attempt.id)).rejects.toThrow(
        /Forbidden|belong to operator/i,
      );
    });

    it("blocks User B from abandoning User A's attempt", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);

      await expect(abandonSocAttempt(ctx, userB, sessionA.attempt.id)).rejects.toThrow(
        /Forbidden|belong to operator/i,
      );
    });
  });

  describe("Attempt Lifecycle & State Machine Invariants", () => {
    it("rejects decisions on submitted attempts", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);

      // Submit attempt
      await submitSocAttempt(ctx, userA, session.attempt.id);

      // Attempt to add decision to closed attempt
      await expect(
        recordSocDecision(ctx, userA, session.attempt.id, session.scenario.alerts[0].id, {
          disposition: "true_positive",
          severity: "CRITICAL",
          escalate: true,
          rationale: "Late tamper attempt after submit.",
        }),
      ).rejects.toThrow(/closed/i);
    });

    it("rejects decisions on abandoned attempts", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);

      // Abandon attempt
      await abandonSocAttempt(ctx, userA, session.attempt.id);

      await expect(
        recordSocDecision(ctx, userA, session.attempt.id, session.scenario.alerts[0].id, {
          disposition: "true_positive",
          severity: "CRITICAL",
          escalate: true,
          rationale: "Tamper attempt on abandoned session.",
        }),
      ).rejects.toThrow(/closed/i);
    });

    it("submission is strictly idempotent and does not award duplicate XP", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);

      const firstResult = await submitSocAttempt(ctx, userA, session.attempt.id);
      const firstXp = await ctx.repo.getXpTotal(userA);

      // Replay submit call
      const secondResult = await submitSocAttempt(ctx, userA, session.attempt.id);
      const secondXp = await ctx.repo.getXpTotal(userA);

      expect(secondResult.attemptId).toBe(firstResult.attemptId);
      expect(secondXp).toBe(firstXp); // XP was not duplicated
    });
  });

  describe("Hostile Input Injection & Sanitization", () => {
    it("sanitizes script tags from rationale and case notes", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const alertId = session.scenario.alerts[0].id;

      const hostileXss = "Investigation note <script>fetch('http://evil.example')</script> complete.";
      const decision = await recordSocDecision(ctx, userA, session.attempt.id, alertId, {
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: hostileXss,
      });

      expect(decision.rationale).not.toContain("<script>");
      expect(decision.rationale).not.toContain("</script>");

      // Verify case notes sanitization
      const caseRes = await manageSocCase(ctx, userA, session.attempt.id, {
        action: "create",
        title: "XSS Test Case",
        notes: "<script>alert('pwn')</script>Valid notes body",
      });

      expect(caseRes.case?.notes).not.toContain("<script>");
    });

    it("neutralizes Excel/CSV formula injection prefixes (=, +, -, @)", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const alertId = session.scenario.alerts[0].id;

      const formulaInjection = "=1+1; cmd|'/c calc'!A0";
      const decision = await recordSocDecision(ctx, userA, session.attempt.id, alertId, {
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: formulaInjection,
      });

      // Must be prefixed with a single quote to neutralize spreadsheet execution
      expect(decision.rationale.startsWith("'=")).toBe(true);
    });

    it("rejects rationale exceeding maximum size limit (1000 characters)", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const alertId = session.scenario.alerts[0].id;

      const oversized = "A".repeat(1001);
      await expect(
        recordSocDecision(ctx, userA, session.attempt.id, alertId, {
          disposition: "false_positive",
          severity: "LOW",
          escalate: false,
          rationale: oversized,
        }),
      ).rejects.toThrow(/exceeds 1000 characters/i);
    });
  });

  describe("Zero-Knowledge Ground Truth Client Boundary", () => {
    it("guarantees client projection contains ZERO ground truth keys or values", async () => {
      const rawScenario = await loadSocScenario(scenarioId);
      const clientView = toClientView(rawScenario);
      const serialized = JSON.stringify(clientView);

      // Strict deny-list of ground truth identifiers
      const forbiddenTokens = [
        "groundTruth",
        "correctDisposition",
        "correctSeverity",
        "correctEscalation",
        "acceptableAlternatives",
        "rootCauseChain",
        "fpAsTpCount",
        "overallDebrief",
      ];

      for (const token of forbiddenTokens) {
        expect(serialized).not.toContain(`"${token}"`);
      }

      // Check alert objects individually
      for (const alert of clientView.alerts) {
        expect((alert as unknown as Record<string, unknown>).groundTruth).toBeUndefined();
        expect((alert as unknown as Record<string, unknown>).debrief).toBeUndefined();
      }
    });
  });
});
