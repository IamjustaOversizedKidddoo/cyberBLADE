"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "./server";
import { clearOperatorCookie } from "@/lib/identity/session";
import { safeNextPath } from "@/lib/identity/routes";

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/dashboard"));

  if (!email || !email.includes("@")) {
    return { error: "Please provide a valid email address." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase authentication is not configured in this environment." };
  }

  const headersList = await headers();
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
    return { error: error.message };
  }

  return { success: true, message: "Magic link sent. Check your inbox." };
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
