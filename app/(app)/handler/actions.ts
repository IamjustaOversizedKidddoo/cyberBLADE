"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { canAccessRank } from "@/lib/progress/access";
import { generateLab } from "@/lib/lab-engine/checks";
import { askHandler, requestProgressiveHint } from "@/lib/handler/service";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import type { HandlerContext, HandlerMessage, HandlerResponse } from "@/lib/handler/types";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(4000),
  timestamp: z.string().optional(),
});

const askHandlerSchema = z.object({
  context: z.object({
    kind: z.enum(["lesson", "lab"]),
    lessonId: z.string().optional(),
    lessonTitle: z.string().optional(),
    module: z.string().optional(),
    rank: z.number().int().min(0).max(5).optional(),
    lessonExcerpt: z.string().max(5000).optional(),
    labId: z.string().optional(),
    labTitle: z.string().optional(),
    objectives: z
      .array(
        z.object({
          id: z.string(),
          prompt: z.string(),
          solved: z.boolean(),
        }),
      )
      .optional(),
    hints: z.record(z.string(), z.array(z.string())).optional(),
    activeObjectiveId: z.string().optional(),
    activeTier: z.number().int().min(1).max(3).optional(),
    unlockedHintText: z.string().optional(),
    recentCommands: z.array(z.string()).optional(),
    isChallenge: z.boolean().optional(),
  }),
  history: z.array(messageSchema).max(20).default([]),
  message: z.string().min(1).max(2000),
});
export async function askHandlerAction(rawInput: {
  context: HandlerContext;
  history?: HandlerMessage[];
  message: string;
}): Promise<HandlerResponse> {
  const parsed = askHandlerSchema.parse(rawInput);
  const operator = await requireOperator();

  // Enforce IP-level rate limiting across all identities (30 requests/min per IP)
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const ipCheck = checkRateLimit(`handler:ip:${forwardedFor}`, 30, 60_000);
  if (!ipCheck.allowed) {
    return {
      reply: `[TRANSMISSION THROTTLED] Network request velocity limit reached. Please wait ${Math.ceil(ipCheck.retryAfterMs / 1000)}s before transmitting again.`,
      commandRecognized: false,
      blocked: true,
      providerUsed: "heuristic",
    };
  }

  // Validate rank access if rank is specified
  if (parsed.context.rank !== undefined && !canAccessRank(operator.rank, parsed.context.rank)) {
    throw new Error(`Access denied for rank ${parsed.context.rank}`);
  }

  // Authoritative server-side challenge lockout: check if operator has an active challenge session across all ranks (0 to 5)
  const ctx = getCtx();
  let hasActiveChallenge = false;
  for (let r = 0; r <= 5; r++) {
    const active = await ctx.repo.getActiveChallenge(operator.id, r);
    if (active) {
      hasActiveChallenge = true;
      break;
    }
  }
  if (hasActiveChallenge) {
    parsed.context.isChallenge = true;
  }

  // Derive known answers and server-side tier context if in practice lab
  let knownAnswers: string[] = [];
  if (!parsed.context.isChallenge && parsed.context.kind === "lab" && parsed.context.labId) {
    try {
      const lab = await ctx.content.loadLab(parsed.context.labId);
      if (lab.challenge) {
        parsed.context.isChallenge = true;
      } else {
        const attempt = await ctx.repo.findOrCreateAttempt(operator.id, lab.id, "practice", () => ({
          userId: operator.id,
          labId: lab.id,
          seed: "handler_seed",
          mode: "practice",
          objectivesSolved: [],
          hintsUsed: 0,
          startedAt: ctx.now().toISOString(),
          expiresAt: null,
          completedAt: null,
          failedAt: null,
        }));

        if (attempt) {
          const { answers } = generateLab(lab, attempt.seed, ctx.content.generators);
          knownAnswers = Object.values(answers);
          parsed.context.activeTier = Math.min(attempt.hintsUsed + 1, 3);

          // If learner has unlocked hints, pass only the unlocked clue for active objective
          if (parsed.context.activeObjectiveId && lab.hints[parsed.context.activeObjectiveId]) {
            const hintsList = lab.hints[parsed.context.activeObjectiveId];
            const targetIdx = Math.min(attempt.hintsUsed, hintsList.length - 1);
            parsed.context.unlockedHintText = hintsList[targetIdx];
          }
        }
      }
    } catch {
      // Continue safely if lab loading errors
    }
  }

  return askHandler({
    context: parsed.context,
    history: parsed.history,
    message: parsed.message,
    knownAnswers,
    userId: operator.id,
  });
}

export async function requestLabHintAction(attemptId: string, objectiveId: string) {
  const a = z.string().min(1).max(100).parse(attemptId);
  const o = z.string().min(1).max(50).parse(objectiveId);
  const operator = await requireOperator();

  const result = await requestProgressiveHint(getCtx(), operator.id, a, o);
  return result.progression;
}
