import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/constants";
import { resolveRoute } from "@/lib/identity/routes";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

// Cookie presence only; pages call requireOperator() for the real lookup.
export async function proxy(request: NextRequest) {
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

  // Prevent caching of sensitive learner state on authenticated or app routes
  const isSensitiveRoute =
    request.cookies.has(OPERATOR_COOKIE) ||
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/learn") ||
    request.nextUrl.pathname.startsWith("/labs") ||
    request.nextUrl.pathname.startsWith("/challenge") ||
    request.nextUrl.pathname.startsWith("/readiness") ||
    request.nextUrl.pathname.startsWith("/session");

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
