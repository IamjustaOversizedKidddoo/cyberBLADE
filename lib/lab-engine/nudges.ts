import type { Lab } from "./lab-schema";
import { normalizeAnswer } from "./checks";

/**
 * Deterministic, rule-based near-miss diagnosis for lab objective submissions.
 * Never reveals the expected answer or flag.
 * Returns a concise, formative nudge or null if the submission does not qualify as a near-miss.
 */
export function detectNearMiss(
  lab: Lab,
  answers: Record<string, string>,
  objectiveId: string,
  submitted: string,
): string | null {
  const objective = lab.objectives.find((o) => o.id === objectiveId);
  if (!objective) return null;
  const key = objective.check.answer_from.slice("generator.".length);
  if (!Object.hasOwn(answers, key)) return null;

  const expected = normalizeAnswer(answers[key]);
  const given = normalizeAnswer(submitted);
  if (!given || given === expected) return null;

  // 1. Case-sensitivity mismatch
  if (objective.check.case_sensitive && given.toLowerCase() === expected.toLowerCase()) {
    return "Check your casing: one or more letters should be uppercase or lowercase.";
  }

  // 2. Flag wrapper mismatch (FLAG{...} or CB{...})
  const flagMatch = expected.match(/^[A-Z0-9_]+\{([^}]+)\}$/i);
  if (flagMatch) {
    const inner = flagMatch[1];
    if (given === inner) {
      return "Format cue: Include the complete flag wrapper (e.g., FLAG{...}), not just the inner token.";
    }
    const givenMatch = given.match(/^[A-Z0-9_]+\{([^}]+)\}$/i);
    if (givenMatch && givenMatch[1] === inner && !given.startsWith(expected.split("{")[0])) {
      return "Format cue: Check the flag prefix before the opening curly brace.";
    }
  }

  // 3. CIDR prefix vs Plain IP
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(expected)) {
    const plainExpectedIp = expected.split("/")[0];
    if (given === plainExpectedIp) {
      return "Notation cue: The objective expects CIDR notation including the subnet prefix (e.g., /24).";
    }
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(expected)) {
    if (given.startsWith(`${expected}/`)) {
      return "Notation cue: The objective asks for the host IP address alone, without the CIDR prefix.";
    }
  }

  // 4. Absolute path vs relative/basename
  if (expected.startsWith("/") && !given.startsWith("/")) {
    const basename = expected.split("/").pop();
    if (given === basename) {
      return "Path cue: Provide the full absolute path starting from root (e.g., /usr/bin/...).";
    }
  }

  // 5. Numeric PID vs Process Name
  if (/^\d+$/.test(expected) && !/^\d+$/.test(given)) {
    return "Identifier cue: The objective expects a numeric process ID (PID), not the process name.";
  }

  // 6. Numeric Port vs Protocol Name
  if (/^\d+$/.test(expected) && /^[a-z]+$/i.test(given)) {
    return "Port cue: The objective expects a numeric port number (e.g., 80 or 443).";
  }

  // 7. Octal permissions vs symbolic notation
  if (/^[0-7]{3,4}$/.test(expected) && /^[rwx-]{9,10}$/i.test(given)) {
    return "Permission cue: Provide the octal representation (e.g., 644 or 755), not the symbolic rwx letters.";
  }

  // 8. Trailing punctuation / semicolon
  if (given.replace(/[;.,]+$/, "") === expected) {
    return "Syntax cue: Remove trailing punctuation (semicolon, period, or comma) from your submission.";
  }

  return null;
}
