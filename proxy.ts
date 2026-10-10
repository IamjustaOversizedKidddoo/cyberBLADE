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
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    frame-src 'self' data: blob:;
    connect-src 'self' https: wss:;
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
