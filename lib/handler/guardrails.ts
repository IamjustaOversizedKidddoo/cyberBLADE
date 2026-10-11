/**
 * Multi-layer Handler guardrails and output sanitization engine.
 * Protects against raw, obfuscated, and indirect answer leaks across all communication tiers.
 */

export const FLAG_REDACTION_TOKEN = "[REDACTED_FLAG: Discover via lab execution]";
export const ANSWER_REDACTION_TOKEN = "[TARGET_ANSWER: investigate in terminal]";
export const CHALLENGE_LOCKOUT_MESSAGE =
  "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Operators must rely entirely on their own methodology and training.";

/**
 * Standard, leet, and phonetic flag prefixes.
 */
const DIRECT_FLAG_REGEX = /(?:flag|cyberblade|fl4g|phlag|cyb3rbl4d3|cyb3r_bl4d3|cyb3r-bl4d3)\s*\{[^}\n\r]+\}/gi;

/**
 * Spaced or delimited flag patterns (e.g. F L A G { ... }, C-Y-B-E-R-B-L-A-D-E { ... }).
 */
const SPACED_FLAG_REGEX =
  /(?:[fF][\s._-]*[lL][\s._-]*[aA][\s._-]*[gG]|[cC][\s._-]*[yY][\s._-]*[bB][\s._-]*[eE][\s._-]*[rR][\s._-]*[bB][\s._-]*[lL][\s._-]*[aA][\s._-]*[dD][\s._-]*[eE])[\s._-]*\{[^}]*\}/g;

/**
 * Reversed flag patterns (e.g. }...{GALF, }...{EDALBREBYC).
 */
const REVERSED_FLAG_REGEX =
  /\}[A-Za-z0-9_\-.:@$!#%&*+= ]+\{[\s._-]*(?:[gG][\s._-]*[aA][\s._-]*[lL][\s._-]*[fF]|[eE][\s._-]*[dD][\s._-]*[aA][\s._-]*[lL][\s._-]*[bB][\s._-]*[rR][\s._-]*[eE][\s._-]*[bB][\s._-]*[yY][\s._-]*[cC])\b/g;

/**
 * ROT13 flag patterns (flag{ -> synt{, cyberblade{ -> plorebynqr{).
 */
const ROT13_FLAG_REGEX = /(?:synt|plorebynqr)\s*\{[^}\n\r]+\}/gi;

/**
 * URL-encoded flag header fragments (%66%6c%61%67%7b or %46%4c%41%47%7b, %63%79%62%65%72%62%6c%61%64%65%7b).
 */
const URL_FLAG_REGEX = /(?:%(?:66|46)%(?:6c|4c)%(?:61|41)%(?:67|47)%7b|%(?:63|43)%(?:79|59)%(?:62|42)%(?:65|45)%(?:72|52)%(?:62|42)%(?:6c|4c)%(?:61|41)%(?:64|44)%(?:65|45)%7b)[^ \n\r\t]+/gi;

function decodeRot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

function tryDecodeHex(hexCandidate: string): string | null {
  const clean = hexCandidate.replace(/^0x/i, "").trim();
  if (clean.length % 2 !== 0 || clean.length < 8 || !/^[0-9a-fA-F]+$/.test(clean)) return null;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(parseInt(clean.slice(i, i + 2), 16));
    }
    const decoded = String.fromCharCode(...bytes);
    if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

