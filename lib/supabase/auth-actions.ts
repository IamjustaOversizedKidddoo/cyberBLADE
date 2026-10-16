"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "./server";
import { clearOperatorCookie } from "@/lib/identity/session";
import { safeNextPath } from "@/lib/identity/routes";

import { rateLimit } from "@/lib/security/rate-limit";

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

  const host = headersList.get("host") || "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;

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

export async function signInWithOAuth(provider: "google" | "github", next = "/dashboard") {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase authentication is not configured.");
  }

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message || "Failed to initiate OAuth login.");
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
