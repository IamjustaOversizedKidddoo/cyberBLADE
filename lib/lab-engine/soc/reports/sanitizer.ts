/**
 * Sanitizer, Defanger, and Safety Utilities for SOC Incident Reports
 */

/**
 * Strips HTML tags, control characters, and normalizes Unicode
 */
export function sanitizeReportText(input: string): string {
  if (!input) return "";

  // 1. Unicode NFC Normalization
  let text = input.normalize("NFC");

  // 2. Strip dangerous control characters (preserve standard whitespace: \n, \r, \t)
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

  // 3. Strip HTML tags and markdown images
  text = text.replace(/<[^>]*>/g, ""); // No HTML elements
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ""); // No markdown images

  // 4. Defang markdown raw links [text](url) -> text (url defanged)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    return `${label} (${defangIndicator(url)})`;
  });

  // 5. CSV Formula Injection defense (escape leading =, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return text.trim();
}

/**
 * Defangs network indicators (IPs, domains, URLs) for safe documentation
 */
export function defangIndicator(val: string): string {
  if (!val) return "";
  let defanged = val.trim();

  // Defang scheme
  defanged = defanged.replace(/^https?:\/\//i, (match) => {
    return match.toLowerCase().startsWith("https") ? "hxxps://" : "hxxp://";
  });

  // Defang dots in IPs and domains
  defanged = defanged.replace(/\./g, "[.]");

  // Defang colons in ports or IPv6
  defanged = defanged.replace(/:([0-9]+)$/, "[:]$1");

  return defanged;
}

/**
 * Refangs indicators back to canonical form for server matching
 */
export function refangIndicator(val: string): string {
  if (!val) return "";
  let refanged = val.trim();

  // Refang scheme
  refanged = refanged.replace(/^hxxps?:\/\//i, (match) => {
    return match.toLowerCase().startsWith("hxxps") ? "https://" : "http://";
  });

  // Refang dots: [.], (.), {.}
  refanged = refanged.replace(/\[\.\]/g, ".");
  refanged = refanged.replace(/\(\.\)/g, ".");
  refanged = refanged.replace(/\{\.\}/g, ".");

  // Refang colons: [:], (:), {:}
  refanged = refanged.replace(/\[:\]/g, ":");
  refanged = refanged.replace(/\(:\)/g, ":");
  refanged = refanged.replace(/\{:\}/g, ":");

  // Normalize path separators
  if (refanged.includes("\\")) {
    refanged = refanged.replace(/\\/g, "/");
  }

  return refanged.toLowerCase();
}

/**
 * Detects adversarial prompt injection attempts in learner free-text fields
 */
export function detectPromptInjection(input: string): { hasInjection: boolean; patternsMatched: string[] } {
  if (!input) return { hasInjection: false, patternsMatched: [] };

  const INJECTION_PATTERNS = [
    /ignore (?:all )?(?:previous |prior )?instructions/i,
    /ignore (?:the )?rubric/i,
    /disregard (?:the )?(?:rubric|rules|grading)/i,
    /give (?:me )?(?:a )?(?:full |perfect |maximum |100%? )score/i,
    /award (?:all )?(?:points|100)/i,
    /you are now (?:an?|the) (?:grader|evaluator|assistant)/i,
    /system prompt/i,
    /assistant:/i,
    /\[system\]/i,
    /override (?:grade|score|evaluation)/i,
  ];

  const matched: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      matched.push(pattern.source);
    }
  }

  return {
    hasInjection: matched.length > 0,
    patternsMatched: matched,
  };
}

/**
 * Detects excessive verbatim copying from raw telemetry logs or alerts
 */
export function detectVerbatimCopyPaste(
  text: string,
  rawSourceCorpus: string[],
  minRunLength = 120,
): { isCopyPasted: boolean; longestRunChars: number } {
  if (!text || rawSourceCorpus.length === 0) return { isCopyPasted: false, longestRunChars: 0 };

  const normalizedText = text.replace(/\s+/g, " ").toLowerCase();
  let maxRun = 0;

  for (const raw of rawSourceCorpus) {
    const normalizedRaw = raw.replace(/\s+/g, " ").toLowerCase();
    if (normalizedRaw.length < minRunLength) continue;

    // Slide window across raw to find longest match
    for (let i = 0; i <= normalizedRaw.length - minRunLength; i += 20) {
      const windowStr = normalizedRaw.slice(i, i + minRunLength);
      if (normalizedText.includes(windowStr)) {
        maxRun = Math.max(maxRun, minRunLength);
        return { isCopyPasted: true, longestRunChars: minRunLength };
      }
    }
  }

  return { isCopyPasted: false, longestRunChars: maxRun };
}
