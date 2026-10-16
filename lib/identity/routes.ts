const DEFAULT_AFTER_START = "/dashboard";

// Reachable without an operator cookie. The auth callback must be (a new user has no cookie yet);
// health/ready/cron carry their own controls (no data / rate limit / CRON_SECRET), and crawlers
// must be able to read robots.txt for the beta's noindex to work.
const PUBLIC_EXACT = new Set([
  "/",
  "/start",
  "/credits",
  "/help",
  "/accessibility",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/api/health",
  "/api/ready",
]);
const PUBLIC_PREFIXES = ["/legal/", "/verify/", "/session/", "/auth/", "/api/cron/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

const PROBE_ORIGIN = "http://neon.invalid";

/**
 * Only same-site relative paths survive; anything else falls back to the dashboard.
 * Parsed the way a browser would (it strips tabs/newlines and treats "\" as "/"),
 * so tricks like "/\t/evil.example" cannot turn into "//evil.example".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return DEFAULT_AFTER_START;
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return DEFAULT_AFTER_START;
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_AFTER_START;
  return url.pathname + url.search + url.hash;
}

export function resolveRoute(input: {
  pathname: string;
  search?: string;
  hasOperatorCookie: boolean;
}): { redirect: string } | null {
  const { pathname, search = "", hasOperatorCookie } = input;
  if (hasOperatorCookie && pathname === "/start") return { redirect: DEFAULT_AFTER_START };
  if (isPublicPath(pathname)) return null;
  if (!hasOperatorCookie) return { redirect: `/start?next=${encodeURIComponent(pathname + search)}` };
  return null;
}
