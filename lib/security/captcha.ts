/**
 * Optional bot protection hook point (Cloudflare Turnstile or hCaptcha).
 * If no CAPTCHA_SECRET_KEY is configured, validation is a transparent pass-through (no third-party account required).
 */
export async function verifyCaptchaToken(
  token?: string | null,
): Promise<{ valid: boolean; reason?: string }> {
  const secretKey = process.env.CAPTCHA_SECRET_KEY?.trim();
  if (!secretKey) {
    return { valid: true };
  }

  if (!token) {
    return { valid: false, reason: "CAPTCHA response token missing." };
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });

    const data = (await res.json()) as { success?: boolean };
    return { valid: Boolean(data.success) };
  } catch {
    return { valid: false, reason: "CAPTCHA validation service unavailable." };
  }
}
