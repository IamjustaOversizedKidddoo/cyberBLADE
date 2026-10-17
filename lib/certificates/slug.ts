import { randomBytes } from "node:crypto";

/**
 * Generates an unguessable 128-bit slug for public certificate verification.
 * 16 cryptographically secure random bytes = 128 bits of entropy.
 * Format: cbl_<32 hex chars>
 */
export function generateCredentialId(): string {
  const bytes = randomBytes(16);
  return `cbl_${bytes.toString("hex")}`;
}

export function isValidCredentialId(id: string): boolean {
  return typeof id === "string" && /^cbl_[0-9a-f]{32}$/.test(id);
}
