const FLAG_REGEX = /flag\{[A-Za-z0-9_\-.:@$!#%&*]+\}/gi;

/**
 * Sanitizes LLM output to prevent accidental flag leaks or direct solution disclosures.
 */
export function sanitizeHandlerOutput(
  rawText: string,
  options?: { knownAnswers?: string[]; isChallenge?: boolean },
): { text: string; blockedFlag: boolean } {
  let blockedFlag = false;
  let text = rawText;

  // Mask any flag patterns like FLAG{...}
  if (FLAG_REGEX.test(text)) {
    blockedFlag = true;
    text = text.replace(FLAG_REGEX, "[REDACTED_FLAG: Discover via lab execution]");
  }

  // Mask exact known answer strings if they are non-trivial (> 4 chars) and appear verbatim
  if (options?.knownAnswers) {
    for (const ans of options.knownAnswers) {
      const trimmed = ans.trim();
      if (trimmed.length >= 4) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const ansRegex = new RegExp(`\\b${escaped}\\b`, "gi");
        if (ansRegex.test(text)) {
          text = text.replace(ansRegex, "[TARGET_ANSWER: investigate in terminal]");
        }
      }
    }
  }

  if (options?.isChallenge) {
    return {
      text: "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Operators must rely entirely on their own methodology and knowledge.",
      blockedFlag,
    };
  }

  return { text, blockedFlag };
}
