import "server-only";
import type { Ctx } from "@/lib/progress/service";
import { resolveScenarioForAttempt } from "./engine";
import { synthesizeReportGroundTruth } from "./reports/ground-truth-synthesis";
import { lintReportDraft, type SessionEvidenceContext } from "./reports/pre-submit-lint";
import { getReportTemplate } from "./reports/templates";
import { gradeReport } from "./reports/grader";
import { sanitizeReportText } from "./reports/sanitizer";
import type {
  SocReportData,
  PreSubmitLintResult,
  GradingResult,
  IocRowData,
  TimelineRowData,
  TechniqueMappingData,
  ResponseActionData,
  EvidenceAppendixItem,
  EscalationHandoffData,
} from "./reports/types";
import type { SocReportSubmissionRecord, SocReportEvaluationRecord } from "./types";
import { recordLearningEvent } from "@/lib/analytics/learning-events";

// ---------------------------------------------------------------------------
// Internal: deep-sanitize a SocReportData before storage
// ---------------------------------------------------------------------------
function sanitizeReport(report: SocReportData): SocReportData {
  const s = sanitizeReportText;
  return {
    header: {
      title: s(report.header.title ?? ""),
      caseId: report.header.caseId,
      analystHandle: s(report.header.analystHandle ?? ""),
      createdAt: report.header.createdAt,
      classification: s(report.header.classification ?? ""),
    },
    executiveSummary: s(report.executiveSummary ?? ""),
    verdict: {
      disposition: report.verdict.disposition,
      severity: report.verdict.severity,
      confidence: report.verdict.confidence,
      justification: s(report.verdict.justification ?? ""),
    },
    scope: {
      affectedAssets: (report.scope.affectedAssets ?? []).map(s),
      affectedUsers: (report.scope.affectedUsers ?? []).map(s),
      systemsAtRisk: report.scope.systemsAtRisk ? s(report.scope.systemsAtRisk) : undefined,
      businessImpact: report.scope.businessImpact ? s(report.scope.businessImpact) : undefined,
    },
    timeline: (report.timeline ?? []).map((row: TimelineRowData) => ({
      ...row,
      description: s(row.description ?? ""),
      dataOrigin: s(row.dataOrigin ?? ""),
      evidenceRef: row.evidenceRef ? s(row.evidenceRef) : undefined,
    })),
    iocs: (report.iocs ?? []).map((ioc: IocRowData) => ({
      ...ioc,
      value: ioc.value?.trim() ?? "",
      notes: ioc.notes ? s(ioc.notes) : undefined,
    })),
    attackNarrative: s(report.attackNarrative ?? ""),
    techniques: (report.techniques ?? []).map((t: TechniqueMappingData) => ({
      ...t,
      rationale: t.rationale ? s(t.rationale) : undefined,
    })),
    actions: (report.actions ?? []).map((a: ResponseActionData) => ({
      ...a,
      rationale: s(a.rationale ?? ""),
    })),
    escalation: {
      requiresEscalation: report.escalation.requiresEscalation,
      targetTeam: report.escalation.targetTeam ? s(report.escalation.targetTeam) : undefined,
      urgency: report.escalation.urgency,
      handoffSummary: s(report.escalation.handoffSummary ?? ""),
    } satisfies EscalationHandoffData,
    lessonsLearned: report.lessonsLearned ? s(report.lessonsLearned) : undefined,
    evidenceAppendix: (report.evidenceAppendix ?? []).map((ev: EvidenceAppendixItem) => ({
      ...ev,
      label: s(ev.label ?? ""),
      annotation: ev.annotation ? s(ev.annotation) : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// Draft autosave
// ---------------------------------------------------------------------------

/**
 * Save/update a report draft. Called frequently (autosave every 10 seconds).
 * Zero correctness oracle: does NOT evaluate content.
 */
export async function saveSocReportDraft(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  reportData: SocReportData,
  templateId = "incident-report-l1",
  templateVersion = "v1.0.0",
): Promise<SocReportSubmissionRecord> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");
  if (attempt.status === "submitted") {
    throw new Error("Attempt is already submitted — draft can no longer be updated");
  }

  // Check if report for this template is already submitted
  const submissions = await ctx.repo.listSocReportSubmissions(attemptId);
  if (submissions.some((s) => s.templateId === templateId && s.status === "submitted")) {
    throw new Error("Report is already submitted — draft can no longer be updated");
  }

  const sanitized = sanitizeReport(reportData);

  return ctx.repo.upsertSocReportDraft({
    attemptId,
    userId,
    templateId,
    templateVersion,
    status: "draft",
    reportData: sanitized,
    lintResults: null,
  });
}

// ---------------------------------------------------------------------------
// Pre-submit lint  (Zero Oracle Rule: no correctness bits leak)
// ---------------------------------------------------------------------------

/**
 * Run pre-submit lint on the current draft. Returns format/completeness issues
 * and evidence-existence checks only — zero ground-truth bits.
 *
 * Also persists the lint results on the draft record so the UI can show
 * lint status without re-running.
 */
export async function lintSocReport(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  reportData: SocReportData,
  templateId = "incident-report-l1",
): Promise<PreSubmitLintResult> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");
  if (attempt.status === "submitted") throw new Error("Attempt already submitted");

  const priorSubmissions = await ctx.repo.listSocReportSubmissions(attemptId);
  if (priorSubmissions.some((s) => s.templateId === templateId && s.status === "submitted")) {
    throw new Error("Report already submitted");
  }

  const [enrichmentLookups, queryLogs] = await Promise.all([
    ctx.repo.listSocEnrichmentLookups(attemptId),
    ctx.repo.listSocQueryLogs(attemptId),
  ]);

  const scenario = await resolveScenarioForAttempt(attempt);

  // Build observed evidence sets (Zero Oracle: only checks existence, not relevance)
  const sessionContext: SessionEvidenceContext = {
    visibleAlertIds: new Set(scenario.alerts.map((a) => a.id)),
    visibleEventIds: new Set<string>(),
    visibleQueryIds: new Set(queryLogs.map((q) => q.id)),
    visibleLookupIds: new Set(enrichmentLookups.map((l) => l.id)),
  };

  const template = await getReportTemplate(templateId);
  const sanitized = sanitizeReport(reportData);
  const lintResult = lintReportDraft(sanitized, template, sessionContext);

  // Persist lint results on the draft
  await ctx.repo.upsertSocReportDraft({
    attemptId,
    userId,
    templateId,
    templateVersion: "v1.0.0",
    status: "draft",
    reportData: sanitized,
    lintResults: lintResult,
  });

  return lintResult;
}

// ---------------------------------------------------------------------------
// Report Submission  (1-shot, irreversible)
// ---------------------------------------------------------------------------

export interface SocReportSubmissionResult {
  submissionId: string;
  gradingResult: GradingResult;
}

/**
 * Submit the report for grading. Enforces 1-submission-per-attempt policy.
 * Returns the full GradingResult including the model report reveal.
 *
 * Ground-truth containment: the model report is derived at submission time
 * and returned in-flight — it is NOT persisted in the evaluation DB row.
 */
export async function submitSocReport(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  reportData: SocReportData,
  templateId = "incident-report-l1",
  templateVersion = "v1.0.0",
): Promise<SocReportSubmissionResult> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");

  // Enforce 1-shot: check for existing submitted report for this attempt+template
  const existingSubmissions = await ctx.repo.listSocReportSubmissions(attemptId);
  const alreadySubmitted = existingSubmissions.find(
    (r) => r.templateId === templateId && r.status === "submitted",
  );

  if (alreadySubmitted) {
    // Idempotent: return existing grading result
    const existingEval = await ctx.repo.getSocReportEvaluation(alreadySubmitted.id);
    if (existingEval) {
      const scenario = await resolveScenarioForAttempt(attempt);
      const groundTruth = synthesizeReportGroundTruth(
        scenario.groundTruth.incidents[0],
        scenario.alerts,
        { assets: scenario.environment.assets, users: scenario.environment.users },
      );
      return {
        submissionId: alreadySubmitted.id,
        gradingResult: _buildGradingResultFromEval(existingEval, groundTruth.modelReport),
      };
    }
    throw new Error("Report already submitted for this attempt and template");
  }

  // Sanitize
  const sanitized = sanitizeReport(reportData);

  // 1. Upsert as draft to get stable ID
  const draftRecord = await ctx.repo.upsertSocReportDraft({
    attemptId,
    userId,
    templateId,
    templateVersion,
    status: "draft",
    reportData: sanitized,
    lintResults: null,
  });

  // 2. Mark as submitted (immutable from this point)
  const submittedRecord = await ctx.repo.submitSocReport(draftRecord.id);

  // 3. Load scenario & synthesize ground truth (server-side only)
  const scenario = await resolveScenarioForAttempt(attempt);
  if (!scenario.groundTruth?.incidents?.length) {
    throw new Error("Scenario has no ground-truth incidents — cannot grade report");
  }

  const groundTruth = synthesizeReportGroundTruth(
    scenario.groundTruth.incidents[0],
    scenario.alerts,
    { assets: scenario.environment.assets, users: scenario.environment.users },
  );

  // 4. Grade
  const gradingResult = await gradeReport(submittedRecord.id, sanitized, groundTruth);

  // 5. Persist evaluation (model report NOT stored — ground-truth containment)
  const evaluationRecord: Omit<SocReportEvaluationRecord, "id"> = {
    submissionId: submittedRecord.id,
    attemptId,
    userId,
    rubricId: gradingResult.rubricId,
    rubricVersion: gradingResult.rubricVersion,
    graderVersion: gradingResult.graderVersion,
    scoringVersion: gradingResult.scoringVersion,
    totalScore: gradingResult.totalScore,
    maxScore: gradingResult.maxScore,
    isFullyGraded: gradingResult.isFullyGraded,
    criterionResults: gradingResult.criterionResults,
    flags: gradingResult.flags,
    versionLabel: gradingResult.versionLabel,
    computedAt: gradingResult.computedAt,
  };
  await ctx.repo.saveSocReportEvaluation(evaluationRecord);

  // 6. Telemetry (non-fatal)
  try {
    await recordLearningEvent(ctx, userId, "soc_report_submitted", {
      scenarioId: attempt.scenarioId,
      attemptId,
      templateId,
      totalScore: gradingResult.totalScore,
      isFullyGraded: gradingResult.isFullyGraded,
      paddingDetected: gradingResult.flags.paddingDetected,
      fabricationDetected: gradingResult.flags.fabricationDetected,
      injectionDetected: gradingResult.flags.injectionDetected,
    });
  } catch {
    // Non-fatal
  }

  return { submissionId: submittedRecord.id, gradingResult };
}

// ---------------------------------------------------------------------------
// Fetch grading result (post-submission only)
// ---------------------------------------------------------------------------

/**
 * Retrieve the grading result for a previously submitted report.
 * Re-synthesizes model report at fetch time — never returned from DB.
 */
export async function getSocReportGradingResult(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  submissionId: string,
): Promise<GradingResult | null> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");

  const submission = await ctx.repo.getSocReportSubmission(submissionId);
  if (!submission || submission.userId !== userId || submission.status !== "submitted") return null;

  const evaluation = await ctx.repo.getSocReportEvaluation(submissionId);
  if (!evaluation) return null;

  const scenario = await resolveScenarioForAttempt(attempt);
  const groundTruth = synthesizeReportGroundTruth(
    scenario.groundTruth.incidents[0],
    scenario.alerts,
    { assets: scenario.environment.assets, users: scenario.environment.users },
  );

  return _buildGradingResultFromEval(evaluation, groundTruth.modelReport);
}

/**
 * Post-submission-only model report reveal.
 * Throws if the report is not yet submitted.
 */
export async function getSocReportModelReveal(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  templateId = "incident-report-l1",
): Promise<SocReportData> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");

  const submissions = await ctx.repo.listSocReportSubmissions(attemptId);
  const submitted = submissions.find(
    (s) => s.templateId === templateId && s.status === "submitted",
  );
  if (!submitted) {
    throw new Error("Report not yet submitted: model report reveal is forbidden prior to submission");
  }

  const scenario = await resolveScenarioForAttempt(attempt);
  const groundTruth = synthesizeReportGroundTruth(
    scenario.groundTruth.incidents[0],
    scenario.alerts,
    { assets: scenario.environment.assets, users: scenario.environment.users },
  );

  return groundTruth.modelReport;
}

