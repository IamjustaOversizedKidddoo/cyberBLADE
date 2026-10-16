import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/constants";
import { resolveRoute } from "@/lib/identity/routes";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

const flagOn = (v: string | undefined) => v === "true" || v === "1";
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

// Cookie presence only; pages call requireOperator() for the real lookup.
export async function proxy(request: NextRequest) {
  // Request id: kept if the platform sent a well-formed one, otherwise generated. Server code reads
  // it from the request headers; it is returned to the client and shown on error pages.
  const incomingId = request.headers.get("x-request-id");
  const requestId = incomingId && REQUEST_ID.test(incomingId) ? incomingId : crypto.randomUUID();
  request.headers.set("x-request-id", requestId);

  // Kill switch: every route except the health check answers 503 with Retry-After.
  if (flagOn(process.env.MAINTENANCE_MODE) && request.nextUrl.pathname !== "/api/health") {
    const retryAfter = String(Number(process.env.MAINTENANCE_RETRY_AFTER_SECONDS) || 600);
    return new NextResponse("CyberBLADE is down for maintenance. Please try again soon.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": retryAfter, "cache-control": "no-store", "x-request-id": requestId, "x-robots-tag": "noindex, nofollow" },
    });
  }

  const decision = resolveRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasOperatorCookie: request.cookies.has(OPERATOR_COOKIE),
  });

  let response = decision
    ? NextResponse.redirect(new URL(decision.redirect, request.url))
    : NextResponse.next({
        request: {
          headers: request.headers,
        },
      });

  // 1. Supabase Session Refresh (if configured)
  if (isSupabaseConfigured()) {
    try {
      const env = getSupabaseEnv();
      const supabase = createServerClient<Database>(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            if (!decision) {
              response = NextResponse.next({
                request,
              });
            }
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });

      // Refresh session if needed
      await supabase.auth.getUser();
    } catch {
      // Ignore session errors during proxy pass
    }
  }

  // 2. Security Headers (Defense in Depth)
  const isDev = process.env.NODE_ENV !== "production";
  let supabaseOrigin = "";
  if (isSupabaseConfigured()) {
    try {
      supabaseOrigin = ` ${new URL(getSupabaseEnv().url).origin}`;
    } catch {
      // Ignore URL parsing if unconfigured or invalid
    }
  }

  // Content Security Policy:
  // - In development, 'unsafe-eval' is permitted strictly for React HMR and dev source map debugging.
  // - In production, 'unsafe-eval' and arbitrary 'https:' wildcards are strictly prohibited.
  // - 'unsafe-inline' in style-src is necessary for Tailwind CSS utility injection and GSAP dynamic tween styles.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    frame-src 'self' data: blob:;
    frame-ancestors 'self';
    connect-src 'self'${supabaseOrigin};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("x-request-id", requestId);

  // Closed beta: keep every page out of search engines (BETA_NOINDEX, default on while invite-only).
  const noindex = process.env.BETA_NOINDEX !== undefined ? flagOn(process.env.BETA_NOINDEX) : flagOn(process.env.BETA_INVITE_ONLY);
  if (noindex) response.headers.set("X-Robots-Tag", "noindex, nofollow");

  // Prevent caching of sensitive learner state on authenticated or app routes
  const isSensitiveRoute =
    request.cookies.has(OPERATOR_COOKIE) ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/learn") ||
    request.nextUrl.pathname.startsWith("/labs") ||
    request.nextUrl.pathname.startsWith("/challenge") ||
    request.nextUrl.pathname.startsWith("/readiness") ||
    request.nextUrl.pathname.startsWith("/session") ||
    request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname.startsWith("/beta-notice") ||
    request.nextUrl.pathname.startsWith("/api/");

  if (isSensitiveRoute) {
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|fonts/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|ttf|woff2?)$).*)",
  ],
};
