import type { HandlerMessage } from "../types";
import type { CompletionRequest, CompletionResult, HandlerProvider } from "./types";

type GeminiContent = { role: string; parts: Array<{ text: string }> };
type CallOptions = { temperature: number; maxTokens: number; timeoutMs: number; jsonMode?: boolean };

export class GeminiProvider implements HandlerProvider {
  readonly name = "gemini" as const;

  constructor(
    private apiKey: string,
    private model: string = process.env.GEMINI_MODEL || "gemini-1.5-flash",
  ) {}

  private async call(systemPrompt: string, contents: GeminiContent[], opts: CallOptions): Promise<CompletionResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxTokens,
          ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error(`Gemini API rate limit or quota exceeded (429): ${errText}`);
      }
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const candidate = json.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      throw new Error("Gemini blocked response due to content safety filter");
    }
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text || !text.trim()) throw new Error("Gemini returned empty response");
    return {
      text: text.trim(),
      modelId: `gemini:${this.model}`,
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  /** Same policy for chat and completions: no retry on quota/safety, one jittered retry otherwise. */
  private async withRetry(run: () => Promise<CompletionResult>): Promise<CompletionResult> {
    try {
      return await run();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("SAFETY")) {
        throw err;
      }
      // Retry once with jitter for transient network or 5xx issues
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 150));
      return await run();
    }
  }

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: userMessage }] },
    ];
    const opts = { temperature: 0.3, maxTokens: 500, timeoutMs: 8_000 };
    return (await this.withRetry(() => this.call(systemPrompt, contents, opts))).text;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const contents = [{ role: "user", parts: [{ text: request.userMessage }] }];
    const opts = {
      temperature: request.temperature,
      maxTokens: request.maxOutputTokens,
      timeoutMs: request.timeoutMs,
      jsonMode: request.jsonMode,
    };
    return this.withRetry(() => this.call(request.systemPrompt, contents, opts));
  }
}
