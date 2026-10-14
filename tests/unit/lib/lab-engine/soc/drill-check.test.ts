import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BLADEQL_DRILLS } from "@/lib/lab-engine/soc/query/drills";
import { checkDrillAnswer, drillDatasetView, pipeCommands, publicDrills } from "@/lib/lab-engine/soc/query/drill-check";

const ref = (id: string) => BLADEQL_DRILLS.find((d) => d.id === id)!.referenceQuery;

describe("drill checker", () => {
  it("accepts every drill's reference query", () => {
    for (const d of BLADEQL_DRILLS) expect(checkDrillAnswer(d.id, d.referenceQuery).correct, d.id).toBe(true);
  });

  it("accepts an equivalent query written differently", () => {
    expect(checkDrillAnswer("drill-02", 'source="auth" and outcome="failure"').correct).toBe(true);
    expect(checkDrillAnswer("drill-01", 'source = "auth"').correct).toBe(true);
  });

  it("rejects a wrong query that returns the same number of rows (the old count-only check passed it)", () => {
    // drill-03 expects the two firewall denies; any two other events have the same count.
    const r = checkDrillAnswer("drill-03", 'source="auth" outcome="failure" | head 2');
    expect(r.correct).toBe(false);
    expect(r.message).toMatch(/rows or their order/);
  });

  it("rejects a wrong row count and reports it without revealing the expected number", () => {
    const r = checkDrillAnswer("drill-01", 'source="firewall"');
    expect(r.correct).toBe(false);
    expect(r.message).not.toMatch(/\b8\b/);
  });

  it("reports query errors and unknown drills", () => {
    expect(checkDrillAnswer("drill-01", "| | nonsense(").message).toMatch(/Query error/);
    expect(checkDrillAnswer("drill-99", 'source="auth"').correct).toBe(false);
  });

  it("previews the learner's own rows, capped", () => {
    const r = checkDrillAnswer("drill-01", 'source="auth"');
    expect(r.preview!.total).toBe(8);
    expect(r.preview!.rows.length).toBeLessThanOrEqual(25);
    expect(r.preview!.fields).not.toContain("_raw");
  });
});

describe("public drill data", () => {
  it("never contains reference queries or the original answer-revealing hints", () => {
    for (const d of BLADEQL_DRILLS) {
      // A few trivial drills state their one-term answer in the prompt itself (the prompt is the task).
      const p = publicDrills().find((x) => x.id === d.id)!;
      const json = JSON.stringify({ ...p, prompt: undefined });
      expect(json).not.toContain(JSON.stringify(d.referenceQuery).slice(1, -1));
      expect(json).not.toContain(JSON.stringify(d.hint).slice(1, -1));
      expect(json).not.toContain("referenceQuery");
    }
  });

  it("hints name commands only", () => {
    expect(pipeCommands('source="auth" | stats count by user | sort -count')).toEqual(["stats", "sort"]);
    const d20 = publicDrills().find((d) => d.id === "drill-20")!;
    expect(d20.hints.join(" ")).toContain("session");
    expect(d20.hints.join(" ")).not.toContain("maxgap");
    expect(ref("drill-20")).toContain("maxgap");
  });

  it("dataset view lists fields and raw lines", () => {
    const v = drillDatasetView();
    expect(v.fields).toContain("src_ip");
    expect(v.lines.length).toBeGreaterThan(15);
  });
});

describe("drill reference queries select real fields", () => {
  it("every field a reference query tables out is present in its results (no always-empty columns)", async () => {
    const { executeBladeQL } = await import("@/lib/lab-engine/soc/query/engine");
    const { DRILL_SYNTHETIC_DATASET } = await import("@/lib/lab-engine/soc/query/drills");
    for (const d of BLADEQL_DRILLS) {
      const m = /\|\s*table\s+([^|]+)$/.exec(d.referenceQuery);
      if (!m) continue;
      const r = executeBladeQL(d.referenceQuery, DRILL_SYNTHETIC_DATASET, { scenarioNowEpochMs: Date.parse("2026-10-12T23:59:59Z") });
      for (const f of m[1].split(",").map((x) => x.trim())) {
        expect(r.events.some((e) => e[f] !== null && e[f] !== undefined), `${d.id}: column ${f} is always empty`).toBe(true);
      }
    }
  });

  it("drill 20 returns session durations", () => {
    const r = checkDrillAnswer("drill-20", ref("drill-20"));
    expect(r.correct).toBe(true);
    expect(r.preview!.fields).toContain("session_duration_sec");
    expect(r.preview!.rows.some((row) => row.session_duration_sec !== "")).toBe(true);
  });
});
