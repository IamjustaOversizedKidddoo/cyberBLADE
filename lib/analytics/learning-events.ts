import type { Ctx } from "@/lib/progress/service";

/**
 * Strips PII, passwords, authentication tokens, IP addresses, and sensitive headers.
 */
function sanitizeMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "secret",
    "auth",
    "authorization",
    "cookie",
    "ip",
    "ipAddress",
    "email",
    "phone",
    "creditCard",
  ]);

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;

    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      sanitized[key] = sanitizeMetadata(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Records a privacy-preserving learning event into the audit ledger.
 */
export async function recordLearningEvent(
  ctx: Ctx,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  const safeMeta = sanitizeMetadata(metadata);
  return ctx.repo.logLearningEvent({
    userId,
    eventType,
    metadata: safeMeta,
    createdAt: ctx.now().toISOString(),
  });
}
