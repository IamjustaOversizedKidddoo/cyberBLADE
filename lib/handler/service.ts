import type { Ctx } from "@/lib/progress/service";
import { sanitizeHandlerOutput } from "./guardrails";
import { getNextLabHint, type HintProgression } from "./hints";
import { buildSystemPrompt, detectCommand } from "./prompts";
import { createHandlerProvider } from "./providers/factory";
import type { HandlerProvider } from "./providers/types";
import type { HandlerContext, HandlerMessage, HandlerResponse } from "./types";

export type AskHandlerOptions = {
  context: HandlerContext;
  history?: HandlerMessage[];
  message: string;
  knownAnswers?: string[];
  provider?: HandlerProvider;
};

export async function askHandler(options: AskHandlerOptions): Promise<HandlerResponse> {
  const { context, history = [], message, knownAnswers = [], provider } = options;

  const commandRecognized = detectCommand(message);

  if (context.isChallenge) {
    return {
      reply: "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Operators must rely entirely on their own methodology and training.",
      commandRecognized,
      blocked: true,
      providerUsed: "heuristic",
    };
  }

  const activeProvider = provider ?? createHandlerProvider();
  const systemPrompt = buildSystemPrompt(context);

  try {
    const rawReply = await activeProvider.generateReply(systemPrompt, history, message);
    const { text, blockedFlag } = sanitizeHandlerOutput(rawReply, {
      knownAnswers,
      isChallenge: context.isChallenge,
    });

    return {
      reply: text,
      commandRecognized,
      blocked: blockedFlag,
      providerUsed: activeProvider.name,
    };
  } catch {
    // If external call threw, fall back to safe local response
    const fallback = await createHandlerProvider([]).generateReply(systemPrompt, history, message);
    const { text } = sanitizeHandlerOutput(fallback, { knownAnswers, isChallenge: context.isChallenge });
    return {
      reply: text,
      commandRecognized,
      providerUsed: "heuristic",
    };
  }
}

export async function requestProgressiveHint(
  ctx: Ctx,
  userId: string,
  attemptId: string,
  objectiveId: string,
): Promise<{ progression: HintProgression; attemptId: string }> {
  const attempt = await ctx.repo.getAttempt(attemptId);
  if (!attempt || attempt.userId !== userId) {
    throw new Error("Attempt not found");
  }

  if (attempt.mode === "challenge") {
    throw new Error("Hints are unavailable during rank challenges.");
  }

  const lab = await ctx.content.loadLab(attempt.labId);
  const progression = getNextLabHint(lab, objectiveId, attempt.hintsUsed);
  if (!progression) {
    throw new Error(`No hints configured for objective ${objectiveId}`);
  }

  // Update hintsUsed on attempt
  await ctx.repo.updateAttempt(attempt.id, {
    hintsUsed: progression.newHintsUsedCount,
  });

  return { progression, attemptId: attempt.id };
}
