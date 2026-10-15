import type { HandlerMessage } from "../types";
import type { CompletionRequest, CompletionResult, HandlerProvider } from "./types";

type ChatMessage = { role: string; content: string };
type CallOptions = { temperature: number; maxTokens: number; timeoutMs: number; jsonMode?: boolean };

export class GroqProvider implements HandlerProvider {
  readonly name = "groq" as const;

  constructor(
    private apiKey: string,
    private model: string = process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  ) {}

  private async call(messages: ChatMessage[], opts: CallOptions): Promise<CompletionResult> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error(`Groq API rate limit or quota exceeded (429): ${errText}`);
      }
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error("Groq returned empty response");
    return {
      text: content.trim(),
      modelId: `groq:${this.model}`,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  /** Same policy for chat and completions: no retry on quota, one jittered retry otherwise. */
  private async withRetry(run: () => Promise<CompletionResult>): Promise<CompletionResult> {
    try {
      return await run();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // If 429 or quota, do not retry; fail immediately to trigger circuit breaker/fallback
      if (errMsg.includes("429") || errMsg.includes("quota")) {
        throw err;
      }
      // Retry once with jitter for transient network or 5xx issues
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 150));
      return await run();
    }
  }

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    const messages = [
      { role: "system", content: systemPrompt },
      // Only the real system prompt has system authority; history turns are user or assistant
      // (same mapping as the Gemini provider), whatever role they arrive with (L1-A-13).
      ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user", content: userMessage },
    ];
    const opts = { temperature: 0.3, maxTokens: 500, timeoutMs: 8_000 };
    return (await this.withRetry(() => this.call(messages, opts))).text;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const messages = [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userMessage },
    ];
    const opts = {
      temperature: request.temperature,
      maxTokens: request.maxOutputTokens,
      timeoutMs: request.timeoutMs,
      jsonMode: request.jsonMode,
    };
    return this.withRetry(() => this.call(messages, opts));
  }
}
