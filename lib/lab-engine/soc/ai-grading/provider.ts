/**
 * The grading pipeline talks to models only through this interface. Production uses the
 * Handler's ResilientHandlerProvider.complete() (same routing, failover, timeouts and circuit
 * breakers, but no heuristic fallback). Tests and the e2e preview inject mocks.
 */
import { createHandlerProvider } from "@/lib/handler/providers/factory";
import type { CompletionRequest, CompletionResult } from "@/lib/handler/providers/types";
import { createContentHeuristicMock } from "./mock-providers";

export type { CompletionRequest, CompletionResult };

export interface AiCompletionProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** Mock providers are reachable outside tests only for the local e2e server, never in a real deployment. */
export function isMockProviderAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.CYBERBLADE_ALLOW_LOCAL_E2E === "true";
}

export function getAiGradingProvider(env: NodeJS.ProcessEnv = process.env): AiCompletionProvider {
  if (env.SOC_AI_PROVIDER === "mock-e2e") {
    if (!isMockProviderAllowed(env)) throw new Error("mock AI provider is not allowed in this environment");
    return createContentHeuristicMock();
  }
  return createHandlerProvider();
}
