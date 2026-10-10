"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { canAccessRank } from "@/lib/progress/access";
import { askHandler, requestProgressiveHint } from "@/lib/handler/service";
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

  // Validate rank access if rank is specified
  if (parsed.context.rank !== undefined && !canAccessRank(operator.rank, parsed.context.rank)) {
    throw new Error(`Access denied for rank ${parsed.context.rank}`);
  }

  return askHandler({
    context: parsed.context,
    history: parsed.history,
    message: parsed.message,
  });
}

export async function requestLabHintAction(attemptId: string, objectiveId: string) {
  const a = z.string().min(1).max(100).parse(attemptId);
  const o = z.string().min(1).max(50).parse(objectiveId);
  const operator = await requireOperator();

  const result = await requestProgressiveHint(getCtx(), operator.id, a, o);
  return result.progression;
}
