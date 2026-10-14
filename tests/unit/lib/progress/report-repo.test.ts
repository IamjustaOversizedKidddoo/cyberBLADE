import { describe, it, expect } from "vitest";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

describe("ProgressRepo - SOC Report Persistence", () => {
  const sampleReportData: SocReportData = {
    header: {
      title: "Draft Incident Report",
      caseId: "case-01",
      analystHandle: "analyst-01",
      createdAt: "2026-10-12T10:00:00Z",
      classification: "TLP:AMBER",
    },
    executiveSummary: "Summary of confirmed incident.",
    verdict: {
      disposition: "true_positive",
      severity: "HIGH",
      confidence: "high",
      justification: "Confirmed phishing attachment",
    },
    scope: { affectedAssets: ["ast-ws-01"], affectedUsers: ["usr-jdoe"] },
    timeline: [],
    iocs: [],
    attackNarrative: "Narrative details.",
    techniques: [],
    actions: [],
    escalation: { requiresEscalation: true, urgency: "priority", handoffSummary: "Handoff details" },
    evidenceAppendix: [],
  };

  it("upserts draft report and updates existing draft in-place", async () => {
    const repo = new MemoryProgressRepo();
    const attemptId = "att-123";
    const userId = "usr-456";

    // 1. Create first draft
    const draft1 = await repo.upsertSocReportDraft({
      attemptId,
      userId,
      templateId: "incident-report-l1",
      templateVersion: "v1.0.0",
      status: "draft",
      reportData: sampleReportData,
      lintResults: null,
    });

    expect(draft1.id).toBeDefined();
    expect(draft1.status).toBe("draft");
    expect(draft1.reportData.header.title).toBe("Draft Incident Report");

    // 2. Update same draft (same attempt + template)
    const updatedData: SocReportData = {
      ...sampleReportData,
      header: { ...sampleReportData.header, title: "Updated Title" },
    };

    const draft2 = await repo.upsertSocReportDraft({
      attemptId,
      userId,
      templateId: "incident-report-l1",
      templateVersion: "v1.0.0",
      status: "draft",
      reportData: updatedData,
      lintResults: { valid: true, errors: [], warnings: [], checksRun: 5 },
    });

    expect(draft2.id).toBe(draft1.id); // Same ID, updated in place
    expect(draft2.reportData.header.title).toBe("Updated Title");
    expect(draft2.lintResults).toEqual({ valid: true, errors: [], warnings: [], checksRun: 5 });

    // 3. Fetch by ID
    const fetched = await repo.getSocReportSubmission(draft1.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.reportData.header.title).toBe("Updated Title");
  });

  it("submits report draft idempotently and lists submissions", async () => {
    const repo = new MemoryProgressRepo();
    const attemptId = "att-200";
    const userId = "usr-300";

    const draft = await repo.upsertSocReportDraft({
      attemptId,
      userId,
      templateId: "incident-report-l1",
      templateVersion: "v1.0.0",
      status: "draft",
      reportData: sampleReportData,
      lintResults: null,
    });

    // Submit
    const submitted1 = await repo.submitSocReport(draft.id);
    expect(submitted1.status).toBe("submitted");

    // Submitting again is idempotent
    const submitted2 = await repo.submitSocReport(draft.id);
    expect(submitted2.id).toBe(draft.id);
    expect(submitted2.status).toBe("submitted");

    // Listing submissions for attempt
    const list = await repo.listSocReportSubmissions(attemptId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(draft.id);
    expect(list[0].status).toBe("submitted");
  });

  it("persists evaluation idempotently by submissionId", async () => {
    const repo = new MemoryProgressRepo();
    const submissionId = "sub-500";
    const attemptId = "att-500";
    const userId = "usr-500";

    const evaluation = await repo.saveSocReportEvaluation({
      submissionId,
      attemptId,
      userId,
      rubricId: "incident-report-l1-rubric",
      rubricVersion: "1.0.0",
      graderVersion: "1.0.0",
      scoringVersion: "1.0.0",
      totalScore: 92.5,
      maxScore: 100,
      isFullyGraded: true,
      criterionResults: {},
      flags: {
        paddingDetected: false,
        fabricationDetected: false,
        contradictionsDetected: false,
        copyPasteDetected: false,
        injectionDetected: false,
      },
      versionLabel: "v1.0.0",
      computedAt: new Date().toISOString(),
    });

    expect(evaluation.id).toBeDefined();
    expect(evaluation.totalScore).toBe(92.5);

    // Fetch evaluation
    const fetched = await repo.getSocReportEvaluation(submissionId);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(evaluation.id);
    expect(fetched?.totalScore).toBe(92.5);

    // Save again is idempotent
    const savedAgain = await repo.saveSocReportEvaluation({
      ...evaluation,
      totalScore: 99.0, // should not overwrite existing
    });
    expect(savedAgain.id).toBe(evaluation.id);
    expect(savedAgain.totalScore).toBe(92.5);
  });

  it("cleans up user report submissions and evaluations on deleteUserData", async () => {
    const repo = new MemoryProgressRepo();
    const userId = "usr-del";
    const attemptId = "att-del";

    const draft = await repo.upsertSocReportDraft({
      attemptId,
      userId,
      templateId: "incident-report-l1",
      templateVersion: "v1.0.0",
      status: "draft",
      reportData: sampleReportData,
      lintResults: null,
    });

    await repo.saveSocReportEvaluation({
      submissionId: draft.id,
      attemptId,
      userId,
      rubricId: "incident-report-l1-rubric",
      rubricVersion: "1.0.0",
      graderVersion: "1.0.0",
      scoringVersion: "1.0.0",
      totalScore: 85,
      maxScore: 100,
      isFullyGraded: true,
      criterionResults: {},
      flags: {
        paddingDetected: false,
        fabricationDetected: false,
        contradictionsDetected: false,
        copyPasteDetected: false,
        injectionDetected: false,
      },
      versionLabel: "v1.0.0",
      computedAt: new Date().toISOString(),
    });

    await repo.deleteUserData(userId);

    const submissions = await repo.listSocReportSubmissions(attemptId);
    expect(submissions).toHaveLength(0);

    const evalRecord = await repo.getSocReportEvaluation(draft.id);
    expect(evalRecord).toBeNull();
  });
});
