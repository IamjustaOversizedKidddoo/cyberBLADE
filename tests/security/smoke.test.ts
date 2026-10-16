/** The deploy smoke test passes a well-behaved site and catches leaks, maps and weak cookies. */
import { describe, expect, it } from "vitest";
import { LESSON_PATH, runSmoke } from "@/lib/ops/smoke";

type Site = Record<string, { status?: number; body?: string; headers?: Record<string, string> }>;

const goodHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-request-id": "req-1234567890",
  "x-robots-tag": "noindex, nofollow",
};

function fakeFetch(site: Site) {
  return async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const key = `${init?.method ?? "GET"} ${u.pathname}`;
    const hit = site[key] ?? (u.pathname.startsWith("/legal/no-such-page") ? site["GET /404"] : undefined) ?? { status: 404, body: "Not found" };
    return new Response(hit.body ?? "", { status: hit.status ?? 200, headers: { ...goodHeaders, ...hit.headers } });
  };
}

const good: Site = {
  "GET /api/health": { body: '{"status":"ok"}', headers: { "cache-control": "no-store" } },
  "GET /api/ready": { body: '{"ready":true}' },
  "GET /": { body: '<script src="/_next/static/chunks/a.js"></script>' },
  "GET /robots.txt": { body: "User-Agent: *\nDisallow: /\n" },
  "GET /start": { body: "<form></form>", headers: { "set-cookie": "cb_x=1; Path=/; HttpOnly; Secure; SameSite=Lax" } },
  [`GET ${LESSON_PATH}`]: { status: 307, headers: { location: "/session/stale" } },
  "GET /404": { status: 404, body: "404 page_not_found_" },
  "POST /start": { status: 404, body: "Server action not found." },
  "GET /api/cron/cleanup": { status: 401, body: '{"error":"unauthorized"}' },
  "POST /api/cron/cleanup": { status: 401, body: '{"error":"unauthorized"}' },
  "GET /_next/static/chunks/a.js": { body: "console.log(1)" },
};

describe("runSmoke", () => {
  it("passes a well-configured site in about 20 requests", async () => {
    const { checks, requests } = await runSmoke("https://beta.example.test", fakeFetch(good));
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(requests).toBeGreaterThanOrEqual(12);
    expect(requests).toBeLessThanOrEqual(22);
  });

  it("fails on a stack trace in a 404, a served source map, a weak cookie and a missing header", async () => {
    const bad: Site = {
      ...good,
      "GET /404": { status: 404, body: "Error\n    at render (/var/task/app/page.tsx:12:3)" },
      "GET /_next/static/chunks/a.js.map": { body: "{}" },
      "GET /start": { body: "<form></form>", headers: { "set-cookie": "sb-token=x; Path=/" } },
      "GET /": { body: '<script src="/_next/static/chunks/a.js"></script>', headers: { "x-content-type-options": "" } },
    };
    const { checks } = await runSmoke("https://beta.example.test", fakeFetch(bad));
    const failed = checks.filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(
      expect.arrayContaining([
        "404 page is a 404 and leaks nothing",
        "no source maps served",
        "cookie flags (1 cookies seen)",
        "security headers present (CSP, nosniff, frame, referrer, permissions)",
      ]),
    );
  });
});
