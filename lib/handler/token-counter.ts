/**
 * Lightweight token estimation utility for LLM prompt and response budgeting.
 * Standard heuristic: ~4 characters per token for English, code, and Hinglish.
 */

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Account for word boundaries and code punctuation
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function estimatePromptTokens(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
): number {
  let totalChars = systemPrompt.length + userMessage.length;
  for (const m of history) {
    totalChars += m.content.length + 8; // role overhead
  }
  return Math.ceil(totalChars / 4);
}
