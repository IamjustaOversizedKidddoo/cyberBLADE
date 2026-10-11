import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { createHash } from "node:crypto";

export type AuditSeverity = "info" | "warn" | "security_alert";

export type AuditEventInput = {
  userId?: string | null;
  eventType: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * Anonymizes an IP address by hashing with SHA-256 for privacy compliance.
 */
export function hashIp(ip?: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`salt_neon_ip_${ip}`).digest("hex").slice(0, 32);
}

/**
 * Writes an append-only security audit log entry.
 * In hosted mode, writes to public.audit_events via admin client.
 * In local-first or unconfigured mode, logs structured event to server console.
 */
export async function logSecurityEvent(event: AuditEventInput): Promise<void> {
  const admin = createAdminClient();
  const severity = event.severity ?? "info";
  const ipHash = hashIp(event.ip);
  const metadata = event.metadata ?? {};

  if (admin) {
    try {
      await admin.from("audit_events").insert({
        user_id: event.userId ?? null,
        event_type: event.eventType,
        severity,
        metadata: metadata as unknown as Json,
        ip_hash: ipHash,
      });
      return;
    } catch {
      // Fall back to structured console logging if database write fails
    }
  }

  // Structured local security log
  console.info(
    JSON.stringify({
      level: severity,
      tag: "AUDIT_EVENT",
      eventType: event.eventType,
      userId: event.userId ?? "anonymous",
      ipHash,
      metadata,
      timestamp: new Date().toISOString(),
    })
  );
}
