"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "./server";
import { clearOperatorCookie } from "@/lib/identity/session";
import { safeNextPath } from "@/lib/identity/routes";

import { rateLimit } from "@/lib/security/rate-limit";
import { isBetaInviteOnly } from "@/lib/beta";
import { checkInviteCode, stashInviteCode } from "@/lib/beta/invite-flow";
import { INVITE_ERROR } from "@/lib/beta/codes";

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"));

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    return { error: "Please provide a valid email address." };
  }

  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Rate limit by IP (5/min) and by target email (3/min)
  const ipLimit = await rateLimit(`auth:magic:ip:${forwardedFor}`, 5, 60_000);
  const emailLimit = await rateLimit(`auth:magic:email:${email}`, 3, 60_000);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "Too many sign-in attempts. Please wait a moment before trying again." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase authentication is not configured in this environment." };
  }

  // Closed beta: a code entered here is checked now and redeemed when the new account is created.
  const inviteError = await prepareInvite(formData.get("invite"));
  if (inviteError) return { error: inviteError };

  const origin = await siteOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: "Unable to process sign-in request. Please try again later." };
  }

  return { success: true, message: "If an account exists for this email, a sign-in link has been sent. Check your inbox." };
}

/**
 * Redirect origin for auth emails and OAuth. The configured site URL wins: building it from the
 * Host header would let a forged header steer sign-in links (Supabase also enforces its redirect
 * allow-list, which must list only the real domains).
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  return `${h.get("x-forwarded-proto") || "http"}://${h.get("host") || "localhost:3000"}`;
}

/** Returns an error message, or null when there is no code or the code is usable (then stashed). */
async function prepareInvite(raw: FormDataEntryValue | string | null | undefined): Promise<string | null> {
  const code = typeof raw === "string" ? raw.trim() : "";
  if (!isBetaInviteOnly() || !code) return null;
  const checked = await checkInviteCode(code);
  if (!checked) return INVITE_ERROR;
  await stashInviteCode(checked);
  return null;
}

export async function signInWithOAuth(provider: "google" | "github", next = "/dashboard", invite?: string): Promise<{ error: string } | void> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase authentication is not configured in this environment." };
  }

  const inviteError = await prepareInvite(typeof invite === "string" ? invite.slice(0, 40) : undefined);
  if (inviteError) return { error: inviteError };

  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
    },
  });

  if (error || !data.url) {
    return { error: error?.message || "Failed to initiate OAuth login." };
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  await clearOperatorCookie();
  redirect("/");
}
