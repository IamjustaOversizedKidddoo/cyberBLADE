"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { parseStartForm } from "@/lib/identity/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { randomUUID } from "node:crypto";
import { isBetaInviteOnly } from "@/lib/beta";
import { checkInviteCode, redeemInviteCode } from "@/lib/beta/invite-flow";
import { INVITE_ERROR } from "@/lib/beta/codes";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StartState = { errors: { handle?: string; agree?: string; invite?: string }; handle: string };

export async function startOperator(_prev: StartState, formData: FormData): Promise<StartState> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Throttling: Max 10 account registrations per minute per IP (relaxed in test harness)
  const isTest = process.env.NODE_ENV === "test" || process.env.CYBERBLADE_ALLOW_LOCAL_E2E === "true";
  const limit = isTest ? 1000 : 10;
  const rate = await rateLimit(`account:create:ip:${forwardedFor}`, limit, 60_000);
  if (!rate.allowed) {
    return {
      errors: { handle: "Registration velocity limit reached. Please wait a minute before creating an operator." },
      handle: String(formData.get("handle") ?? ""),
    };
  }

  // Optional bot defense hook (Turnstile / CAPTCHA)
  const captchaToken = formData.get("cf-turnstile-response")?.toString();
  const captchaCheck = await verifyCaptchaToken(captchaToken);
  if (!captchaCheck.valid) {
    return {
      errors: { handle: captchaCheck.reason || "Bot verification failed." },
      handle: String(formData.get("handle") ?? ""),
    };
  }

  const result = parseStartForm(formData);
  if (!result.ok) {
    return { errors: result.errors, handle: String(formData.get("handle") ?? "") };
  }

  // If Supabase is configured, establish an anonymous session for RLS alignment if possible
  let id: string = randomUUID();
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.signInAnonymously().catch(() => ({ data: null }));
      if (authData?.user) {
        id = authData.user.id;
      }
    }
  } catch {
    // Fall back to randomUUID
  }

  // Closed beta: redeem the invite atomically for the new id before the operator exists.
  if (isBetaInviteOnly()) {
    const code = await checkInviteCode(String(formData.get("invite") ?? ""));
    if (!code || !(await redeemInviteCode(code, id))) {
      return { errors: { invite: INVITE_ERROR }, handle: String(formData.get("handle") ?? "") };
    }
  }

  let operator;
  try {
    operator = await getOperatorStore().create({
      id,
      handle: result.handle,
      ethicsAcceptedAt: new Date().toISOString(),
    });
  } catch (err) {
    return {
      errors: { handle: err instanceof Error ? err.message : "Failed to initialize operator profile." },
      handle: result.handle,
    };
  }

  await setOperatorCookie(operator.id);
  redirect(result.next);
}
