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
  getSocHandlerContext,
} from "@/lib/lab-engine/soc/engine";

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

describe("SOC Engine Service", () => {
  const userId = "op-user-123";
  const scenarioId = "soc-l1-noisy-shift";

  it("starts a session with client-safe scenario projection and resumes active attempt", async () => {
    const ctx = createMockCtx();
    const session1 = await startSocSession(ctx, userId, scenarioId);

    expect(session1.attempt.id).toBeDefined();
    expect(session1.attempt.status).toBe("in_progress");
    // The client id is opaque (L1-A-01); the attempt still records which scenario was started.
    expect(session1.scenario.id).toMatch(/^scn-[0-9a-f]{12}$/);
    expect(session1.attempt.scenarioId).toBe(scenarioId);

    // Verify projection is safe: no groundTruth
    expect((session1.scenario as unknown as Record<string, unknown>).groundTruth).toBeUndefined();
    for (const alert of session1.scenario.alerts) {
      expect((alert as unknown as Record<string, unknown>).groundTruth).toBeUndefined();
    }

    // Starting again resumes the existing in-progress attempt
    const session2 = await startSocSession(ctx, userId, scenarioId);
    expect(session2.attempt.id).toBe(session1.attempt.id);
  });

  it("records decisions in an append-only log with XSS and formula sanitization", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const alertId = session.scenario.alerts[0].id;

    // Hostile input with XSS script tag and Excel formula injection
    const hostileRationale = "=cmd|'/c calc'!A0 <script>alert('xss')</script>Legitimate investigation notes";
    const decision = await recordSocDecision(ctx, userId, session.attempt.id, alertId, {
      disposition: "false_positive",
      severity: "LOW",
      escalate: false,
      rationale: hostileRationale,
      evidenceRefs: ["alert-001"],
    });

    expect(decision.alertId).toBe(alertId);
    // Formula prefix check
    expect(decision.rationale.startsWith("'=")).toBe(true);
    // Script tag stripped / escaped
    expect(decision.rationale).not.toContain("<script>");

    // Check append-only history in repo
    const log = await ctx.repo.listSocDecisions(session.attempt.id);
    expect(log.length).toBe(1);

    // Record an updated decision for the same alert (analyst changes mind)
    await recordSocDecision(ctx, userId, session.attempt.id, alertId, {
      disposition: "benign_true_positive",
      severity: "LOW",
      escalate: false,
      rationale: "Revising to authorized benign maintenance after checking inventory.",
    });

    const updatedLog = await ctx.repo.listSocDecisions(session.attempt.id);
    expect(updatedLog.length).toBe(2); // Both records preserved in log

    // Fetching session aggregates latest decision
    const currentSession = await getSocSession(ctx, userId, session.attempt.id);
    expect(currentSession.decisions[alertId]?.disposition).toBe("benign_true_positive");
  });

  it("enforces rationale bounds and rejects unknown alerts", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);

    // Rationale too short (< 10 chars)
    await expect(
      recordSocDecision(ctx, userId, session.attempt.id, session.scenario.alerts[0].id, {
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "short",
      }),
    ).rejects.toThrow(/at least 10 characters/);

    // Unknown alert ID
    await expect(
      recordSocDecision(ctx, userId, session.attempt.id, "alert-fake-999", {
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "Valid rationale length but fake alert.",
      }),
    ).rejects.toThrow(/not found/);
  });

  it("supports full case management lifecycle (create, update, add_alert, remove_alert, delete)", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);

    const alert1 = session.scenario.alerts[0].id;
    const alert2 = session.scenario.alerts[1].id;

    // 1. Create case
    const createRes = await manageSocCase(ctx, userId, session.attempt.id, {
      action: "create",
      title: "Suspicious PowerShell Investigation",
      severity: "HIGH",
      notes: "Initial triage notes.",
      alertIds: [alert1],
    });
    expect(createRes.success).toBe(true);
    const caseId = createRes.case!.id;

    // 2. Add alert
    await manageSocCase(ctx, userId, session.attempt.id, {
      action: "add_alert",
      caseId,
      alertId: alert2,
    });

    let cases = await ctx.repo.listSocCases(session.attempt.id);
    expect(cases[0].alertIds).toContain(alert1);
    expect(cases[0].alertIds).toContain(alert2);

    // 3. Update case details
    await manageSocCase(ctx, userId, session.attempt.id, {
      action: "update",
      caseId,
      status: "escalated",
      notes: "Escalated to Tier-2 with full evidence chain.",
    });

    cases = await ctx.repo.listSocCases(session.attempt.id);
    expect(cases[0].status).toBe("escalated");

    // 4. Remove alert
    await manageSocCase(ctx, userId, session.attempt.id, {
      action: "remove_alert",
      caseId,
      alertId: alert1,
    });
    cases = await ctx.repo.listSocCases(session.attempt.id);
    expect(cases[0].alertIds).not.toContain(alert1);
    expect(cases[0].alertIds).toContain(alert2);

    // 5. Delete case
    await manageSocCase(ctx, userId, session.attempt.id, {
      action: "delete",
      caseId,
    });
    cases = await ctx.repo.listSocCases(session.attempt.id);
    expect(cases.length).toBe(0);
  });

  it("submits attempt idempotently and awards XP only once", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);

    // Triage all alerts correctly to achieve pass
    for (const alert of session.scenario.alerts) {
      await recordSocDecision(ctx, userId, session.attempt.id, alert.id, {
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "Default test decision rationale.",
      });
    }

    const firstEval = await submitSocAttempt(ctx, userId, session.attempt.id);
    expect(firstEval).toBeDefined();

    // Verify attempt is locked
    const attempt = await ctx.repo.getSocAttempt(session.attempt.id);
    expect(attempt?.status).toBe("submitted");
    expect(attempt?.submittedAt).toBeDefined();

    // Verify decisions cannot be added to submitted attempt
    await expect(
      recordSocDecision(ctx, userId, session.attempt.id, session.scenario.alerts[0].id, {
        disposition: "true_positive",
        severity: "HIGH",
        escalate: true,
        rationale: "Trying to edit after submission.",
      }),
    ).rejects.toThrow(/closed/);

    // Replay submit: must return cached result
    const secondEval = await submitSocAttempt(ctx, userId, session.attempt.id);
    expect(secondEval.attemptId).toBe(firstEval.attemptId);
  }, 15000);

  it("proves the Handler context provider seam never leaks ground truth", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const alertId = session.scenario.alerts[0].id;

    await recordSocDecision(ctx, userId, session.attempt.id, alertId, {
      disposition: "true_positive",
      severity: "HIGH",
      escalate: true,
      rationale: "Investigating potential lateral movement.",
    });

    const handlerCtx = await getSocHandlerContext(ctx, userId, session.attempt.id, alertId);

    expect(handlerCtx.scenarioTitle).toBe(session.scenario.title);
    expect(handlerCtx.currentAlert?.id).toBe(alertId);
    expect(handlerCtx.decidedAlertsCount).toBe(1);

    // Verify deny-list of ground truth terms in serialized handler context
    const serialized = JSON.stringify(handlerCtx);
    const forbiddenKeys = [
      "groundTruth",
      "acceptableAlternatives",
      "rootCauseChain",
      "fpAsTpCount",
      "incidentResults",
    ];
    for (const key of forbiddenKeys) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });

  it("handles abandonSocAttempt gracefully", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);

    await abandonSocAttempt(ctx, userId, session.attempt.id);
    const attempt = await ctx.repo.getSocAttempt(session.attempt.id);
    expect(attempt?.status).toBe("abandoned");
  });
});
