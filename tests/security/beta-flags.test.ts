/**
 * The beta flag set (docs/ops/deploy-vercel.md "Flags for the beta") and its kill switches:
 * validated config, coherent feature availability, maintenance mode and noindex.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => ({ id: "u-flags", rank: 2, handle: "op" }) }));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));
import { NextRequest } from "next/server";
import { runtimeConfigIssues } from "@/lib/config/runtime-config";
import { isSocEnrichmentEnabled, isSocExamsEnabled, isSocHandlerEnabled, isSocQueryEnabled, isSocReportsEnabled, isSocWorkspaceEnabled, socPracticeFlags } from "@/lib/config/env";
import { practiceTargetAvailable } from "@/lib/content/practice-availability";

export const BETA_FLAGS = {
  BETA_INVITE_ONLY: "true",
  SOC_WORKSPACE_ENABLED: "true",
  SOC_ENRICHMENT_ENABLED: "true",
  SOC_QUERY_ENABLED: "true",
  SOC_REPORTS_ENABLED: "true",
  SOC_EXAMS_ENABLED: "true",
  SOC_HANDLER_ENABLED: "true",
  SOC_L2_ENABLED: "false",
  SOC_RULES_ENABLED: "false",
  SOC_AI_GRADING_MODE: "off",
  SOC_AI_GRADING_KILL_SWITCH: "0",
  MAINTENANCE_MODE: "false",
};
const PROD = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon.public.key.value.0123456789",
  SUPABASE_SERVICE_ROLE_KEY: "service.role.key.value.9876543210",
  NEXT_PUBLIC_SITE_URL: "https://beta.cyberblade.example",
  CRON_SECRET: "c".repeat(40),
};

const touched = new Set<string>();
function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    touched.add(k);
    process.env[k] = v;
  }
}
afterEach(() => {
  for (const k of touched) delete process.env[k];
  touched.clear();
});

describe("beta flag set", () => {
  it("is a valid production configuration", () => {
    expect(runtimeConfigIssues({ ...PROD, ...BETA_FLAGS })).toEqual([]);
  });

  it("turns on every L1 SOC feature and keeps L2 and the rule tool off", () => {
    setEnv({ ...BETA_FLAGS, NODE_ENV: "production" });
    expect([isSocWorkspaceEnabled(), isSocEnrichmentEnabled(), isSocQueryEnabled(), isSocReportsEnabled(), isSocExamsEnabled(), isSocHandlerEnabled()]).toEqual([true, true, true, true, true, true]);
    expect(socPracticeFlags()).toEqual({ workspace: true, enrichment: true, query: true, reports: true });
    expect(process.env.SOC_L2_ENABLED).toBe("false");
  });

  it("with reports off: report practice hidden, investigation exam not open, report actions refuse", async () => {
    setEnv({ ...BETA_FLAGS, SOC_REPORTS_ENABLED: "false" });
    expect(practiceTargetAvailable("report:timeline", socPracticeFlags())).toBe(false);
    expect(practiceTargetAvailable("family:soc-f-phishing-cred-01", socPracticeFlags())).toBe(true);
    const { makeCtx } = await import("../unit/lib/lab-engine/soc/ai-grading/pipeline-harness");
    const { getExamLobby } = await import("@/lib/lab-engine/soc/exam/service");
    const lobby = await getExamLobby(makeCtx({ t: new Date() }), "u-flags");
    expect(lobby.formats.find((f) => f.format === "investigation")).toMatchObject({ available: false, unavailableReason: "Not open yet." });
    expect(lobby.formats.find((f) => f.format === "alert-queue")?.available).toBe(true);
    const { saveSocReportDraftAction } = await import("@/app/(app)/labs/soc/actions");
    await expect(saveSocReportDraftAction("00000000-0000-4000-8000-000000000000", {} as never)).rejects.toThrow("Incident reports are not enabled");
  });
});

describe("maintenance mode and noindex (proxy)", () => {
  const call = async (path: string) => {
    const { proxy } = await import("@/proxy");
    return proxy(new NextRequest(`http://localhost${path}`));
  };

  it("maintenance answers 503 with Retry-After everywhere except the health check", async () => {
    setEnv({ MAINTENANCE_MODE: "true", MAINTENANCE_RETRY_AFTER_SECONDS: "120" });
    for (const p of ["/", "/dashboard", "/api/ready", "/learn/x"]) {
      const r = await call(p);
      expect(r.status, p).toBe(503);
      expect(r.headers.get("retry-after")).toBe("120");
      expect(r.headers.get("x-request-id")).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    }
    expect((await call("/api/health")).status).not.toBe(503);
  });

  it("noindex header while invite-only; none when explicitly turned off", async () => {
    setEnv({ BETA_INVITE_ONLY: "true" });
    expect((await call("/")).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    setEnv({ BETA_NOINDEX: "false" });
    expect((await call("/")).headers.get("x-robots-tag")).toBeNull();
  });

  it("robots disallows everything and the sitemap is empty while noindex is on", async () => {
    setEnv({ BETA_INVITE_ONLY: "true" });
    const robots = (await import("@/app/robots")).default();
    expect(robots.rules).toEqual([{ userAgent: "*", disallow: ["/"] }]);
    expect((await import("@/app/sitemap")).default()).toEqual([]);
  });

  it("request ids: a well-formed incoming id is kept, a malformed one replaced", async () => {
    const { proxy } = await import("@/proxy");
    const keep = await proxy(new NextRequest("http://localhost/", { headers: { "x-request-id": "abc12345-ok" } }));
    expect(keep.headers.get("x-request-id")).toBe("abc12345-ok");
    const replaced = await proxy(new NextRequest("http://localhost/", { headers: { "x-request-id": "<script>" } }));
    expect(replaced.headers.get("x-request-id")).not.toBe("<script>");
  });
});
