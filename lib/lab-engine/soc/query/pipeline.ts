import "server-only";
import { z } from "zod";
import type { Ctx } from "@/lib/progress/service";
import { rateLimit } from "@/lib/security/rate-limit";
import { resolveScenarioForAttempt } from "../engine";
import { executeBladeQL } from "./engine";
import { BLADEQL_VERSION } from "./ast";
import type { BladeQLEvent, QueryExecutionResult } from "./types";
import { investigationDataset } from "./investigation-dataset";
import type { SocAttemptRecord } from "../types";
import { reserveExamBudget } from "../exam/guard";

export const queryInputSchema = z.object({
  attemptId: z.string().min(1),
  query: z.string().min(1).max(4000),
  timeRange: z
    .object({
      earliestEpochMs: z.number().optional(),
      latestEpochMs: z.number().optional(),
    })
    .optional(),
});

export type QueryInput = z.infer<typeof queryInputSchema>;

export interface QueryResponse {
  result: QueryExecutionResult;
  logId?: string;
}

export async function executeInvestigationQuery(
  ctx: Ctx,
  userId: string,
  rawInput: QueryInput,
): Promise<QueryResponse> {
  const input = queryInputSchema.parse(rawInput);

  // 1. Attempt verification & ownership check
  const allAttempts = await ctx.repo.listSocAttempts(userId);
  const attempt = allAttempts.find((a) => a.id === input.attemptId);

  if (!attempt) {
    throw new Error("Attempt not found or not owned by user.");
  }

  if (attempt.status !== "in_progress") {
    throw new Error(`Cannot run investigation queries on an attempt with status '${attempt.status}'.`);
  }

  // 2. Rate limiting (60 queries per minute per user)
  const rate = await rateLimit(`soc_query_min:${userId}`, 60, 60_000);
  if (!rate.allowed) {
    throw new Error(`Query rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  // Exam attempts: deadline and per-exam search budget (no-op for practice).
  const release = await reserveExamBudget(ctx, attempt, "queries");
  try {
    return await runQuery(ctx, userId, input, attempt);
  } finally {
    release();
  }
}

async function runQuery(ctx: Ctx, userId: string, input: QueryInput, attempt: SocAttemptRecord): Promise<QueryResponse> {
  // 3. Resolve scenario deterministically
  const scenario = await resolveScenarioForAttempt(attempt);

  // 4. Generate or retrieve cached dataset for this scenario variant
  const dataset = investigationDataset(scenario, attempt.seed);

  // 5. Build static asset & identity context for lookup command
  const assets = scenario.environment.assets.map((a) => ({
    hostname: a.hostname,
    ip: a.ip,
    owner: a.owner,
    department: (a as typeof a & { department?: string }).department ?? a.zone,
    criticality: a.criticality,
    zone: a.zone,
  }));

  const identities = scenario.environment.users.map((u) => ({
    username: u.username,
    displayName: u.displayName,
    department: u.department,
    role: u.role,
  }));

  // 6. Execute BladeQL
  // "Now" is the end of the investigated window (the latest event), so relative time ranges
  // cover the shift. Using the FIRST event here hid almost every event from server-side queries.
  const nowMs = datasetEndMs(dataset.events);

  const executionResult = executeBladeQL(input.query, dataset.events as BladeQLEvent[], {
    attemptId: attempt.id,
    scenarioNowEpochMs: nowMs,
    timeRange: input.timeRange,
    contextTables: { assets, identities },
  });

  // 7. Save immutable query audit log
  let logId: string | undefined;
  try {
    const logged = await ctx.repo.saveSocQueryLog({
      attemptId: attempt.id,
      userId,
      languageVersion: BLADEQL_VERSION,
      queryText: input.query,
      resultRowCount: executionResult.events.length,
      executionSteps: executionResult.executionSteps,
      durationMs: executionResult.executionDurationMs,
      budgetFlags: {
        truncated: executionResult.truncated,
      },
    });
    logId = logged.id;
  } catch (err) {
    // Audit logging failure should not crash execution in offline mode
    console.error("Failed to save soc query log:", err);
  }

  return {
    result: executionResult,
    logId,
  };
}

export function datasetEndMs(events: Array<{ timestamp?: unknown }>): number {
  let max = 0;
  for (const e of events) {
    const t = Date.parse(String(e.timestamp ?? ""));
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max || Date.parse("2026-10-12T16:00:00Z");
}
