import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { randomUUID } from "node:crypto";
import type { Ctx } from "@/lib/progress/service";
import { socScenarioSchema, toClientView, type SocScenario } from "./schema";
import { validateSocScenario } from "./validator";
import { evaluateSocAttempt } from "./evaluator";
import { recordLearningEvent } from "@/lib/analytics/learning-events";
import type {
  SocAttemptRecord,
  SocDecisionRecord,
  SocCaseRecord,
  SocSessionClient,
  SocEvaluationResult,
} from "./types";

export type ManageCaseInput =
  | { action: "create"; title: string; severity?: SocCaseRecord["severity"]; notes?: string; alertIds?: string[] }
  | { action: "update"; caseId: string; title?: string; severity?: SocCaseRecord["severity"]; status?: SocCaseRecord["status"]; notes?: string }
  | { action: "delete"; caseId: string }
  | { action: "add_alert"; caseId: string; alertId: string }
  | { action: "remove_alert"; caseId: string; alertId: string };

function sanitizeText(input: string): string {
  // Strip dangerous script tags, handle CSV injection prefix
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/[<>]/g, (char) => (char === "<" ? "&lt;" : "&gt;"));

  // Formula injection defense (leading =, +, -, @)
  if (/^[=+\-@]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  return sanitized;
}

export async function loadSocScenario(scenarioId: string): Promise<SocScenario> {
  const filePath = path.resolve(`content/soc/scenarios/${scenarioId}.yaml`);
  const rawContent = await fs.readFile(filePath, "utf8");
  const parsed = parseYaml(rawContent);

  const validation = validateSocScenario(parsed, `${scenarioId}.yaml`);
  if (!validation.valid) {
    throw new Error(`Scenario validation failed: ${validation.errors.join("; ")}`);
  }

  return socScenarioSchema.parse(parsed);
}

import { socFamilySchema, type SocFamily, type DifficultyLevel } from "./family-schema";
import { shiftProfileSchema, type ShiftProfile } from "./shift-schema";
import { generateSocVariant, computeScenarioHash, GENERATOR_VERSION } from "./generator";
import { composeShiftScenario } from "./shift-composer";
import { newSeed } from "@/lib/generators/rng";

export async function loadSocFamily(familyId: string): Promise<SocFamily> {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const rawContent = await fs.readFile(filePath, "utf8");
  const parsed = parseYaml(rawContent);
  const result = socFamilySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Family validation failed: ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
}

export async function loadSocShift(shiftId: string): Promise<ShiftProfile> {
  const filePath = path.resolve(`content/soc/shifts/${shiftId}.yaml`);
  const rawContent = await fs.readFile(filePath, "utf8");
  const parsed = parseYaml(rawContent);
  const result = shiftProfileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Shift validation failed: ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
}

export async function resolveScenarioForAttempt(attempt: SocAttemptRecord): Promise<SocScenario> {
  if (attempt.scenarioId.startsWith("shift-") || (attempt.familyId && attempt.familyId.startsWith("shift-"))) {
    const shiftId = attempt.familyId ?? attempt.scenarioId;
    const shiftProfile = await loadSocShift(shiftId);
    return composeShiftScenario(shiftProfile, attempt.seed);
  }
  if (attempt.familyId || attempt.scenarioId.startsWith("soc-f-")) {
    const familyId = attempt.familyId ?? attempt.scenarioId;
    const family = await loadSocFamily(familyId);
    const difficulty = (attempt.difficulty as DifficultyLevel) ?? "intermediate";
    const { scenario, contentHash } = generateSocVariant(family, attempt.seed, difficulty);
    if (attempt.scenarioHash && contentHash !== attempt.scenarioHash) {
      throw new Error(`Scenario hash mismatch for attempt ${attempt.id}: expected ${attempt.scenarioHash}, got ${contentHash}`);
    }
    return scenario;
  }
  return loadSocScenario(attempt.scenarioId);
}

