import type { HandlerMessage } from "../types";

export interface HandlerProvider {
  readonly name: "groq" | "gemini" | "heuristic";
  generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string>;
}
