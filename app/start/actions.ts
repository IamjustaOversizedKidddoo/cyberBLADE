"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { parseStartForm } from "@/lib/identity/validation";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { verifyCaptchaToken } from "@/lib/security/captcha";

export type StartState = { errors: { handle?: string; agree?: string }; handle: string };

export async function startOperator(_prev: StartState, formData: FormData): Promise<StartState> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Throttling: Max 10 account registrations per minute per IP (relaxed in test harness)
  const isTest = process.env.NODE_ENV === "test" || process.env.CYBERBLADE_ALLOW_LOCAL_E2E === "true";
  const limit = isTest ? 1000 : 10;
  const rateLimit = checkRateLimit(`account:create:ip:${forwardedFor}`, limit, 60_000);
  if (!rateLimit.allowed) {
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
  const operator = await getOperatorStore().create({
    handle: result.handle,
    ethicsAcceptedAt: new Date().toISOString(),
  });
  await setOperatorCookie(operator.id);
  redirect(result.next);
}
