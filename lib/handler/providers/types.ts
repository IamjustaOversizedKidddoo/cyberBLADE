import type { HandlerMessage } from "../types";

/** A single structured completion (used by report grading; the Handler chat keeps generateReply). */
export interface CompletionRequest {
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Ask the provider for a JSON object response when it supports that. */
  jsonMode?: boolean;
}

export interface CompletionResult {
  text: string;
  /** Provider-qualified model id, e.g. "groq:llama-3.3-70b-versatile". */
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface HandlerProvider {
  readonly name: "groq" | "gemini" | "heuristic";
  generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string>;
  /** Optional: providers backed by a real model implement this; the heuristic provider does not. */
  complete?(request: CompletionRequest): Promise<CompletionResult>;
}
