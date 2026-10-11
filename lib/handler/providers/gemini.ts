import type { HandlerMessage } from "../types";
import type { HandlerProvider } from "./types";

export class GeminiProvider implements HandlerProvider {
  readonly name = "gemini" as const;

  constructor(
    private apiKey: string,
    private model: string = process.env.GEMINI_MODEL || "gemini-1.5-flash",
  ) {}

  async generateReply(systemPrompt: string, history: HandlerMessage[], userMessage: string): Promise<string> {
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const executeCall = async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        }),
        signal: AbortSignal.timeout(8_000),
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
      };
      const candidate = json.candidates?.[0];
      if (candidate?.finishReason === "SAFETY") {
        throw new Error("Gemini blocked response due to content safety filter");
      }
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text || !text.trim()) throw new Error("Gemini returned empty response");
      return text.trim();
    };

    try {
      return await executeCall();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("SAFETY")) {
        throw err;
      }
      // Retry once with jitter for transient network or 5xx issues
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 150));
      return await executeCall();
    }
  }
}
