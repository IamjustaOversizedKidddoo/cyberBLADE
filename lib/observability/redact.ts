/**
 * Redaction for logs and error reports. Removes secrets and personal data from strings and
 * structured fields: tokens and keys, cookies, email addresses, IP addresses, lab flags, and any
 * learner-authored text (Handler messages, report text, rationales, notes, answers) by field name.
 */

const LEARNER_TEXT_KEYS = /^(message|reply|prompt|history|content|text|answer|answers|rationale|notes?|report|reportdata|executivesummary|attacknarrative|handoff|handoffsummary|justification|feedback|description|query|querytext|submittedanswer)$/i;
const SECRET_KEYS = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|set-cookie|session|service_role|servicerole|dsn|key)$/i;
const PII_KEYS = /^(email|e-mail|ip|ipaddress|remoteaddr|x-forwarded-for|x-real-ip|handle|displayname|name)$/i;

const PATTERNS: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[jwt]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  [/\b(?:gsk_|sk-|sk_live_|sk_test_|AIza|ghp_|xox[bp]-)[A-Za-z0-9_-]{10,}\b/g, "[key]"],
  [/\b(?:CYBER)?BLADE\{[^}\s]{1,200}\}|\bFLAG\{[^}\s]{1,200}\}/gi, "[flag]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  [/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, "[ip]"],
  [/\b[A-Za-z0-9_-]{2,64}=[A-Za-z0-9%._~+/=-]{16,}(?=;|$)/g, "[cookie]"],
  [/\b[a-f0-9]{40,}\b/gi, "[hex]"],
];

export function redactString(value: string, max = 2000): string {
  let s = value;
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s.length > max ? `${s.slice(0, max)}…[truncated]` : s;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(k)) out[k] = "[secret]";
      else if (LEARNER_TEXT_KEYS.test(k)) out[k] = typeof v === "string" ? `[text:${v.length}]` : "[text]";
      else if (PII_KEYS.test(k)) out[k] = "[pii]";
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