export async function startSocSession(
  ctx: Ctx,
  userId: string,
  scenarioId: string,
  options?: { difficulty?: DifficultyLevel },
): Promise<SocSessionClient> {
  const isFamily = scenarioId.startsWith("soc-f-");
  const isShift = scenarioId.startsWith("shift-");
  let attempt = await ctx.repo.findActiveSocAttempt(userId, scenarioId);
  let scenario: SocScenario;

  if (!attempt) {
    if (isShift) {
      const shiftProfile = await loadSocShift(scenarioId);
      const usedSeeds = (await ctx.repo.listUsedSeeds(userId, shiftProfile.id)) ?? [];
      let seed = newSeed();
      let rollCount = 0;
      while (usedSeeds.includes(seed) && rollCount < 10) {
        seed = newSeed();
        rollCount++;
      }
      await ctx.repo.recordUsedSeed(userId, shiftProfile.id, seed);

      scenario = composeShiftScenario(shiftProfile, seed);
      const contentHash = computeScenarioHash(scenario);

      attempt = await ctx.repo.createSocAttempt({
        userId,
        scenarioId,
        seed,
        status: "in_progress",
        scoreSummary: null,
        startedAt: ctx.now().toISOString(),
        submittedAt: null,
        updatedAt: ctx.now().toISOString(),
        familyId: shiftProfile.id,
        familyVersion: shiftProfile.version,
        generatorVersion: GENERATOR_VERSION,
        difficulty: shiftProfile.difficulty,
        scenarioHash: contentHash,
      });
    } else if (isFamily) {
      const family = await loadSocFamily(scenarioId);
      const difficulty = options?.difficulty ?? "intermediate";

      // Seed policy: non-repeating per (user, family)
      const usedSeeds = (await ctx.repo.listUsedSeeds(userId, family.metadata.id)) ?? [];
      let seed = newSeed();
      let rollCount = 0;
      while (usedSeeds.includes(seed) && rollCount < 10) {
        seed = newSeed();
        rollCount++;
      }
      await ctx.repo.recordUsedSeed(userId, family.metadata.id, seed);

      const { scenario: genScenario, contentHash } = generateSocVariant(family, seed, difficulty);
      scenario = genScenario;

      attempt = await ctx.repo.createSocAttempt({
        userId,
        scenarioId,
        seed,
        status: "in_progress",
        scoreSummary: null,
        startedAt: ctx.now().toISOString(),
        submittedAt: null,
        updatedAt: ctx.now().toISOString(),
        familyId: family.metadata.id,
        familyVersion: family.metadata.version,
        generatorVersion: GENERATOR_VERSION,
        difficulty,
        scenarioHash: contentHash,
      });
    } else {
      scenario = await loadSocScenario(scenarioId);
      attempt = await ctx.repo.createSocAttempt({
        userId,
        scenarioId,
        seed: randomUUID(),
        status: "in_progress",
        scoreSummary: null,
        startedAt: ctx.now().toISOString(),
        submittedAt: null,
        updatedAt: ctx.now().toISOString(),
      });
    }
  } else {
    scenario = await resolveScenarioForAttempt(attempt);
  }

  const [rawDecisions, cases] = await Promise.all([
    ctx.repo.listSocDecisions(attempt.id),
    ctx.repo.listSocCases(attempt.id),
  ]);

  // Aggregate latest decision per alertId
  const activeDecisions: Record<string, SocDecisionRecord> = {};
  for (const d of rawDecisions) {
    activeDecisions[d.alertId] = d;
  }

  return {
    attempt: {
      id: attempt.id,
      scenarioId: attempt.scenarioId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    },
    scenario: toClientView(scenario),
    decisions: activeDecisions,
    cases,
    results: attempt.scoreSummary,
  };
}

export async function getSocSession(
  ctx: Ctx,
  userId: string,
  attemptId: string,
): Promise<SocSessionClient> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: Unauthorized attempt access");

  const scenario = await resolveScenarioForAttempt(attempt);
  const [rawDecisions, cases] = await Promise.all([
    ctx.repo.listSocDecisions(attempt.id),
    ctx.repo.listSocCases(attempt.id),
  ]);

  const activeDecisions: Record<string, SocDecisionRecord> = {};
  for (const d of rawDecisions) {
    activeDecisions[d.alertId] = d;
  }

  return {
    attempt: {
      id: attempt.id,
      scenarioId: attempt.scenarioId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    },
    scenario: toClientView(scenario),
    decisions: activeDecisions,
    cases,
    results: attempt.scoreSummary,
  };
}