function tryDecodeBase64(b64Candidate: string): string | null {
  const clean = b64Candidate.trim();
  if (clean.length < 12 || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  try {
    const buf = Buffer.from(clean, "base64");
    const decoded = buf.toString("utf-8");
    if (/^[\x20-\x7E\r\n\t]+$/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

function hasAcrosticFlag(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 4) return false;

  for (let i = 0; i <= lines.length - 4; i++) {
    const four = lines.slice(i, i + 4).map((l) => l[0].toUpperCase()).join("");
    if (four === "FLAG") return true;
  }

  if (lines.length >= 10) {
    for (let i = 0; i <= lines.length - 10; i++) {
      const ten = lines.slice(i, i + 10).map((l) => l[0].toUpperCase()).join("");
      if (ten === "CYBERBLADE") return true;
    }
  }

  return false;
}

export type SanitizeOptions = {
  knownAnswers?: string[];
  isChallenge?: boolean;
  tier?: number;
  forbiddenCommands?: string[];
  finalCommand?: string;
};

export type SanitizeResult = {
  text: string;
  blockedFlag: boolean;
  blockedReason?: string;
};

/**
 * Sanitizes LLM or heuristic output to prevent flag leaks or direct solution disclosures.
 */
export function sanitizeHandlerOutput(rawText: string, options?: SanitizeOptions): SanitizeResult {
  let blockedFlag = false;
  let blockedReason: string | undefined;

  // Timed rank challenge lockout: sever transmission unconditionally
  if (options?.isChallenge) {
    return {
      text: CHALLENGE_LOCKOUT_MESSAGE,
      blockedFlag: false,
      blockedReason: "challenge_lockout",
    };
  }

  let text = rawText;

  // 1. Direct standard & leet flags (FLAG{...}, CYBERBLADE{...}, FL4G{...}, etc.)
  if (DIRECT_FLAG_REGEX.test(text)) {
    blockedFlag = true;
    blockedReason = "direct_flag";
    text = text.replace(DIRECT_FLAG_REGEX, FLAG_REDACTION_TOKEN);
  }

  // 2. Spaced / delimited / multi-line flags
  if (SPACED_FLAG_REGEX.test(text)) {
    blockedFlag = true;
    blockedReason = blockedReason ?? "spaced_flag";
    text = text.replace(SPACED_FLAG_REGEX, FLAG_REDACTION_TOKEN);
  }

  // 3. Reversed flag patterns
  if (REVERSED_FLAG_REGEX.test(text)) {
    blockedFlag = true;
    blockedReason = blockedReason ?? "reversed_flag";
    text = text.replace(REVERSED_FLAG_REGEX, FLAG_REDACTION_TOKEN);
  }

  // 4. ROT13 flags
  if (ROT13_FLAG_REGEX.test(text)) {
    blockedFlag = true;
    blockedReason = blockedReason ?? "rot13_flag";
    text = text.replace(ROT13_FLAG_REGEX, FLAG_REDACTION_TOKEN);
  }

  // 5. URL-encoded flags
  if (URL_FLAG_REGEX.test(text)) {
    blockedFlag = true;
    blockedReason = blockedReason ?? "url_encoded_flag";
    text = text.replace(URL_FLAG_REGEX, FLAG_REDACTION_TOKEN);
  }

  // 6. Base64 encoded flags or secrets
  const base64CandidateRegex = /(?:^|[^A-Za-z0-9+/])([A-Za-z0-9+/]{12,}={0,2})(?=[^A-Za-z0-9+/=]|$)/g;
  text = text.replace(base64CandidateRegex, (match, b64Part) => {
    const decoded = tryDecodeBase64(b64Part);
    if (decoded) {
      if (/flag\{|cyberblade\{/i.test(decoded)) {
        blockedFlag = true;
        blockedReason = blockedReason ?? "base64_flag";
        return match.replace(b64Part, FLAG_REDACTION_TOKEN);
      }
      if (options?.knownAnswers) {
        for (const ans of options.knownAnswers) {
          const trimmed = ans.trim();
          if (trimmed.length >= 4 && decoded.toLowerCase().includes(trimmed.toLowerCase())) {
            blockedFlag = true;
            blockedReason = blockedReason ?? "base64_answer";
            return match.replace(b64Part, ANSWER_REDACTION_TOKEN);
          }
        }
      }
    }
    return match;
  });

  // 7. Hex encoded flags or secrets
  const hexCandidateRegex = /\b(?:0x)?([0-9a-fA-F]{16,})\b/g;
  text = text.replace(hexCandidateRegex, (match, hexPart) => {
    const decoded = tryDecodeHex(hexPart);
    if (decoded) {
      if (/flag\{|cyberblade\{/i.test(decoded)) {
        blockedFlag = true;
        blockedReason = blockedReason ?? "hex_flag";
        return FLAG_REDACTION_TOKEN;
      }
      if (options?.knownAnswers) {
        for (const ans of options.knownAnswers) {
          const trimmed = ans.trim();
          if (trimmed.length >= 4 && decoded.toLowerCase().includes(trimmed.toLowerCase())) {
            blockedFlag = true;
            blockedReason = blockedReason ?? "hex_answer";
            return ANSWER_REDACTION_TOKEN;
          }
        }
      }
    }
    return match;
  });

  // 8. Acrostic flag detection
  if (hasAcrosticFlag(text)) {
    blockedFlag = true;
    blockedReason = blockedReason ?? "acrostic_flag";
    text = `### Tactical Guidance // The Handler\n\n${FLAG_REDACTION_TOKEN}\n\nFormulate your methodology and verify findings in the operational terminal.`;
  }

  // 9. Mask exact known answers
  if (options?.knownAnswers && options.knownAnswers.length > 0) {
    for (const ans of options.knownAnswers) {
      const trimmed = ans.trim();
      // Skip trivial tokens (e.g. 1-2 char numbers)
      if (trimmed.length < 3) continue;

      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match exact boundary or surrounded by quotes/code ticks/spaces
      const ansRegex = new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}(?=[^a-zA-Z0-9_-]|$)`, "gi");
      if (ansRegex.test(text)) {
        blockedFlag = true;
        blockedReason = blockedReason ?? "exact_answer";
        text = text.replace(ansRegex, (_match, prefix) => `${prefix}${ANSWER_REDACTION_TOKEN}`);
      }

      // Check reversed answer if length >= 5
      if (trimmed.length >= 5) {
        const rev = trimmed.split("").reverse().join("");
        const revEscaped = rev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const revRegex = new RegExp(`(^|[^a-zA-Z0-9_-])${revEscaped}(?=[^a-zA-Z0-9_-]|$)`, "gi");
        if (revRegex.test(text)) {
          blockedFlag = true;
          blockedReason = blockedReason ?? "reversed_answer";
          text = text.replace(revRegex, (_match, prefix) => `${prefix}${ANSWER_REDACTION_TOKEN}`);
        }
      }

      // Check rot13-encoded answer if length >= 4
      if (trimmed.length >= 4) {
        const rotAns = decodeRot13(trimmed);
        const rotEscaped = rotAns.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rotRegex = new RegExp(`(^|[^a-zA-Z0-9_-])${rotEscaped}(?=[^a-zA-Z0-9_-]|$)`, "gi");
        if (rotRegex.test(text)) {
          blockedFlag = true;
          blockedReason = blockedReason ?? "rot13_answer";
          text = text.replace(rotRegex, (_match, prefix) => `${prefix}${ANSWER_REDACTION_TOKEN}`);
        }
      }
    }
  }

  // 10. Tier 1 / Tier 2 enforcement checks
  if (options?.tier === 1 && options.forbiddenCommands && options.forbiddenCommands.length > 0) {
    for (const cmd of options.forbiddenCommands) {
      const cleanCmd = cmd.trim();
      if (!cleanCmd) continue;
      const cmdRegex = new RegExp(`\\b${cleanCmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (cmdRegex.test(text)) {
        text = text.replace(cmdRegex, "[REDACTED_COMMAND: Explore available commands with help or documentation]");
      }
    }
  }

  if (options?.tier !== undefined && options.tier <= 2 && options.finalCommand) {
    const finalCmdTrim = options.finalCommand.trim();
    if (finalCmdTrim.length >= 4) {
      const escapedFinal = finalCmdTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const finalRegex = new RegExp(escapedFinal, "i");
      if (finalRegex.test(text)) {
        text = text.replace(finalRegex, "[FINAL_COMMAND: Determine required flags from documentation]");
      }
    }
  }

  return { text, blockedFlag, blockedReason };
}
