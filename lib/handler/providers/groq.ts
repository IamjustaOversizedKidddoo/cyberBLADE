import type { HandlerMessage } from "../types";
import type { HandlerProvider } from "./types";

export class GroqProvider implements HandlerProvider {
  readonly name = "groq" as const;

  constructor(
    private apiKey: string,
    private model: string = process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  ) {}

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    const executeCall = async () => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (res.status === 429) {
          throw new Error(`Groq API rate limit or quota exceeded (429): ${errText}`);
        }
        throw new Error(`Groq API error (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (!content || !content.trim()) throw new Error("Groq returned empty response");
      return content.trim();
    };

    try {
      return await executeCall();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // If 429 or quota, do not retry; fail immediately to trigger circuit breaker/fallback
      if (errMsg.includes("429") || errMsg.includes("quota")) {
        throw err;
      }
      // Retry once with jitter for transient network or 5xx issues
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 150));
      return await executeCall();
    }
  }
}
