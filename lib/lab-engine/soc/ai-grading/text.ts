/**
 * Text hygiene applied before anything reaches a model:
 * neutralize Unicode tricks, then replace personal data with placeholders.
 */

// Bidi controls, zero-width/invisible formatting, soft hyphen, Mongolian vowel separator.
const INVISIBLE = /[؜​-‏‪-‮⁠-⁤⁦-⁩﻿­᠎]/g;
// Variation selectors and the Unicode "tag" block (used to smuggle hidden ASCII).
const SMUGGLING = /[︀-️]|\uDB40[\uDC00-\uDDEF]/g;
// C0/C1 control characters except tab and newline.
const CONTROLS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

export interface NeutralizeResult {
  text: string;
  /** How many characters were removed; a high count is an injection signal. */
  removed: number;
}

/** NFKC folds full-width and compatibility look-alikes to plain forms, then invisibles are stripped. */
export function neutralizeUnicode(input: string): NeutralizeResult {
  const folded = input.normalize("NFKC").replace(/\r\n?/g, "\n");
  const stripped = folded.replace(INVISIBLE, "").replace(SMUGGLING, "").replace(CONTROLS, "");
  return { text: stripped, removed: folded.length - stripped.length };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Candidate: digits with space/dash/paren separators, optional leading + or (. Never touches dots or colons,
// so IPs and times are safe; dates are rejected explicitly below.
const PHONE_CANDIDATE = /(?<![\w:+(-]|\d\.)[+(]?\d[\d\s()-]{8,20}\d(?![\w:]|\.\d)/g;

function replacePhones(text: string): string {
  return text.replace(PHONE_CANDIDATE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits < 10 || digits > 15) return m;
    if (/\d{4}-\d{2}-\d{2}/.test(m)) return m; // ISO date (+ hour) is not a phone number
    return "[phone]";
  });
}

const MENTION = /(^|[\s(])@[A-Za-z0-9_]{3,32}\b/g;

// Scenario data only uses reserved names (RFC 2606 / 6761), so an address there is synthetic evidence, not PII.
const RESERVED_EMAIL_DOMAIN = /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|[a-z0-9-]+\.(?:test|invalid|example|localhost))$/i;

function isReservedDomainEmail(address: string): boolean {
  return RESERVED_EMAIL_DOMAIN.test(address);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace emails, phone numbers, @mentions and the learner's own handle(s).
 * Indicator values the learner wrote (IPs, domains, hashes) stay: they are the evidence being graded.
 */
export function scrubPii(input: string, handles: string[] = []): string {
  let out = replacePhones(input.replace(EMAIL, (m) => (isReservedDomainEmail(m) ? m : "[email]"))).replace(
    MENTION,
    "$1[handle]",
  );
  for (const h of handles) {
    const trimmed = h.trim();
    if (trimmed.length >= 3) out = out.replace(new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "gi"), "[analyst]");
  }
  return out;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
