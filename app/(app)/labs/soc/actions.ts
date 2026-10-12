"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { checkRateLimit } from "@/lib/progress/rate-limit";
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
  const operator = await requireOperator();

  const rate = checkRateLimit(`soc_start:${operator.id}`, 10, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return startSocSession(ctx, operator.id, cleanScenarioId);
}

export async function getSocSessionAction(attemptId: string): Promise<SocSessionClient> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const operator = await requireOperator();
  const ctx = getCtx();
  return getSocSession(ctx, operator.id, cleanAttemptId);
}

export async function recordSocDecisionAction(
  attemptId: string,
  alertId: string,
  input: z.infer<typeof decisionInputSchema>,
): Promise<SocDecisionRecord> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const cleanAlertId = alertIdSchema.parse(alertId);
  const cleanInput = decisionInputSchema.parse(input);

  const operator = await requireOperator();
  const rate = checkRateLimit(`soc_decide:${operator.id}`, 30, 10_000);
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
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const cleanInput = manageCaseInputSchema.parse(input);

  const operator = await requireOperator();
  const rate = checkRateLimit(`soc_case:${operator.id}`, 30, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return manageSocCase(ctx, operator.id, cleanAttemptId, cleanInput);
}

export async function submitSocAttemptAction(attemptId: string): Promise<SocEvaluationResult> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const operator = await requireOperator();

  const rate = checkRateLimit(`soc_submit:${operator.id}`, 5, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  const ctx = getCtx();
  return submitSocAttempt(ctx, operator.id, cleanAttemptId);
}

export async function abandonSocAttemptAction(attemptId: string): Promise<void> {
  const cleanAttemptId = attemptIdSchema.parse(attemptId);
  const operator = await requireOperator();
  const ctx = getCtx();
  return abandonSocAttempt(ctx, operator.id, cleanAttemptId);
}
