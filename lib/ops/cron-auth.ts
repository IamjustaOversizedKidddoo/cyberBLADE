/**
 * Cron authentication (beta hardening). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on a
 * GET request (vercel.com/docs/cron-jobs/manage-cron-jobs, "Securing cron jobs"); manual runs may
 * use POST with the same header. Comparison is constant-time over SHA-256 digests, so neither the
 * secret's length nor its prefix leaks through timing. No secret configured = always refused.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
