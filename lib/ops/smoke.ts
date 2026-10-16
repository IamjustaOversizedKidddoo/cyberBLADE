/**
 * Black-box smoke test of a deployed CyberBLADE (`npm run smoke -- <baseUrl>`), about 20 requests,
 * read-only, no sign-in. Works against local `next start`, staging and production.
 */
export type SmokeCheck = { name: string; ok: boolean; detail?: string };
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Things that must never appear in an error page or API error. */
const LEAK_RE = /(\bat [\w$.<>]+ \(|node_modules|\/var\/task|webpack-internal|\.tsx?:\d+|SUPABASE_|CRON_SECRET|service_role|eyJ[\w-]{20,}|ECONNREFUSED|stack)/i;

export const LESSON_PATH = "/learn/core-r0-comp-hardware-01";

export async function runSmoke(baseUrl: string, fetchImpl: Fetch = fetch, opts: { expectNoindex?: boolean } = {}): Promise<{ checks: SmokeCheck[]; requests: number }> {
  const base = baseUrl.replace(/\/$/, "");
  const https = base.startsWith("https://");
  const checks: SmokeCheck[] = [];
  const cookies: string[] = [];
  let requests = 0;
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail: ok ? undefined : detail });
  const get = async (p: string, init: RequestInit = {}) => {
    requests++;
    const r = await fetchImpl(`${base}${p}`, { redirect: "manual", ...init });
    const sc = r.headers.get("set-cookie");
    if (sc) cookies.push(...sc.split(/,(?=\s*[\w-]+=)/));
    return { r, body: await r.text() };
  };

  const health = await get("/api/health");
  add("/api/health is 200 {status:ok} and not cached", health.r.status === 200 && health.body.includes('"ok"') && /no-store/.test(health.r.headers.get("cache-control") ?? ""), `${health.r.status} ${health.body.slice(0, 80)}`);

  const ready = await get("/api/ready");
  add("/api/ready answers with minimal output", [200, 503].includes(ready.r.status) && !/SUPABASE|SECRET|KEY|postgres/i.test(ready.body), `${ready.r.status}`);

  const home = await get("/");
  const h = home.r.headers;
  const csp = h.get("content-security-policy") ?? "";
  add("security headers present (CSP, nosniff, frame, referrer, permissions)", !!csp && h.get("x-content-type-options") === "nosniff" && !!h.get("x-frame-options") && !!h.get("referrer-policy") && !!h.get("permissions-policy"), `csp=${!!csp}`);
  add("CSP has no unsafe-eval and restricts objects", !/unsafe-eval/.test(csp) && /object-src 'none'/.test(csp), csp.slice(0, 120));
  if (https) add("HSTS on https", /max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""), h.get("strict-transport-security") ?? "missing");
  add("request id on every response", /^[\w-]{8,64}$/.test(h.get("x-request-id") ?? ""), h.get("x-request-id") ?? "missing");
  if (opts.expectNoindex !== false) {
    add("noindex header while invite-only", /noindex/.test(h.get("x-robots-tag") ?? ""), h.get("x-robots-tag") ?? "missing");
    const robots = await get("/robots.txt");
    add("robots.txt disallows everything", /Disallow: \/\s*$/m.test(robots.body), robots.body.slice(0, 80));
  }

  const start = await get("/start");
  add("sign-in page loads", start.r.status === 200 && /<form/i.test(start.body), `${start.r.status}`);

  const lesson = await get(LESSON_PATH);
  const loc = lesson.r.headers.get("location") ?? "";
  add("lessons are not served to anonymous visitors (redirect to sign-in)", lesson.r.status >= 300 && lesson.r.status < 400 && /\/(start|session)/.test(loc), `${lesson.r.status} ${loc}`);

  // Unknown paths redirect anonymous visitors to sign-in; a missing page under a public prefix is a real 404.
  const missing = await get(`/legal/no-such-page-${Date.now()}`);
  add("404 page is a 404 and leaks nothing", missing.r.status === 404 && !LEAK_RE.test(missing.body), `${missing.r.status} ${LEAK_RE.exec(missing.body)?.[0] ?? ""}`);

  const badAction = await get("/start", { method: "POST", headers: { "next-action": "0".repeat(42), "content-type": "text/plain" }, body: "[]" });
  add("bogus server action fails without leaking internals", badAction.r.status >= 400 && !LEAK_RE.test(badAction.body), `${badAction.r.status} ${LEAK_RE.exec(badAction.body)?.[0] ?? ""}`);

  for (const m of ["GET", "POST"]) {
    const cron = await get("/api/cron/cleanup", { method: m });
    add(`cron route refuses ${m} without the secret`, cron.r.status === 401 && !LEAK_RE.test(cron.body), `${cron.r.status}`);
  }

  // Source maps: no sourceMappingURL in served chunks and no .map files.
  const chunks = [...new Set(home.body.match(/\/_next\/static\/[^"'\s]+?\.js/g) ?? [])].slice(0, 4);
  add("page references static chunks", chunks.length > 0, "none found");
  const withMaps: string[] = [];
  for (const c of chunks) {
    const js = await get(c);
    if (/sourceMappingURL=/.test(js.body)) withMaps.push(`${c} (comment)`);
    const map = await get(`${c}.map`);
    if (map.r.status === 200) withMaps.push(`${c}.map`);
  }
  add("no source maps served", withMaps.length === 0, withMaps.join(", "));

  // Any cookie set on these public routes must be HttpOnly, SameSite and (on https) Secure.
  const weak = cookies.filter((c) => !/HttpOnly/i.test(c) || !/SameSite=(Lax|Strict)/i.test(c) || (https && !/Secure/i.test(c)));
  add(`cookie flags (${cookies.length} cookies seen)`, weak.length === 0, weak.map((c) => c.split("=")[0]).join(", "));

  return { checks, requests };
}
