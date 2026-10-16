/** Health and readiness endpoints: minimal output, no configuration details, rate limited. */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

afterEach(() => {
  delete process.env.CRON_SECRET;
  resetSubmissionRateLimits();
});

describe("/api/health", () => {
  it("is cheap and says only ok", async () => {
    const { GET } = await import("@/app/api/health/route");
    const r = GET();
    expect(await r.json()).toEqual({ status: "ok" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("/api/ready", () => {
  const req = () => new NextRequest("http://localhost/api/ready", { headers: { "x-forwarded-for": "198.51.100.9" } });

  it("reports ok/fail per check without naming variables", async () => {
    const { GET } = await import("@/app/api/ready/route");
    const r = await GET(req());
    const body = await r.json();
    expect(body).toEqual({ ready: true, checks: { config: "ok", database: "local" } });
    expect(JSON.stringify(body)).not.toMatch(/SUPABASE|SECRET|KEY/);
  });

  it("is rate limited", async () => {
    const { GET } = await import("@/app/api/ready/route");
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await GET(req())).status);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });
});
