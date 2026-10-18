import "server-only";

import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { logSecurityEvent } from "@/lib/security/audit-logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCertificatesEnabled } from "@/lib/config/env";
import { evaluateTrackEligibility } from "./eligibility";
import { generateCredentialId, isValidCredentialId } from "./slug";
import type { CertificateRecord, ClaimCertificateInput, PublicCertificateVerification } from "./types";

/**
 * Validates the recipient display name chosen by the learner.
 * Enforces 2-60 characters, trimmed, and prevents control characters/markup injection.
 */
export function validateDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new Error("Display name must be between 2 and 60 characters.");
  }
  // Disallow angle brackets, control characters, or potential XSS injection
  if (/[<>\0-\x1F\x7F]/.test(trimmed)) {
    throw new Error("Display name contains invalid characters.");
  }
  return trimmed;
}

/**
 * Server-only issuance action triggered when completion criteria are met.
 * Reuses existing capstone/exam records, never trusts client-supplied scores,
 * and is idempotent.
 */
export async function claimCertificateAction(
  input: ClaimCertificateInput,
): Promise<{ success: boolean; certificate: CertificateRecord }> {
  if (!isCertificatesEnabled()) {
    throw new Error("Certificates system is currently disabled.");
  }
  const operator = await requireOperator();
  const ctx = getCtx();

  // Rate limit certificate generation per user
  const rl = await rateLimit(`cert_claim:${operator.id}`, 10, 60_000);
  if (!rl.allowed) {
    throw new Error("Too many certificate requests. Please wait a moment and try again.");
  }

  const nameAsChosen = validateDisplayName(input.nameAsChosen);

  // 1. Idempotency check: Return existing certificate if already issued
  const existingCerts = await ctx.repo.listCertificates(operator.id);
  const existing = existingCerts.find(
    (c) => c.trackId === input.trackId && c.level === input.level,
  );
  if (existing) {
    return { success: true, certificate: existing };
  }

  // 2. Server-authoritative completion check (never trust client)
  const evalResult = await evaluateTrackEligibility(ctx, operator.id, input.trackId, input.level);
  if (!evalResult.eligible) {
    throw new Error(evalResult.reason ?? "Completion criteria for this track have not been verified.");
  }

  // 3. Issue certificate with unguessable 128-bit slug
  const credentialId = generateCredentialId();
  const issued = await ctx.repo.saveCertificate({
    userId: operator.id,
    trackId: input.trackId,
    level: input.level,
    nameAsChosen,
    credentialId,
    issuedAt: ctx.now().toISOString(),
    revokedAt: null,
    revocationReason: null,
    scoreSnapshot: evalResult.snapshot,
  });

  // 4. Audit log
  await logSecurityEvent({
    userId: operator.id,
    eventType: "certificate.issued",
    severity: "info",
    metadata: {
      credential_id: credentialId,
      track_id: input.trackId,
      level: input.level,
    },
  });

  return { success: true, certificate: issued };
}

/**
 * Public certificate verification. Returns only safe public fields;
 * never exposes emails, internal user IDs, or unapproved metadata.
 */
export async function verifyCertificatePublic(
  credentialId: string,
): Promise<PublicCertificateVerification | null> {
  if (!isValidCredentialId(credentialId)) {
    return null;
  }
  const ctx = getCtx();
  return ctx.repo.verifyCertificate(credentialId);
}

/**
 * Admin-only revocation utility.
 */
export async function revokeCertificateAdmin(
  credentialId: string,
  reason?: string | null,
): Promise<boolean> {
  if (!isValidCredentialId(credentialId)) {
    throw new Error("Invalid credential ID format.");
  }
  const ctx = getCtx();
  const success = await ctx.repo.revokeCertificate(credentialId, reason);
  if (success) {
    await logSecurityEvent({
      userId: null,
      eventType: "certificate.revoked",
      severity: "warn",
      metadata: { credential_id: credentialId, reason: reason ?? "administrative_action" },
    });
  }
  return success;
}
