import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 60_000 });

import { makeCtx } from "../ai-grading/pipeline-harness";
import { getExamInsights, submitExamOutcomeReport } from "@/lib/lab-engine/soc/exam/insights";
import { startExam, submitExam } from "@/lib/lab-engine/soc/exam/service";

const U = "u-insights";
const clock = () => ({ t: new Date("2026-10-15T09:00:00Z") });

describe("exam insights", () => {
  it("shows a provisional not-ready gate with every unmet criterion, a trend and a study plan", async () => {
    const c = clock();
    const ctx = makeCtx(c);
    const s = await startExam(ctx, U, "knowledge");
    await submitExam(ctx, U, s.examId);
    const v = await getExamInsights(ctx, U);
    expect(v.readiness.provisional).toBe(true);
    expect(v.readiness.state).toBe("not_ready");
    expect(v.readiness.statement).toBeNull();
    expect(v.readiness.unmet.map((u) => u.id)).toEqual(expect.arrayContaining(["attempts", "formats", "variants", "report"]));
    expect(v.trend.knowledge).toHaveLength(1);
    expect(v.studyPlan.entries.length).toBeGreaterThan(0);
  });

  it("finalises an expired exam before computing insights", async () => {
    const c = clock();
    const ctx = makeCtx(c);
    await startExam(ctx, U, "knowledge");
    c.t = new Date(c.t.getTime() + 41 * 60_000);
    const v = await getExamInsights(ctx, U);
    expect(v.trend.knowledge?.[0].scorePercent).toBe(0);
  });
});

describe("L1-A-07: exam lobby with the workspace switched off", () => {
  it("shows scenario formats as not open yet (knowledge stays available)", async () => {
    const ctx = makeCtx(clock());
    process.env.SOC_WORKSPACE_ENABLED = "false";
    try {
      const { getExamLobby } = await import("@/lib/lab-engine/soc/exam/service");
      const lobby = await getExamLobby(ctx, "u-lobby-off");
      for (const f of lobby.formats) {
        const isKnowledge = f.format === "knowledge" || f.format === "knowledge-l2";
        expect(f.available, f.format).toBe(isKnowledge);
        if (!isKnowledge) expect(f.unavailableReason).toBe("Not open yet.");
      }
    } finally {
      delete process.env.SOC_WORKSPACE_ENABLED;
    }
  });
});

describe("outcome self-report", () => {
  it("requires explicit consent, a generic family and a past date; stores privately; never changes scores", async () => {
    const c = clock();
    const ctx = makeCtx(c);
    const s = await startExam(ctx, U, "knowledge");
    await submitExam(ctx, U, s.examId);
    const before = await getExamInsights(ctx, U);

    await expect(submitExamOutcomeReport(ctx, U, { certFamily: "other", examDate: "2026-10-01", passed: true })).rejects.toThrow();
    await expect(submitExamOutcomeReport(ctx, U, { certFamily: "other", examDate: "2026-10-01", passed: true, consent: false })).rejects.toThrow();
    await expect(submitExamOutcomeReport(ctx, U, { certFamily: "Some Vendor Cert <script>", examDate: "2026-10-01", passed: true, consent: true })).rejects.toThrow();
    await expect(submitExamOutcomeReport(ctx, U, { certFamily: "other", examDate: "2027-01-01", passed: true, consent: true })).rejects.toThrow("not in the future");
    await expect(submitExamOutcomeReport(ctx, U, { certFamily: "practical-soc-analyst", examDate: "2026-10-01", passed: true, consent: true })).resolves.toEqual({ saved: true });

    const after = await getExamInsights(ctx, U);
    expect(after.outcomeReportsCount).toBe(1);
    expect({ ...after, outcomeReportsCount: 0 }).toEqual({ ...before, outcomeReportsCount: 0 });
    expect((await ctx.repo.listSocExamOutcomeReports(U))[0]).toMatchObject({ certFamily: "practical-soc-analyst", passed: true, consentVersion: "exam-outcome-v1" });
  });
});
