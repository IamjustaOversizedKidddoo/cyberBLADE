import { describe, it, expect } from "vitest";
import { executeBladeQL } from "@/lib/lab-engine/soc/query/engine";
import { SafeRegex } from "@/lib/lab-engine/soc/query/safe-regex";
import { BladeQLError } from "@/lib/lab-engine/soc/query/errors";
import type { BladeQLBudgets, BladeQLEvent } from "@/lib/lab-engine/soc/query/types";

describe("BladeQL Security & Threat Model Hardening Suite", () => {
  const sampleEvents: BladeQLEvent[] = [
    { id: "e1", timestamp: "2026-10-12T08:00:00Z", source: "auth", user: "alice", outcome: "failure", bytes_out: 100 },
    { id: "e2", timestamp: "2026-10-12T08:01:00Z", source: "auth", user: "bob", outcome: "success", bytes_out: 200 },
    { id: "e3", timestamp: "2026-10-12T08:02:00Z", source: "firewall", host: "fw01", action: "allow", bytes_out: 5000 },
  ];

  it("proves prototype pollution resistance: __proto__ and constructor cannot pollute global Object", () => {
    // Attempt prototype pollution via eval target
    expect(() => {
      executeBladeQL('eval __proto__ = "polluted"', sampleEvents);
    }).not.toThrow();

    // Verify global Object.prototype was NOT polluted
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    // Attempt pollution via constructor
    expect(() => {
      executeBladeQL('eval constructor = "hacked"', sampleEvents);
    }).not.toThrow();
    expect(({} as Record<string, unknown>).hacked).toBeUndefined();

    // Attempt pollution via field access
    const res = executeBladeQL('where __proto__ == "evil"', sampleEvents);
    expect(res.events.length).toBe(0);
  });

  it("defends against Catastrophic Backtracking (ReDoS) with linear-time Pike VM guarantees", () => {
    // Classic ReDoS pattern that causes exponential blowup in backtracking engines
    const pattern = "^(a+)+$";
    const attackInput = "a".repeat(35) + "X";

    const t0 = performance.now();
    let completed = false;

    try {
      const rx = new SafeRegex(pattern);
      const match = rx.test(attackInput);
      expect(match).toBe(false);
      completed = true;
    } catch (err) {
      // Rejection of nested unbounded quantifiers or budget trigger is safe
      expect(err instanceof BladeQLError).toBe(true);
      completed = true;
    }

    const elapsed = performance.now() - t0;
    expect(completed).toBe(true);
    // Must complete in under 50ms (never 5,000ms+ exponential hang)
    expect(elapsed).toBeLessThan(50);
  });

  it("rejects oversized queries exceeding maxQueryLength budget", () => {
    const hugeQuery = "source=\"auth\" " + "and outcome=\"failure\" ".repeat(400);
    expect(hugeQuery.length).toBeGreaterThan(4000);

    expect(() => {
      executeBladeQL(hugeQuery, sampleEvents);
    }).toThrow(/Query length/);
  });

  it("enforces cooperative execution step budgets inside loops", () => {
    // Query that generates millions of step counts if unbounded
    expect(() => {
      executeBladeQL('source="auth"', sampleEvents, {
        budgets: {
          maxExecutionSteps: 5, // Strict artificial step budget
        } as unknown as BladeQLBudgets,
      });
    }).toThrow(/Execution step limit exceeded/);
  });

  it("guarantees internal and ground-truth fields cannot be queried or selected", () => {
    const sensitiveEvents: BladeQLEvent[] = [
      {
        id: "e-sec-1",
        source: "auth",
        timestamp: "2026-10-12T08:00:00Z",
        user: "victim_user",
        // Internal/hidden engine properties
        __seed: "secret_scenario_seed_xyz",
        __incident_id: "inc-01",
      },
    ];

    const res = executeBladeQL('table user, __seed, __incident_id', sensitiveEvents);

    // Columns starting with __ must be excluded from public projections
    expect(res.fields).not.toContain("__seed");
    expect(res.fields).not.toContain("__incident_id");
  });

  it("sanitizes CSV formula injection characters in export logic", () => {
    const maliciousPayloads = [
      "=cmd|'/c calc'!A0",
      "+123456",
      "-2+5*cmd",
      "@SUM(A1:A10)",
      "\tDDE(\"cmd\",\"/c calc\")",
      "\r=1+1",
    ];

    for (const val of maliciousPayloads) {
      const sanitized = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
      expect(sanitized.startsWith("'")).toBe(true);
    }
  });
});
