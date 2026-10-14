import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const operator = { id: "u-drill", rank: 1 };
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => operator }));

import { runDrillAction } from "@/app/(app)/practice/drills/actions";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

describe("runDrillAction", () => {
  beforeEach(() => {
    process.env.SOC_QUERY_ENABLED = "true";
    operator.rank = 1;
    operator.id = `u-${Math.random()}`;
    resetSubmissionRateLimits();
  });

  it("checks a correct query and returns only the learner's own rows", async () => {
    const r = await runDrillAction("drill-02", 'source="auth" outcome="failure"');
    expect(r.correct).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/referenceQuery|maxgap/);
  });

  it("is off when the query feature flag is off", async () => {
    process.env.SOC_QUERY_ENABLED = "false";
    await expect(runDrillAction("drill-01", 'source="auth"')).rejects.toThrow("not enabled");
  });

  it("refuses learners below the SOC L1 gate, unknown drills and oversized queries", async () => {
    operator.rank = 0;
    await expect(runDrillAction("drill-01", 'source="auth"')).rejects.toThrow("not available");
    operator.rank = 1;
    await expect(runDrillAction("drill-77", 'source="auth"')).rejects.toThrow("not available");
    await expect(runDrillAction("../x", 'source="auth"')).rejects.toThrow();
    await expect(runDrillAction("drill-01", "x".repeat(2001))).rejects.toThrow();
  });

  it("rate-limits rapid runs", async () => {
    for (let i = 0; i < 30; i++) await runDrillAction("drill-01", 'source="auth"');
    await expect(runDrillAction("drill-01", 'source="auth"')).rejects.toThrow("Rate limit");
  });
});
