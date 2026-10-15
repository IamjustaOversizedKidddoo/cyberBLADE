import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Ctx } from "@/lib/progress/service";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { resolveScenarioForAttempt } from "../engine";
import { canonicalizeEntity } from "./detector";
import type { SocAttemptRecord } from "../types";
import { assertExamWritable, reserveExamBudget } from "../exam/guard";
import { generateEnrichment } from "./generator";
import {
  enrichmentLookupInputSchema,
  type EnrichmentLookupInput,
  type EnrichmentLookupResponse,
  type SocEnrichmentLookupRecord,
} from "./types";

/** Maximum lookups allowed per attempt before budgeting/throttling kicks in */
export const DEFAULT_ATTEMPT_LOOKUP_CAP = 200;

/** Target constant-time server execution baseline (in ms) to prevent timing side channels */
export const TARGET_EXECUTION_BASELINE_MS = 45;

export interface EnrichmentPipelineOptions {
  attemptLookupCap?: number;
  enforceTimingClamp?: boolean;
}

/**
 * Executes a server-authoritative simulated enrichment lookup.
 * Guaranteed zero external network calls, zero ground-truth leaks,
 * deterministic reproducibility, and constant-time execution profile.
 */
export async function executeEnrichmentLookup(
  ctx: Ctx,
  userId: string,
  rawInput: EnrichmentLookupInput,
  options: EnrichmentPipelineOptions = {},
): Promise<EnrichmentLookupResponse> {
  const startTime = Date.now();
  const requestId = randomUUID();

  // 1. Zod input validation
  const input = enrichmentLookupInputSchema.parse(rawInput);
  const canonicalValue = canonicalizeEntity(input.entityType, input.entityValue);

  // 2. Attempt verification & ownership check
  const allAttempts = await ctx.repo.listSocAttempts(userId);
  const attempt = allAttempts.find((a) => a.id === input.attemptId);

  if (!attempt) {
    throw new Error(`[${requestId}] Attempt not found or not owned by user.`);
  }

  if (attempt.status !== "in_progress") {
    throw new Error(`[${requestId}] Cannot perform lookups on a ${attempt.status} attempt.`);
  }

  // 3. Rate limiting (60 queries per minute per user)
  const minuteRate = checkRateLimit(`soc_enrichment_min:${userId}`, 60, 60_000);
  if (!minuteRate.allowed) {
    throw new Error(
      `[${requestId}] Enrichment lookup rate limit exceeded. Please wait ${Math.ceil(
        minuteRate.retryAfterMs / 1000,
      )}s.`,
    );
  }

  // 4. Per-attempt lookup cap and deduplication check
  const existingLookups = await ctx.repo.listSocEnrichmentLookups(attempt.id);
  const isDuplicate = existingLookups.some(
    (l) =>
      l.tool === input.tool &&
      l.entityType === input.entityType &&
      l.entityValue.toLowerCase() === canonicalValue.toLowerCase(),
  );

  const cap = options.attemptLookupCap ?? DEFAULT_ATTEMPT_LOOKUP_CAP;
  if (!isDuplicate && existingLookups.length >= cap) {
    throw new Error(
      `[${requestId}] Investigation query budget exhausted for this attempt (${cap}/${cap} lookups).`,
    );
  }

  // Exam attempts: deadline always; a new (non-duplicate) lookup also uses the exam's budget.
  const release = isDuplicate ? (await assertExamWritable(ctx, attempt), () => undefined) : await reserveExamBudget(ctx, attempt, "lookups");
  try {
    return await runLookup(ctx, userId, input, options, { attempt, canonicalValue, isDuplicate, existingLookups, startTime });
  } finally {
    release();
  }
}

async function runLookup(
  ctx: Ctx,
  userId: string,
  input: EnrichmentLookupInput,
  options: EnrichmentPipelineOptions,
  st: { attempt: SocAttemptRecord; canonicalValue: string; isDuplicate: boolean; existingLookups: SocEnrichmentLookupRecord[]; startTime: number },
): Promise<EnrichmentLookupResponse> {
  const { attempt, canonicalValue, isDuplicate, existingLookups, startTime } = st;
  // 5. Load scenario deterministically for this attempt
  const scenario = await resolveScenarioForAttempt(attempt);

  // 6. Generate pure deterministic synthetic result
  const generated = generateEnrichment(
    scenario,
    attempt.seed,
    input.tool,
    input.entityType,
    canonicalValue,
  );

  // 7. Compute deterministic response hash (content integrity)
  const responseJson = JSON.stringify(generated.data);
  const responseHash = createHash("sha256").update(responseJson).digest("hex");

  // 8. Immutable audit logging (only log new or distinct requests)
  let recordedLookup: SocEnrichmentLookupRecord;
  if (!isDuplicate) {
    recordedLookup = await ctx.repo.saveSocEnrichmentLookup({
      attemptId: attempt.id,
      userId,
      tool: input.tool,
      entityType: input.entityType,
      entityValue: canonicalValue,
      responseHash,
    });
  } else {
    const prev = existingLookups.find(
      (l) =>
        l.tool === input.tool &&
        l.entityType === input.entityType &&
        l.entityValue.toLowerCase() === canonicalValue.toLowerCase(),
    )!;
    recordedLookup = prev;
  }

  // 9. Uniform response timing clamp (eliminates timing side channels between known vs unknown or malicious vs benign)
  if (options.enforceTimingClamp !== false) {
    const elapsed = Date.now() - startTime;
    if (elapsed < TARGET_EXECUTION_BASELINE_MS) {
      await new Promise((resolve) => setTimeout(resolve, TARGET_EXECUTION_BASELINE_MS - elapsed));
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    lookupId: recordedLookup.id,
    attemptId: attempt.id,
    tool: input.tool,
    entityType: input.entityType,
    entityValue: canonicalValue,
    serverTimestamp: new Date().toISOString(),
    executionTimeMs,
    payload: generated.data,
  };
}
