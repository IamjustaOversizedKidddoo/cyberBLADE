import "server-only";
import { z } from "zod";
import type { Ctx } from "@/lib/progress/service";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { resolveScenarioForAttempt } from "../engine";
import { executeBladeQL } from "./engine";
import { BLADEQL_VERSION } from "./ast";
import type { BladeQLEvent, QueryExecutionResult } from "./types";
import { generateScenarioDataset } from "./dataset-generator";

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
  const rate = checkRateLimit(`soc_query_min:${userId}`, 60, 60_000);
  if (!rate.allowed) {
    throw new Error(`Query rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  }

  // 3. Resolve scenario deterministically
  const scenario = await resolveScenarioForAttempt(attempt);

  // 4. Generate or retrieve cached dataset for this scenario variant
  const dataset = generateScenarioDataset(scenario, attempt.seed);

  // 5. Build static asset & identity context for lookup command
  const assets = scenario.environment.assets.map((a) => ({
    hostname: a.hostname,
    ip: a.ip,
    owner: a.owner,
    department: (a as any).department ?? a.zone,
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
  const nowMs = new Date(scenario.rawEvents[0]?.timestamp ?? "2026-10-12T08:00:00Z").getTime();

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
