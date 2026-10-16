import type { HandlerMessage } from "../types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { HeuristicProvider } from "./heuristic";
import type { CompletionRequest, CompletionResult, HandlerProvider } from "./types";
import { ProviderCircuitBreaker } from "../circuit-breaker";
import { log } from "@/lib/observability/logger";

const circuitBreakers = new Map<string, ProviderCircuitBreaker>();

function getCircuitBreaker(providerName: string): ProviderCircuitBreaker {
  let cb = circuitBreakers.get(providerName);
  if (!cb) {
    cb = new ProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });
    circuitBreakers.set(providerName, cb);
  }
  return cb;
}

/** Thrown by complete() when no real model provider could answer (grading must not guess). */
export class NoCompletionProviderError extends Error {
  constructor(readonly reason: "none_configured" | "all_failed_or_open") {
    super(`No completion provider available: ${reason}`);
    this.name = "NoCompletionProviderError";
  }
}

export class ResilientHandlerProvider implements HandlerProvider {
  private providers: HandlerProvider[];
  private _lastUsedProvider: "groq" | "gemini" | "heuristic";
  private _hasExternalProviders: boolean;

  get name(): "groq" | "gemini" | "heuristic" {
    return this._lastUsedProvider;
  }

  get lastUsedProvider(): "groq" | "gemini" | "heuristic" {
    return this._lastUsedProvider;
  }

  get isOfflineFallback(): boolean {
    return this._hasExternalProviders && this._lastUsedProvider === "heuristic";
  }

  constructor(providers?: HandlerProvider[]) {
    if (providers && providers.length > 0) {
      this.providers = providers;
      this._hasExternalProviders = providers.some((p) => p.name !== "heuristic");
    } else {
      const list: HandlerProvider[] = [];
      if (process.env.GROQ_API_KEY) {
        list.push(new GroqProvider(process.env.GROQ_API_KEY));
      }
      if (process.env.GEMINI_API_KEY) {
        list.push(new GeminiProvider(process.env.GEMINI_API_KEY));
      }
      this._hasExternalProviders = list.length > 0;
      list.push(new HeuristicProvider());
      this.providers = list;
    }
    this._lastUsedProvider = this.providers[0]?.name ?? "heuristic";
  }

  /** Providers that can serve structured completions (never the heuristic). */
  completionProviders(): HandlerProvider[] {
    return this.providers.filter((p) => p.name !== "heuristic" && typeof p.complete === "function");
  }

  /**
   * Completion path for callers that need a real model or nothing (report grading).
   * Same provider order and circuit breakers as generateReply, but there is no heuristic
   * fallback: if every model provider fails or is open, this throws.
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const capable = this.completionProviders();
    if (capable.length === 0) throw new NoCompletionProviderError("none_configured");
    for (const provider of capable) {
      const cb = getCircuitBreaker(provider.name);
      if (cb.isOpen()) continue;
      try {
        const result = await provider.complete!(request);
        cb.recordSuccess();
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("SAFETY");
        cb.recordFailure(Date.now(), isQuota);
      }
    }
    throw new NoCompletionProviderError("all_failed_or_open");
  }

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    for (const provider of this.providers) {
      // If circuit breaker is open, skip this provider
      const cb = getCircuitBreaker(provider.name);
      if (cb.isOpen()) {
        continue;
      }

      try {
        const reply = await provider.generateReply(systemPrompt, history, userMessage);
        cb.recordSuccess();
        this._lastUsedProvider = provider.name;
        if (process.env.HANDLER_DEBUG_LOGS === "true") {
          log.info("handler provider ok", { provider: provider.name });
        }
        return reply;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("SAFETY");
        cb.recordFailure(Date.now(), isQuota);
        if (process.env.HANDLER_DEBUG_LOGS === "true") {
          log.warn("handler provider failed, trying next", { provider: provider.name, error: errMsg.slice(0, 200) });
        }
      }
    }

    // Ultimate fallback: pure heuristic
    this._lastUsedProvider = "heuristic";
    return new HeuristicProvider().generateReply(systemPrompt, history, userMessage);
  }
}

export function createHandlerProvider(customProviders?: HandlerProvider[]): ResilientHandlerProvider {
  return new ResilientHandlerProvider(customProviders);
}

export function resetCircuitBreakers(): void {
  circuitBreakers.clear();
}
