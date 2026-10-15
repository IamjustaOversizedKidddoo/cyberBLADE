/** L1-A-12 regression: report inputs are validated at runtime; unknown templates cannot re-grade. */
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000 });

import { makeCtx } from "./ai-grading/pipeline-harness";
import { sampleReport } from "./ai-grading/helpers";
import { startSocSession } from "@/lib/lab-engine/soc/engine";
import { saveSocReportDraft, submitSocReport } from "@/lib/lab-engine/soc/report-engine";
import { socReportDataSchema } from "@/lib/lab-engine/soc/reports/report-schema";

describe("L1-A-12: report schema and template ids", () => {
  it("accepts a legitimate report and drops unknown keys", () => {
    const parsed = socReportDataSchema.parse({ ...sampleReport(), injected: { x: 1 }, iocs: sampleReport().iocs.map((i) => ({ ...i, extra: "x" })) });
    expect(parsed).not.toHaveProperty("injected");
    expect(JSON.stringify(parsed)).not.toContain('"extra"');
  });

  it("rejects missing sections, bad enums and oversized input", () => {
    const r = sampleReport();
    expect(() => socReportDataSchema.parse({ ...r, verdict: undefined })).toThrow();
    expect(() => socReportDataSchema.parse({ ...r, verdict: { ...r.verdict, disposition: "pwned" } })).toThrow();
    expect(() => socReportDataSchema.parse({ ...r, executiveSummary: "x".repeat(6001) })).toThrow();
    expect(() => socReportDataSchema.parse({ ...r, iocs: Array.from({ length: 51 }, () => r.iocs[0] ?? { id: "i", type: "ip", value: "1.1.1.1", role: "c2", evidenceRefs: [] }) })).toThrow();
  });

  it("refuses unknown template ids, so one attempt cannot be submitted and graded again under a new id", async () => {
    const ctx = makeCtx({ t: new Date("2026-10-15T10:00:00Z") });
    const s = await startSocSession(ctx, "u-a12", "soc-f-phishing-cred-01");
    await submitSocReport(ctx, "u-a12", s.attempt.id, sampleReport());
    await expect(submitSocReport(ctx, "u-a12", s.attempt.id, sampleReport(), "incident-report-l1-again")).rejects.toThrow();
    await expect(saveSocReportDraft(ctx, "u-a12", s.attempt.id, sampleReport(), "made-up")).rejects.toThrow();
    expect(await ctx.repo.listSocReportSubmissions(s.attempt.id)).toHaveLength(1);
  });
});