export async function recordSocDecision(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  alertId: string,
  input: {
    disposition: SocDecisionRecord["disposition"];
    severity: SocDecisionRecord["severity"];
    escalate: boolean;
    targetTier?: SocDecisionRecord["targetTier"];
    rationale: string;
    evidenceRefs?: string[];
  },
): Promise<SocDecisionRecord> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: Attempt does not belong to operator");
  if (attempt.status !== "in_progress") throw new Error("Attempt is already closed");

  const scenario = await loadSocScenario(attempt.scenarioId);
  if (!scenario.alerts.some((a) => a.id === alertId)) {
    throw new Error(`Alert '${alertId}' not found in scenario`);
  }

  const rationale = sanitizeText(input.rationale.trim());
  if (rationale.length < 10) {
    throw new Error("Rationale must be at least 10 characters explaining your triage decision");
  }
  if (rationale.length > 1000) {
    throw new Error("Rationale exceeds 1000 characters limit");
  }

  const evidenceRefs = (input.evidenceRefs ?? []).slice(0, 20).map(sanitizeText);

  const decision = await ctx.repo.saveSocDecision({
    attemptId,
    alertId,
    disposition: input.disposition,
    severity: input.severity,
    escalate: input.escalate,
    targetTier: input.targetTier ?? null,
    rationale,
    evidenceRefs,
    createdAt: ctx.now().toISOString(),
  });

  try {
    await recordLearningEvent(ctx, userId, "soc_alert_decided", {
      scenarioId: attempt.scenarioId,
      alertId,
      disposition: input.disposition,
      severity: input.severity,
      escalate: input.escalate,
      targetTier: input.targetTier,
    });
  } catch {
    // Non-fatal telemetry recording
  }

  return decision;
}

export async function manageSocCase(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  input: ManageCaseInput,
): Promise<{ success: boolean; case?: SocCaseRecord }> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: Attempt does not belong to operator");
  if (attempt.status !== "in_progress") throw new Error("Attempt is already closed");

  if (input.action === "create") {
    const title = sanitizeText(input.title.trim());
    if (!title) throw new Error("Case title is required");
    const notes = input.notes ? sanitizeText(input.notes) : "";
    const created = await ctx.repo.saveSocCase({
      attemptId,
      title,
      severity: input.severity ?? "MEDIUM",
      status: "open",
      notes,
      alertIds: input.alertIds ?? [],
    });
    return { success: true, case: created };
  }

  const existingCases = await ctx.repo.listSocCases(attemptId);
  const targetCase = existingCases.find((c) => c.id === ("caseId" in input ? input.caseId : ""));
  if (!targetCase) throw new Error("Case not found");

  if (input.action === "delete") {
    await ctx.repo.deleteSocCase(input.caseId);
    return { success: true };
  }

  if (input.action === "update") {
    const updated = await ctx.repo.saveSocCase({
      ...targetCase,
      title: input.title ? sanitizeText(input.title) : targetCase.title,
      severity: input.severity ?? targetCase.severity,
      status: input.status ?? targetCase.status,
      notes: input.notes !== undefined ? sanitizeText(input.notes) : targetCase.notes,
    });
    return { success: true, case: updated };
  }

  if (input.action === "add_alert") {
    const set = new Set(targetCase.alertIds);
    set.add(input.alertId);
    const updated = await ctx.repo.saveSocCase({
      ...targetCase,
      alertIds: Array.from(set),
    });
    return { success: true, case: updated };
  }

  if (input.action === "remove_alert") {
    const set = new Set(targetCase.alertIds);
    set.delete(input.alertId);
    const updated = await ctx.repo.saveSocCase({
      ...targetCase,
      alertIds: Array.from(set),
    });
    return { success: true, case: updated };
  }

  return { success: false };
}

