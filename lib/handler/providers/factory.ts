import type { HandlerMessage } from "../types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { HeuristicProvider } from "./heuristic";
import type { HandlerProvider } from "./types";

export class ResilientHandlerProvider implements HandlerProvider {
  readonly name: "groq" | "gemini" | "heuristic";
  private providers: HandlerProvider[];

  constructor(providers?: HandlerProvider[]) {
    if (providers && providers.length > 0) {
      this.providers = providers;
    } else {
      const list: HandlerProvider[] = [];
      if (process.env.GROQ_API_KEY) {
        list.push(new GroqProvider(process.env.GROQ_API_KEY));
      }
      if (process.env.GEMINI_API_KEY) {
        list.push(new GeminiProvider(process.env.GEMINI_API_KEY));
      }
      list.push(new HeuristicProvider());
      this.providers = list;
    }
    this.name = this.providers[0].name;
  }

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    for (const provider of this.providers) {
      try {
        return await provider.generateReply(systemPrompt, history, userMessage);
      } catch {
        // Continue to the next fallback provider in chain
      }
    }
    // If all providers failed, fall back to pure Heuristic inline
    return new HeuristicProvider().generateReply(systemPrompt, history, userMessage);
  }
}

export function createHandlerProvider(customProviders?: HandlerProvider[]): HandlerProvider {
  return new ResilientHandlerProvider(customProviders);
}
