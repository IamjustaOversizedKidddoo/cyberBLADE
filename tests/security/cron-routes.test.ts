/** Cron routes: secret required (constant-time compare), rate limited, minimal output, idempotent no-ops. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

const SECRET = "s".repeat(40);
const req = (method: "GET" | "POST", auth?: string) =>
  new NextRequest("http://localhost/api/cron/ai-grading", { method, headers: auth ? { authorization: auth } : {} });

describe("cronAuthorized", () => {
  it.each([
    [null, SECRET, false],
    ["Bearer wrong", SECRET, false],
    [`Bearer ${SECRET}x`, SECRET, false],
    [SECRET, SECRET, false],
    [`Bearer ${SECRET}`, undefined, false],
    ["Bearer short", "short", false],
    [`Bearer ${SECRET}`, SECRET, true],
  ] as const)("auth %s with secret %s -> %s", (auth, secret, want) => {
    expect(cronAuthorized(auth, secret)).toBe(want);
  });
});

describe("cron route handlers", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    process.env.SOC_AI_GRADING_MODE = "off";
    resetSubmissionRateLimits();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.SOC_AI_GRADING_MODE;
  });

  it("refuses requests without the secret (GET and POST)", async () => {
    const { GET, POST } = await import("@/app/api/cron/ai-grading/route");
    for (const r of [req("GET"), req("POST"), req("GET", "Bearer nope")]) {
      const res = r.method === "GET" ? await GET(r) : await POST(r);
      expect(res.status).toBe(401);
      expect(Object.keys(await res.json()).sort()).toEqual(["error", "requestId"]);
    }
  });

  it("runs with the secret; with AI grading off it is a cheap no-op (safe to run twice)", async () => {
    const { GET, POST } = await import("@/app/api/cron/ai-grading/route");
    const a = await (await GET(req("GET", `Bearer ${SECRET}`))).json();
    const b = await (await POST(req("POST", `Bearer ${SECRET}`))).json();
    expect(a).toMatchObject({ ok: true, job: "ai-grading", skipped: true });
    expect(b).toMatchObject({ ok: true, skipped: true });
  });

  it("is rate limited even with the secret", async () => {
    const { GET } = await import("@/app/api/cron/cleanup/route");
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) statuses.push((await GET(req("GET", `Bearer ${SECRET}`))).status);
    expect(statuses.slice(0, 12).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(12)).toEqual([429, 429]);
  });
});
