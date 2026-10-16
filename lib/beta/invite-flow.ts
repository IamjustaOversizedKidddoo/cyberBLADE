import "server-only";
/**
 * Invite gate for new learners (BETA_INVITE_ONLY). Every failure returns the same message, checks
 * are rate-limited per IP and globally, and outcomes are audit-logged without the code itself.
 * Hosted sign-in leaves the site (magic link / OAuth), so a checked code is kept in a short-lived
 * httpOnly cookie and redeemed atomically in /auth/callback when the new account is created.
 */
import { cookies, headers } from "next/headers";
import { rateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit-logger";
import { getBetaStore } from "./index";
import { hashInviteCode, normalizeInviteCode } from "./codes";

export const INVITE_COOKIE = "cb_invite";
const COOKIE_SECONDS = 30 * 60;

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

/** Rate-limited, non-consuming check. Returns the normalised code or null (one failure shape). */
export async function checkInviteCode(raw: string, now = new Date()): Promise<string | null> {
  const ip = await clientIp();
  const isTest = process.env.NODE_ENV === "test" || process.env.CYBERBLADE_ALLOW_LOCAL_E2E === "true";
  const perIp = await rateLimit(`beta:invite:ip:${ip}`, isTest ? 1000 : 10, 10 * 60_000);
  const global = await rateLimit("beta:invite:all", isTest ? 10_000 : 300, 10 * 60_000);
  if (!perIp.allowed || !global.allowed) return null;
  const code = normalizeInviteCode(raw);
  const ok = code ? await getBetaStore().inviteUsable(hashInviteCode(code), now.toISOString()) : false;
  await logSecurityEvent({ userId: null, eventType: ok ? "beta.invite.checked" : "beta.invite.rejected", severity: ok ? "info" : "warn", ip, metadata: {} });
  return ok ? code : null;
}

export async function stashInviteCode(code: string): Promise<void> {
  (await cookies()).set(INVITE_COOKIE, code, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth", maxAge: COOKIE_SECONDS });
}

/** Atomically redeems a code for a new learner id. */
export async function redeemInviteCode(code: string, userId: string, now = new Date()): Promise<boolean> {
  const normalized = normalizeInviteCode(code);
  const ok = normalized ? await getBetaStore().redeemInvite(hashInviteCode(normalized), userId, now.toISOString()) : false;
  await logSecurityEvent({ userId: ok ? userId : null, eventType: ok ? "beta.invite.redeemed" : "beta.invite.redeem_failed", severity: ok ? "info" : "warn", metadata: {} });
  return ok;
}

/** Hosted callback: redeem the stashed code for the new account, then drop the cookie. */
export async function redeemStashedInvite(userId: string): Promise<boolean> {
  const jar = await cookies();
  const code = jar.get(INVITE_COOKIE)?.value;
  jar.delete({ name: INVITE_COOKIE, path: "/auth" });
  return code ? redeemInviteCode(code, userId) : false;
}
