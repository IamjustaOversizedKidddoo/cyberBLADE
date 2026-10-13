import { describe, it, expect } from "vitest";
import {
  BLADEQL_DRILLS,
  DRILL_SYNTHETIC_DATASET,
  verifyDrillQuery,
} from "@/lib/lab-engine/soc/query/drills";
import { executeBladeQL } from "@/lib/lab-engine/soc/query/engine";

describe("BladeQL Part F.8: 20 Progressive Query Practice Drills", () => {
  it("contains exactly 20 ordered practice exercises across all 4 skill categories", () => {
    expect(BLADEQL_DRILLS.length).toBe(20);
    expect(DRILL_SYNTHETIC_DATASET.length).toBeGreaterThan(15);

    const categories = new Set(BLADEQL_DRILLS.map((d) => d.category));
    expect(categories.has("Search & Filter")).toBe(true);
    expect(categories.has("Shaping & Sorting")).toBe(true);
    expect(categories.has("Aggregation & Stats")).toBe(true);
    expect(categories.has("Advanced Computation")).toBe(true);
  });

  it("verifies all 20 reference queries execute cleanly within budgets", () => {
    for (const drill of BLADEQL_DRILLS) {
      const res = executeBladeQL(drill.referenceQuery, DRILL_SYNTHETIC_DATASET);
      expect(res.events).toBeDefined();
      expect(res.warnings).toBeDefined();

      if (drill.expectedRowCount !== undefined) {
        expect(res.events.length, `Drill ${drill.id} (${drill.referenceQuery}) expected ${drill.expectedRowCount}`).toBe(drill.expectedRowCount);
      }

      // Self-verification
      const verification = verifyDrillQuery(drill.id, drill.referenceQuery);
      expect(verification.passed).toBe(true);
    }
  });

  it("detects incorrect queries with mismatch feedback", () => {
    const wrongRes = verifyDrillQuery("drill-01", 'source="endpoint"');
    expect(wrongRes.passed).toBe(false);
    expect(wrongRes.message).toContain("Row count mismatch");
  });
});
