/**
 * Completion certificates and public verification registry types.
 *
 * Rules:
 * - Public verification never exposes user email or internal user_id.
 * - Credential IDs are 128-bit unguessable slugs.
 * - Certificates are honest: "CyberBLADE certificate of completion".
 */

export type CertificateRecord = {
  id: string;
  userId: string;
  trackId: string;
  level: string;
  nameAsChosen: string;
  credentialId: string;
  issuedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  scoreSnapshot: Record<string, unknown>;
  createdAt: string;
};

export type PublicCertificateVerification = {
  credentialId: string;
  nameAsChosen: string;
  trackId: string;
  level: string;
  issuedAt: string;
  status: "valid" | "revoked";
  revokedAt?: string | null;
};

export type TrackCertificateEligibility = {
  trackId: string;
  trackTitle: string;
  level: string;
  eligible: boolean;
  reason?: string;
  criteriaDescription: string;
  issuedCertificate?: CertificateRecord | null;
};

export type ClaimCertificateInput = {
  trackId: string;
  level: string;
  nameAsChosen: string;
};
