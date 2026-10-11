import type { Ctx } from "@/lib/progress/service";
import { sanitizeHandlerOutput } from "./guardrails";
import { getNextLabHint, type HintProgression } from "./hints";
import { buildSystemPrompt, detectCommand } from "./prompts";
import { createHandlerProvider, ResilientHandlerProvider } from "./providers/factory";
import { HeuristicProvider } from "./providers/heuristic";
import type { HandlerProvider } from "./providers/types";
import type { HandlerContext, HandlerMessage, HandlerResponse } from "./types";
import { checkHandlerAbuse, recordHandlerResponseForDeduplication } from "./abuse";
import { checkDailyQuota, recordHandlerUsage } from "./metering";
import { buildHintCacheKey, getCachedHint, setCachedHint } from "./cache";
import { estimatePromptTokens, estimateTokenCount } from "./token-counter";

export type AskHandlerOptions = {
  context: HandlerContext;
  history?: HandlerMessage[];
  message: string;
  knownAnswers?: string[];
  provider?: HandlerProvider;
  userId?: string;
  tier?: number;
  forbiddenCommands?: string[];
  finalCommand?: string;
};

export async function askHandler(options: AskHandlerOptions): Promise<HandlerResponse> {
  const {
    context,
    history = [],
    message,
    knownAnswers = [],
    provider,
    userId,
    tier = context.activeTier,
    forbiddenCommands,
    finalCommand,
  } = options;

  const commandRecognized = detectCommand(message);

  // 1. Authoritative Challenge Mode Lockout
  if (context.isChallenge) {
    return {
      reply:
        "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Operators must rely entirely on their own methodology and training.",
      commandRecognized,
      blocked: true,
      providerUsed: "heuristic",
    };
  }

  // 2. Abuse, Idempotency & Rate Limit Check
  if (userId) {
    const abuse = checkHandlerAbuse(userId, message);
    if (abuse.isDuplicate && abuse.cachedReply) {
      return {
        reply: abuse.cachedReply,
        commandRecognized,
        providerUsed: "heuristic",
      };
    }
    if (!abuse.allowed) {
      return {
        reply: `[TRANSMISSION THROTTLED] High request velocity detected. Please wait ${abuse.retryAfterSeconds}s before transmitting to The Handler again.`,
        commandRecognized,
        blocked: true,
        providerUsed: "heuristic",
      };
    }
  }

  // 3. Daily Quota Check (Part D)
  let quotaExceeded = false;
  if (userId) {
    const quota = await checkDailyQuota(userId);
    if (!quota.allowed) {
      quotaExceeded = true;
    }
  }

  // 4. Token & Context Optimization (Part D)
  // Window history to last 6 messages; condense earlier history if present
  let optimizedHistory = history.slice(-6);
  if (history.length > 6) {
    const olderCount = history.length - 6;
    optimizedHistory = [
      {
        role: "system" as const,
        content: `[System Context: Learner previously had ${olderCount} prior exchanges in this session]`,
      },
      ...optimizedHistory,
    ];
  }

  // Cap recent terminal commands in context
  const optimizedContext: HandlerContext = {
    ...context,
    recentCommands: context.recentCommands ? context.recentCommands.slice(-6) : undefined,
  };

  // 5. Deterministic Hint Cache Check (Part D)
  const isHintQuery = commandRecognized === "hint" || message.toLowerCase().includes("hint");
  const cacheKey =
    isHintQuery && context.kind === "lab"
      ? buildHintCacheKey(
          context.activeObjectiveId ?? context.labId ?? "default",
          tier ?? 1,
          (context.recentCommands ?? []).slice(-3).join(";"),
        )
      : null;

  if (cacheKey) {
    const cached = getCachedHint(cacheKey);
    if (cached) {
      return {
        reply: cached,
        commandRecognized,
        providerUsed: "heuristic",
      };
    }
  }

  // 6. Select Active Provider (If quota exceeded, gracefully degrade to Heuristic)
  const activeProvider: HandlerProvider = quotaExceeded
    ? new HeuristicProvider()
    : (provider ?? createHandlerProvider());

  const systemPrompt = buildSystemPrompt(optimizedContext);

  try {
    const rawReply = await activeProvider.generateReply(systemPrompt, optimizedHistory, message);

    const { text, blockedFlag } = sanitizeHandlerOutput(rawReply, {
      knownAnswers,
      isChallenge: context.isChallenge,
      tier,
      forbiddenCommands,
      finalCommand,
    });

    // Determine actual provider used & fallback status
    const actualProviderName =
      activeProvider instanceof ResilientHandlerProvider
        ? activeProvider.lastUsedProvider
        : activeProvider.name;

    const isOfflineFallback =
      quotaExceeded ||
      (activeProvider instanceof ResilientHandlerProvider
        ? activeProvider.isOfflineFallback
        : actualProviderName === "heuristic");

    // Prepend subtle quota advisory if daily limit was reached
    let finalReply = text;
    if (quotaExceeded) {
      finalReply = `[OFFLINE MODE // DAILY QUOTA REACHED]\nYou have reached today's standard AI mentoring budget. The Handler has switched to offline tactical assistance for the remainder of the day.\n\n${text}`;
    }

    // 7. Metering & Telemetry
    if (userId) {
      const promptTokens = estimatePromptTokens(systemPrompt, optimizedHistory, message);
      const outputTokens = estimateTokenCount(finalReply);
      await recordHandlerUsage(userId, promptTokens, outputTokens).catch(() => undefined);
      recordHandlerResponseForDeduplication(userId, finalReply);
    }

    // Cache deterministic hint responses
    if (cacheKey && !blockedFlag) {
      setCachedHint(cacheKey, finalReply);
    }

    return {
      reply: finalReply,
      commandRecognized,
      blocked: blockedFlag,
      providerUsed: actualProviderName,
      isOfflineFallback,
      quotaExceeded,
    };
  } catch {
    // 8. Graceful local heuristic fallback if external network threw
    const fallbackProvider = new HeuristicProvider();
    const fallback = await fallbackProvider.generateReply(systemPrompt, optimizedHistory, message);
    const { text } = sanitizeHandlerOutput(fallback, {
      knownAnswers,
      isChallenge: context.isChallenge,
      tier,
      forbiddenCommands,
      finalCommand,
    });

    if (userId) {
      recordHandlerResponseForDeduplication(userId, text);
    }

    return {
      reply: text,
      commandRecognized,
      providerUsed: "heuristic",
      isOfflineFallback: true,
      quotaExceeded,
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
