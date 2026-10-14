import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";
import { startSocSession } from "@/lib/lab-engine/soc/engine";
import {
  saveSocReportDraft,
  lintSocReport,
  submitSocReport,
  getSocReportDraft,
  getSocReportGradingResult,
} from "@/lib/lab-engine/soc/report-engine";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/templates";

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

describe("SOC Report Engine - Server Actions Orchestrator", () => {
  const userId = "op-learner-1";
  const scenarioId = "soc-l1-noisy-shift";

  it("saves, updates, and retrieves drafts without leaking correctness", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const attemptId = session.attempt.id;

    const draftData = createEmptyReportData("analyst-1", "case-01", "Investigation Draft 1");
    draftData.executiveSummary = "Observed multiple anomalous alerts in shift telemetry.";
    draftData.verdict.justification = "Confirmed true positive based on multi-host correlation.";

    // Save draft
    const saved = await saveSocReportDraft(ctx, userId, attemptId, draftData);
    expect(saved.id).toBeDefined();
    expect(saved.status).toBe("draft");
    expect(saved.reportData.header.title).toBe("Investigation Draft 1");

    // Fetch draft
    const retrieved = await getSocReportDraft(ctx, userId, attemptId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(saved.id);
    expect(retrieved?.reportData.executiveSummary).toContain("Observed multiple anomalous alerts");
  });

  it("prevents unauthorized users from updating or retrieving drafts", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const attemptId = session.attempt.id;

    const draftData = createEmptyReportData("analyst-1");

    await expect(saveSocReportDraft(ctx, "evil-user", attemptId, draftData)).rejects.toThrow(
      "Forbidden: unauthorized attempt access",
    );

    await expect(getSocReportDraft(ctx, "evil-user", attemptId)).rejects.toThrow(
      "Forbidden: unauthorized attempt access",
    );
  });

  it("runs pre-submit lint and persists lint results on the draft", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const attemptId = session.attempt.id;

    const draftData = createEmptyReportData("analyst-1");
    draftData.header.title = "Short"; // Too short / empty fields trigger lint issues

    const lintResult = await lintSocReport(ctx, userId, attemptId, draftData);
    expect(lintResult.checksRun).toBeGreaterThan(0);
    expect(lintResult.valid).toBe(false);
    expect(lintResult.errors.length).toBeGreaterThan(0);

    // Verify persisted on draft
    const draft = await getSocReportDraft(ctx, userId, attemptId);
    expect(draft?.lintResults).toEqual(lintResult);
  });

  it("submits report, evaluates deterministically, and enforces ground-truth containment", async () => {
    const ctx = createMockCtx();
    const session = await startSocSession(ctx, userId, scenarioId);
    const attemptId = session.attempt.id;

    const reportData = createEmptyReportData("analyst-1", "case-01", "Final Incident Report");
    reportData.executiveSummary = "A comprehensive executive summary detailing the confirmed adversary activity.";
    reportData.verdict = {
      disposition: "true_positive",
      severity: "HIGH",
      confidence: "high",
      justification: "Correlated across EDR and firewall logs with matching C2 beaconing.",
    };
    reportData.scope = {
      affectedAssets: ["ast-ws-01"],
      affectedUsers: ["usr-jdoe"],
    };
    reportData.attackNarrative = "The attacker executed malicious script following initial access, establishing persistence.";
    reportData.escalation = {
      requiresEscalation: true,
      targetTeam: "Tier-2 Incident Response",
      urgency: "priority",
      handoffSummary: "Containment enacted on host. Escalating for deeper memory analysis.",
    };

    // Submit report
    const submitRes = await submitSocReport(ctx, userId, attemptId, reportData);
    expect(submitRes.submissionId).toBeDefined();
    expect(submitRes.gradingResult).toBeDefined();
    expect(submitRes.gradingResult.totalScore).toBeGreaterThan(0);

    // In-flight grading result contains the model report reveal
    expect(submitRes.gradingResult.modelReportReveal).toBeDefined();
    expect(submitRes.gradingResult.modelReportReveal.header).toBeDefined();

    // GROUND TRUTH CONTAINMENT: DB evaluation record must NOT contain model report
    const dbEval = await ctx.repo.getSocReportEvaluation(submitRes.submissionId);
    expect(dbEval).not.toBeNull();
    expect((dbEval as unknown as Record<string, unknown>).modelReportReveal).toBeUndefined();

    // Re-submitting is idempotent and returns the existing result
    const reSubmitRes = await submitSocReport(ctx, userId, attemptId, reportData);
    expect(reSubmitRes.submissionId).toBe(submitRes.submissionId);
    expect(reSubmitRes.gradingResult.totalScore).toBe(submitRes.gradingResult.totalScore);
    expect(reSubmitRes.gradingResult.modelReportReveal).toBeDefined();

    // Fetching grading result post-submission re-synthesizes the model report
    const fetchedResult = await getSocReportGradingResult(ctx, userId, attemptId, submitRes.submissionId);
    expect(fetchedResult).not.toBeNull();
    expect(fetchedResult?.totalScore).toBe(submitRes.gradingResult.totalScore);
    expect(fetchedResult?.modelReportReveal).toBeDefined();

    // Attempting to save new drafts after submission is blocked
    await expect(saveSocReportDraft(ctx, userId, attemptId, reportData)).rejects.toThrow(
      "Report is already submitted",
    );
  });
});
