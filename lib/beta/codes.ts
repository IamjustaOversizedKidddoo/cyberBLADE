/**
 * Invite codes: 16 characters from an unambiguous alphabet (80 bits), shown once to the owner as
 * XXXX-XXXX-XXXX-XXXX. Only the SHA-256 of the normalised code is stored.
 */
import { createHash, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no I, L, O, U, 0, 1
const LENGTH = 16;

export function generateInviteCode(): string {
  const chars = Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** Upper-case, drop spaces and dashes. Anything outside the alphabet makes the code invalid. */
export function normalizeInviteCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== LENGTH || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return s;
}

export function hashInviteCode(normalized: string): string {
  return createHash("sha256").update(`cb-invite:${normalized}`).digest("hex");
}

/** The one message for every failure (unknown, expired, revoked, used up, malformed). */
export const INVITE_ERROR = "That invite code didn't work. Check it and try again, or ask the person who invited you for a new one.";
