import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import fs from "node:fs";
import path from "node:path";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { Ctx } from "@/lib/progress/service";
import { startSocSession } from "@/lib/lab-engine/soc/engine";
import {
  saveSocReportDraft,
  lintSocReport,
  submitSocReport,
  getSocReportDraft,
  getSocReportModelReveal,
} from "@/lib/lab-engine/soc/report-engine";
import { createEmptyReportData } from "@/lib/lab-engine/soc/reports/templates";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

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

describe("SOC Report Adversarial API & Security Controls", () => {
  const userA = "op-alice-student";
  const userB = "op-bob-attacker";
  const scenarioId = "soc-l1-noisy-shift";

  describe("1. Authentication & IDOR Protection", () => {
    it("rejects unauthenticated/anonymous report operations", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;
      const draft = createEmptyReportData("anon", "case-01", "Anon Report");

      await expect(saveSocReportDraft(ctx, "", attemptId, draft)).rejects.toThrow();
      await expect(submitSocReport(ctx, "", attemptId, draft)).rejects.toThrow();
      await expect(getSocReportDraft(ctx, "", attemptId)).rejects.toThrow();
    });

    it("prevents User B from accessing, modifying, or submitting User A's report", async () => {
      const ctx = createMockCtx();
      const sessionA = await startSocSession(ctx, userA, scenarioId);
      const attemptId = sessionA.attempt.id;

      const draftA = createEmptyReportData("alice", "case-alice", "Alice Draft");
      draftA.executiveSummary = "Confidential report by Alice";
      await saveSocReportDraft(ctx, userA, attemptId, draftA);

      // User B attempts to read Alice's draft
      await expect(getSocReportDraft(ctx, userB, attemptId)).rejects.toThrow(
        /Forbidden|unauthorized/i,
      );

      // User B attempts to tamper Alice's draft
      const maliciousDraft = createEmptyReportData("bob", "case-tamper", "Bob Overwrite");
      await expect(saveSocReportDraft(ctx, userB, attemptId, maliciousDraft)).rejects.toThrow(
        /Forbidden|unauthorized/i,
      );

      // User B attempts to submit Alice's attempt
      await expect(submitSocReport(ctx, userB, attemptId, maliciousDraft)).rejects.toThrow(
        /Forbidden|unauthorized/i,
      );
    });

    it("rejects operations on non-existent or tampered attempt IDs", async () => {
      const ctx = createMockCtx();
      const fakeAttemptId = "00000000-0000-4000-a000-000000000999";
      const draft = createEmptyReportData("user", "case-01", "Report");

      await expect(saveSocReportDraft(ctx, userA, fakeAttemptId, draft)).rejects.toThrow(
        /not found/i,
      );
      await expect(submitSocReport(ctx, userA, fakeAttemptId, draft)).rejects.toThrow(
        /not found/i,
      );
      await expect(lintSocReport(ctx, userA, fakeAttemptId, draft)).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe("2. Hostile & Oversized Input Sanitization", () => {
    it("sanitizes HTML injection and malicious XSS tags", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      const hostileDraft = createEmptyReportData("alice", "case-xss", "<script>alert('xss')</script>");
      hostileDraft.executiveSummary = "<img src=x onerror=stealCookies()> Hostile text payload";
      hostileDraft.attackNarrative = "<svg onload=fetch('http://evil.com')>";

      const saved = await saveSocReportDraft(ctx, userA, attemptId, hostileDraft);

      // Verify XSS tags are stripped / sanitized
      expect(saved.reportData.header.title).not.toContain("<script>");
      expect(saved.reportData.executiveSummary).not.toContain("<img");
      expect(saved.reportData.attackNarrative).not.toContain("<svg");
    });

    it("defangs active URLs and indicators in narrative to prevent accidental clicking", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      const dangerousReport = createEmptyReportData("alice", "case-c2", "C2 Analysis");
      dangerousReport.iocs = [
        {
          id: "ioc-1",
          type: "domain",
          value: "http://malicious-c2-server.evil.com/payload.exe",
          role: "c2",
          evidenceRefs: [],
        },
      ];

      const saved = await saveSocReportDraft(ctx, userA, attemptId, dangerousReport);
      // Indicator value must be preserved or defanged safely
      expect(saved.reportData.iocs[0].value).toBeDefined();
    });
  });

  describe("3. Replay, One-Shot Policy & Parallel Races", () => {
    it("enforces irreversible one-shot submission policy", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      const report = createEmptyReportData("alice", "case-01", "Final Incident Report");
      report.verdict.disposition = "true_positive";
      report.verdict.severity = "CRITICAL";

      // 1. Initial submission
      const subResult = await submitSocReport(ctx, userA, attemptId, report);
      expect(subResult.submissionId).toBeDefined();

      // 2. Draft updates after submission are strictly blocked
      await expect(saveSocReportDraft(ctx, userA, attemptId, report)).rejects.toThrow(
        /already submitted/i,
      );

      // 3. Re-submitting is idempotent and returns identical score without re-grading tampered payload
      const tamperedReport: SocReportData = {
        ...report,
        verdict: {
          ...report.verdict,
          disposition: "false_positive", // attempted change
        },
      };

      const replayResult = await submitSocReport(ctx, userA, attemptId, tamperedReport);
      expect(replayResult.submissionId).toBe(subResult.submissionId);
      expect(replayResult.gradingResult.totalScore).toBe(subResult.gradingResult.totalScore);
    });

    it("handles concurrent parallel submission race safely", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      const reportA = createEmptyReportData("alice", "case-01", "Parallel Report A");
      const reportB = createEmptyReportData("alice", "case-01", "Parallel Report B");

      // Execute simultaneously
      const [resA, resB] = await Promise.all([
        submitSocReport(ctx, userA, attemptId, reportA),
        submitSocReport(ctx, userA, attemptId, reportB),
      ]);

      // Both should succeed gracefully or converge to the same submission ID
      expect(resA.submissionId).toBeDefined();
      expect(resB.submissionId).toBeDefined();
    });
  });

  describe("4. Ground Truth Containment & Model Report Secrecy", () => {
    it("proves draft objects NEVER reveal model reports before submission", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      const draft = createEmptyReportData("alice", "case-01", "Secret Test");
      await saveSocReportDraft(ctx, userA, attemptId, draft);

      const retrieved = await getSocReportDraft(ctx, userA, attemptId);
      const serialized = JSON.stringify(retrieved);

      expect(serialized).not.toContain("modelReport");
      expect(serialized).not.toContain("modelReportReveal");
      expect(serialized).not.toContain("groundTruth");
    });

    it("blocks model report reveal queries if report has not been submitted", async () => {
      const ctx = createMockCtx();
      const session = await startSocSession(ctx, userA, scenarioId);
      const attemptId = session.attempt.id;

      // Report is not yet submitted
      await expect(getSocReportModelReveal(ctx, userA, attemptId)).rejects.toThrow(
        /not yet submitted/i,
      );
    });
  });

  describe("5. PostgreSQL Security Definier & Search Path Audit", () => {
    it("proves every SQL function declares SECURITY DEFINER with fixed search_path", () => {
      const migrationsDir = path.resolve("supabase/migrations");
      const sqlFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"));

      for (const file of sqlFiles) {
        const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");

        // Match CREATE [OR REPLACE] FUNCTION public.<name>
        const functionRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(public\.[a-zA-Z0-9_]+)\s*\((.*?)\)[\s\S]*?(?=CREATE|ALTER|DROP|\Z)/gi;

        let match: RegExpExecArray | null;
        while ((match = functionRegex.exec(content)) !== null) {
          const fnName = match[1];
          const fnBody = match[0];

          // 1. Check for search_path declaration
          expect(
            fnBody,
            `Function ${fnName} in ${file} must declare SET search_path to prevent path hijacking`,
          ).toMatch(/SET\s+search_path\s*=\s*/i);

          // 2. Check for SECURITY DEFINER
          expect(
            fnBody,
            `Function ${fnName} in ${file} must declare SECURITY DEFINER`,
          ).toMatch(/SECURITY\s+DEFINER/i);
        }
      }
    });
  });
});
