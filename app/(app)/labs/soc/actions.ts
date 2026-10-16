"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  startSocSession,
  getSocSession,
  recordSocDecision,
  manageSocCase,
  submitSocAttempt,
  abandonSocAttempt,
  type ManageCaseInput,
} from "@/lib/lab-engine/soc/engine";
import {
  socDispositionSchema,
  socSeveritySchema,
  socEscalationTierSchema,
} from "@/lib/lab-engine/soc/schema";
import type {
  SocSessionClient,
  SocDecisionRecord,
  SocCaseRecord,
  SocEvaluationResult,
} from "@/lib/lab-engine/soc/types";
import { isSocEnrichmentEnabled, assertSocWorkspaceEnabled } from "@/lib/config/env";
import { executeEnrichmentLookup } from "@/lib/lab-engine/soc/enrichment/pipeline";
import {
  enrichmentLookupInputSchema,
  type EnrichmentLookupInput,
  type EnrichmentLookupResponse,
  type SocEnrichmentLookupRecord,
} from "@/lib/lab-engine/soc/enrichment/types";

const scenarioIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/);
const attemptIdSchema = z.string().uuid();
const alertIdSchema = z.string().min(1).max(64);

const decisionInputSchema = z.object({
  disposition: socDispositionSchema,
  severity: socSeveritySchema,
  escalate: z.boolean(),
  targetTier: socEscalationTierSchema.optional(),
  rationale: z.string().min(10).max(1000),
  evidenceRefs: z.array(z.string().max(100)).max(20).optional(),
});

const manageCaseInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().min(1).max(120),
    severity: socSeveritySchema.optional(),
    notes: z.string().max(5000).optional(),
    alertIds: z.array(z.string().max(64)).max(100).optional(),
  }),
  z.object({
    action: z.literal("update"),
    caseId: z.string().uuid(),
    title: z.string().min(1).max(120).optional(),
    severity: socSeveritySchema.optional(),
    status: z.enum(["open", "investigating", "escalated", "closed"]).optional(),
    notes: z.string().max(5000).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    caseId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("add_alert"),
    caseId: z.string().uuid(),
    alertId: z.string().max(64),
  }),
  z.object({
    action: z.literal("remove_alert"),
    caseId: z.string().uuid(),
    alertId: z.string().max(64),
  }),
]);

