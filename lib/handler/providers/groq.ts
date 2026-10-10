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
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned empty response");
    return content;
  }
}