export async function submitSocAttempt(
  ctx: Ctx,
  userId: string,
  attemptId: string,
): Promise<SocEvaluationResult> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: Attempt does not belong to operator");

  // Idempotent return if already submitted
  if (attempt.status === "submitted" && attempt.scoreSummary) {
    return attempt.scoreSummary;
  }

  const scenario = await resolveScenarioForAttempt(attempt);
  const [decisions, cases] = await Promise.all([
    ctx.repo.listSocDecisions(attempt.id),
    ctx.repo.listSocCases(attempt.id),
  ]);

  const submittedAt = ctx.now().toISOString();
  const evaluation = evaluateSocAttempt(attempt.id, scenario, decisions, cases, submittedAt);

  // Lock attempt and store scorecard
  await ctx.repo.updateSocAttempt(attempt.id, {
    status: "submitted",
    submittedAt,
    scoreSummary: evaluation,
  });

  // Idempotent XP award if passed (150 XP for demo scenario)
  if (evaluation.passed) {
    await ctx.repo.awardXp(userId, `soc_scenario:${scenario.id}`, 150);
  }

  try {
    await recordLearningEvent(ctx, userId, "soc_attempt_submitted", {
      scenarioId: attempt.scenarioId,
      percentage: evaluation.percentage,
      passed: evaluation.passed,
      alertsDecided: evaluation.alertsDecided,
      incidentsFound: evaluation.incidents.filter((i) => i.detected).length,
      incidentsTotal: evaluation.incidents.length,
    });
  } catch {
    // Non-fatal telemetry recording
  }

  return evaluation;
}

export async function abandonSocAttempt(
  ctx: Ctx,
  userId: string,
  attemptId: string,
): Promise<void> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.userId !== userId) throw new Error("Forbidden: Attempt does not belong to operator");
  if (attempt.status !== "in_progress") return;

  await ctx.repo.updateSocAttempt(attemptId, {
    status: "abandoned",
  });
}

/**
 * Typed context provider seam for the future Handler in SOC mode.
 * Supplies current alert context and learner's triaged decisions
 * WITHOUT exposing any ground-truth answers or secret debrief text.
 */
export async function getSocHandlerContext(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  currentAlertId?: string,
): Promise<{
  scenarioTitle: string;
  scenarioLevel: string;
  totalAlerts: number;
  decidedAlertsCount: number;
  currentAlert?: {
    id: string;
    source: string;
    ruleName: string;
    severity: string;
    summary: string;
    relatedAsset?: string;
    relatedUser?: string;
  };
  activeDecisionsSummary: Array<{
    alertId: string;
    disposition: string;
    severity: string;
    escalate: boolean;
  }>;
}> {
  const attempt = await ctx.repo.getSocAttempt(attemptId);
  if (!attempt || attempt.userId !== userId) {
    throw new Error("Unauthorized handler context access");
  }

  const scenario = await loadSocScenario(attempt.scenarioId);
  const decisions = await ctx.repo.listSocDecisions(attempt.id);

  const clientView = toClientView(scenario);
  const currentAlert = currentAlertId
    ? clientView.alerts.find((a) => a.id === currentAlertId)
    : undefined;

  return {
    scenarioTitle: scenario.title,
    scenarioLevel: scenario.level,
    totalAlerts: scenario.alerts.length,
    decidedAlertsCount: new Set(decisions.map((d) => d.alertId)).size,
    currentAlert: currentAlert
      ? {
          id: currentAlert.id,
          source: currentAlert.source,
          ruleName: currentAlert.ruleName,
          severity: currentAlert.severity,
          summary: currentAlert.summary,
          relatedAsset: currentAlert.relatedAsset,
          relatedUser: currentAlert.relatedUser,
        }
      : undefined,
    activeDecisionsSummary: decisions.map((d) => ({
      alertId: d.alertId,
      disposition: d.disposition,
      severity: d.severity,
      escalate: d.escalate,
    })),
  };
}