export async function startSocSessionAction(scenarioId: string): Promise<SocSessionClient> {
  const cleanScenarioId = scenarioIdSchema.parse(scenarioId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();

  const rate = await rateLimit(`soc_start:${operator.id}`, 10, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return startSocSession(ctx, operator.id, cleanScenarioId);
}

export async function getSocSessionAction(attemptId: string): Promise<SocSessionClient> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return getSocSession(ctx, operator.id, cleanAttemptId);
}

export async function recordSocDecisionAction(
  attemptId: string,
  alertId: string,
  input: z.infer<typeof decisionInputSchema>,
): Promise<SocDecisionRecord> {
  assertSocWorkspaceEnabled();
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const cleanAlertId = alertIdSchema.parse(alertId);
  const cleanInput = decisionInputSchema.parse(input);

  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const rate = await rateLimit(`soc_decide:${operator.id}`, 30, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return recordSocDecision(ctx, operator.id, cleanAttemptId, cleanAlertId, cleanInput);
}

export async function manageSocCaseAction(
  attemptId: string,
  input: ManageCaseInput,
): Promise<{ success: boolean; case?: SocCaseRecord }> {
  assertSocWorkspaceEnabled();
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const cleanInput = manageCaseInputSchema.parse(input);

  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const rate = await rateLimit(`soc_case:${operator.id}`, 30, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return manageSocCase(ctx, operator.id, cleanAttemptId, cleanInput);
}

export async function submitSocAttemptAction(attemptId: string): Promise<SocEvaluationResult> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();

  const rate = await rateLimit(`soc_submit:${operator.id}`, 5, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return submitSocAttempt(ctx, operator.id, cleanAttemptId);
}

export async function abandonSocAttemptAction(attemptId: string): Promise<void> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return abandonSocAttempt(ctx, operator.id, cleanAttemptId);
}

export async function lookupSocEnrichmentAction(
  input: EnrichmentLookupInput,
): Promise<EnrichmentLookupResponse> {
  assertSocWorkspaceEnabled();
  if (!isSocEnrichmentEnabled()) {
    throw new Error("Simulated enrichment investigation tools are currently disabled.");
  }
  const cleanInput = enrichmentLookupInputSchema.parse(input);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return executeEnrichmentLookup(ctx, operator.id, cleanInput);
}

export async function listSocEnrichmentLookupsAction(
  attemptId: string,
): Promise<SocEnrichmentLookupRecord[]> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  const attempts = await ctx.repo.listSocAttempts(operator.id);
  if (!attempts.some((a) => a.id === cleanAttemptId)) {
    throw new Error("Attempt not found or access denied.");
  }
  return ctx.repo.listSocEnrichmentLookups(cleanAttemptId);
}

// ---------------------------------------------------------------------------
// Phase 3 Prompt 6: SOC Report System Server Actions
// ---------------------------------------------------------------------------
import {
  saveSocReportDraft,
  submitSocReport,
  getSocReportDraft,
  getSocReportGradingResult,
  getSocReportModelReveal,
  type SocReportSubmissionResult,
} from "@/lib/lab-engine/soc/report-engine";
import type { SocReportData, GradingResult } from "@/lib/lab-engine/soc/reports/types";
import { reportTemplateIdSchema, socReportDataSchema } from "@/lib/lab-engine/soc/reports/report-schema";
import type { SocReportSubmissionRecord } from "@/lib/lab-engine/soc/types";
import { enqueueAiGradingAfterSubmit } from "./ai-schedule";

export async function saveSocReportDraftAction(
  attemptId: string,
  reportData: SocReportData,
  templateId = "incident-report-l1",
): Promise<SocReportSubmissionRecord> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const rate = await rateLimit(`soc_report_draft:${operator.id}`, 60, 60_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }
  const ctx = getCtx();
  return saveSocReportDraft(ctx, operator.id, cleanAttemptId, socReportDataSchema.parse(reportData) as SocReportData, reportTemplateIdSchema.parse(templateId));
}

export async function submitSocReportAction(
  attemptId: string,
  reportData: SocReportData,
  templateId = "incident-report-l1",
): Promise<SocReportSubmissionResult> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const rate = await rateLimit(`soc_report_submit:${operator.id}`, 10, 60_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }
  const ctx = getCtx();
  const result = await submitSocReport(ctx, operator.id, cleanAttemptId, socReportDataSchema.parse(reportData) as SocReportData, reportTemplateIdSchema.parse(templateId));
  // Prompt 7: optional AI feedback on communication criteria (no-op while mode is off).
  await enqueueAiGradingAfterSubmit(result.submissionId);
  return result;
}

export async function getSocReportDraftAction(
  attemptId: string,
  templateId = "incident-report-l1",
): Promise<SocReportSubmissionRecord | null> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return getSocReportDraft(ctx, operator.id, cleanAttemptId, templateId);
}

export async function getSocReportResultAction(
  attemptId: string,
  submissionId: string,
): Promise<GradingResult | null> {
  assertSocWorkspaceEnabled();
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const cleanSubmissionId = z.string().uuid().parse(submissionId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return getSocReportGradingResult(ctx, operator.id, cleanAttemptId, cleanSubmissionId);
}

export async function getSocReportModelRevealAction(
  attemptId: string,
  templateId = "incident-report-l1",
): Promise<SocReportData> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  assertSocWorkspaceEnabled();
  const operator = await requireOperator();
  const ctx = getCtx();
  return getSocReportModelReveal(ctx, operator.id, cleanAttemptId, templateId);
}
