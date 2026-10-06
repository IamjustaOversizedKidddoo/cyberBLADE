import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/constants";
import { resolveRoute } from "@/lib/identity/routes";

// Cookie presence only; pages call requireOperator() for the real lookup.
export function proxy(request: NextRequest) {
  const decision = resolveRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasOperatorCookie: request.cookies.has(OPERATOR_COOKIE),
  });
  if (!decision) return NextResponse.next();
  return NextResponse.redirect(new URL(decision.redirect, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|ttf|woff2?)$).*)"],
};
