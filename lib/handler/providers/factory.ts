import type { HandlerMessage } from "../types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { HeuristicProvider } from "./heuristic";
import type { HandlerProvider } from "./types";
import { ProviderCircuitBreaker } from "../circuit-breaker";

const circuitBreakers = new Map<string, ProviderCircuitBreaker>();

function getCircuitBreaker(providerName: string): ProviderCircuitBreaker {
  let cb = circuitBreakers.get(providerName);
  if (!cb) {
    cb = new ProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 });
    circuitBreakers.set(providerName, cb);
  }
  return cb;
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
          console.info(`[Handler Telemetry] Provider executed successfully: ${provider.name}`);
        }
        return reply;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("SAFETY");
        cb.recordFailure(Date.now(), isQuota);
        if (process.env.HANDLER_DEBUG_LOGS === "true") {
          console.warn(`[Handler Telemetry] Provider ${provider.name} failed: ${errMsg}. Advancing to next provider.`);
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