// ---------------------------------------------------------------------------
// Draft retrieval
// ---------------------------------------------------------------------------

/**
 * Get the current draft/submitted report record for a learner's attempt.
 * Returns null if no draft exists yet.
 */
export async function getSocReportDraft(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  templateId = "incident-report-l1",
): Promise<SocReportSubmissionRecord | null> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: unauthorized attempt access");

  const submissions = await ctx.repo.listSocReportSubmissions(attemptId);
  return submissions.find((r) => r.templateId === templateId) ?? null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _buildGradingResultFromEval(
  ev: SocReportEvaluationRecord,
  modelReport: GradingResult["modelReportReveal"],
): GradingResult {
  return {
    submissionId: ev.submissionId,
    rubricId: ev.rubricId,
    rubricVersion: ev.rubricVersion,
    graderVersion: ev.graderVersion,
    scoringVersion: ev.scoringVersion,
    totalScore: ev.totalScore,
    maxScore: ev.maxScore,
    availableGradedPoints: ev.maxScore,
    earnedGradedPoints: ev.totalScore,
    isFullyGraded: ev.isFullyGraded,
    criterionResults: ev.criterionResults,
    flags: ev.flags,
    modelReportReveal: modelReport,
    versionLabel: ev.versionLabel,
    computedAt: ev.computedAt,
  };
}
