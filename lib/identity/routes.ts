const DEFAULT_AFTER_START = "/dashboard";

const PUBLIC_EXACT = new Set(["/", "/start", "/credits"]);
const PUBLIC_PREFIXES = ["/legal/", "/verify/", "/session/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Only same-site relative paths survive; anything else falls back to the dashboard. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_START;
  }
  return next;
}

export function resolveRoute(input: { pathname: string; hasOperatorCookie: boolean }): { redirect: string } | null {
  const { pathname, hasOperatorCookie } = input;
  if (hasOperatorCookie && pathname === "/start") return { redirect: DEFAULT_AFTER_START };
  if (isPublicPath(pathname)) return null;
  if (!hasOperatorCookie) return { redirect: `/start?next=${encodeURIComponent(pathname)}` };
  return null;
}
