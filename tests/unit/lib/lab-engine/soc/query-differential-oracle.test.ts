import { describe, it, expect } from "vitest";
import { executeBladeQL, BladeQLError } from "@/lib/lab-engine/soc/query/engine";
import type { BladeQLEvent } from "@/lib/lab-engine/soc/query/types";

/**
 * Deliberately naive, independent Oracle implementation
 * Used for differential verification against the production BladeQL interpreter.
 */
class NaiveBladeQLOracle {
  public static evaluate(
    query: string,
    dataset: BladeQLEvent[],
    nowMs: number,
  ): BladeQLEvent[] {
    const trimmed = query.trim();
    const parts = trimmed.split("|").map((p) => p.trim());

    let current = [...dataset];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (i === 0 && !part.startsWith("where ") && !part.startsWith("search ")) {
        // Base search
        if (part.includes("=")) {
          const [k, v] = part.split("=").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
          current = current.filter((r) => String(r[k] ?? "").toLowerCase() === v.toLowerCase());
        }
        continue;
      }

      if (part.startsWith("where ")) {
        const expr = part.slice(6).trim();
        if (expr.includes(">")) {
          const [k, v] = expr.split(">").map((s) => s.trim());
          current = current.filter((r) => Number(r[k]) > Number(v));
        } else if (expr.includes("==")) {
          const [k, v] = expr.split("==").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
          current = current.filter((r) => String(r[k] ?? "").toLowerCase() === v.toLowerCase());
        }
      } else if (part.startsWith("head ") || part.startsWith("limit ")) {
        const n = parseInt(part.split(" ")[1], 10);
        current = current.slice(0, n);
      } else if (part.startsWith("tail ")) {
        const n = parseInt(part.split(" ")[1], 10);
        current = current.slice(Math.max(0, current.length - n));
      } else if (part.startsWith("dedup ")) {
        const field = part.split(" ")[1].trim();
        const seen = new Set<string>();
        current = current.filter((r) => {
          const val = String(r[field] ?? "");
          if (seen.has(val)) return false;
          seen.add(val);
          return true;
        });
      } else if (part.startsWith("table ")) {
        const fields = part
          .slice(6)
          .split(",")
          .map((f) => f.trim());
        current = current.map((r) => {
          const row: BladeQLEvent = {};
          for (const f of fields) row[f] = r[f] !== undefined ? r[f] : null;
          return row;
        });
      } else if (part.startsWith("stats count by ")) {
        const byField = part.slice("stats count by ".length).trim();
        const counts = new Map<string, number>();
        for (const r of current) {
          const val = String(r[byField] ?? "");
          counts.set(val, (counts.get(val) ?? 0) + 1);
        }
        current = Array.from(counts.entries()).map(([k, count]) => ({
          [byField]: k,
          count,
        }));
      }
    }

    return current;
  }
}

describe("BladeQL Part D: Differential Testing, Fuzzing & Safety Budgets", () => {
  const sampleEvents: BladeQLEvent[] = [
    { timestamp: "2026-10-12T08:00:00Z", source: "auth", host: "ws-01", user: "alice", bytes_out: 500, status_code: 200 },
    { timestamp: "2026-10-12T08:05:00Z", source: "auth", host: "ws-01", user: "alice", bytes_out: 1200, status_code: 401 },
    { timestamp: "2026-10-12T08:10:00Z", source: "auth", host: "ws-02", user: "bob", bytes_out: 45000, status_code: 200 },
    { timestamp: "2026-10-12T08:15:00Z", source: "endpoint", host: "ws-02", user: "bob", bytes_out: 300, status_code: 200 },
    { timestamp: "2026-10-12T08:20:00Z", source: "auth", host: "ws-03", user: "charlie", bytes_out: 15000, status_code: 403 },
    { timestamp: "2026-10-12T08:25:00Z", source: "endpoint", host: "ws-01", user: "alice", bytes_out: 2400, status_code: 200 },
  ];

  const nowEpoch = new Date("2026-10-12T09:00:00Z").getTime();

  describe("Differential Testing vs Independent Oracle", () => {
    const testQueries = [
      "source=auth",
      "source=auth | head 2",
      "source=auth | tail 2",
      "where bytes_out > 1000",
      "source=auth | where status_code == 200 | table user, bytes_out",
      "source=auth | dedup user",
      "source=auth | stats count by user",
    ];

    for (const q of testQueries) {
      it(`matches oracle on query: '${q}'`, () => {
        const prodResult = executeBladeQL(q, sampleEvents, { scenarioNowEpochMs: nowEpoch });
        const oracleResult = NaiveBladeQLOracle.evaluate(q, sampleEvents, nowEpoch);

        expect(prodResult.events.length).toBe(oracleResult.length);
        expect(prodResult.events).toEqual(oracleResult);
      });
    }
  });

  describe("Hard Resource Budgets & Cooperative Step Limits", () => {
    it("enforces maxQueryLength budget", () => {
      const hugeQuery = "source=auth " + "AND status=404 ".repeat(500);
      expect(() => {
        executeBladeQL(hugeQuery, sampleEvents, {
          budgets: { maxQueryLength: 100 },
        });
      }).toThrowError(/Query length .* exceeds maximum allowed limit/);
    });

    it("enforces maxPipelineStages budget", () => {
      const manyPipes = "source=auth " + "| where bytes_out > 0 ".repeat(30);
      expect(() => {
        executeBladeQL(manyPipes, sampleEvents, {
          budgets: { maxPipelineStages: 10 },
        });
      }).toThrowError(/Pipeline stages count .* exceeds maximum limit/);
    });

    it("enforces maxExecutionSteps budget", () => {
      expect(() => {
        executeBladeQL("source=auth | where bytes_out > 0", sampleEvents, {
          budgets: { maxExecutionSteps: 5 },
        });
      }).toThrowError(/Execution step limit exceeded/);
    });

    it("truncates results exceeding maxResultRows gracefully", () => {
      const res = executeBladeQL("source=auth", sampleEvents, {
        budgets: { maxResultRows: 2 },
      });
      expect(res.events.length).toBe(2);
      expect(res.truncated).toBe(true);
    });
  });

  describe("Prototype Pollution & Injection Defenses", () => {
    it("neutralizes attempts to assign __proto__ or constructor", () => {
      const attackQuery = 'source=auth | eval __proto__ = "polluted", constructor = "malicious"';
      const res = executeBladeQL(attackQuery, sampleEvents);
      expect(res.events.length).toBeGreaterThan(0);
      // Object prototype remains clean
      expect(({} as any).polluted).toBeUndefined();
      expect(({} as any).constructor).toBe(Object);
    });
  });

  describe("Fuzzing & Pathological Inputs", () => {
    it("handles random token strings and unbalanced structures safely", () => {
      const fuzzInputs = [
        "|||||||||",
        "(((((((((())))))))))",
        "eval x = 1 ++++ 2 **** 3",
        "in (null, false, true, 42, 'str')",
        "stats count by",
        "where 1 == 1 and 2 == 2 or not not not true",
        "\x00\x01\x02 null byte check",
      ];

      for (const input of fuzzInputs) {
        try {
          executeBladeQL(input, sampleEvents);
        } catch (e: any) {
          // If it throws, it must strictly be a caught BladeQLError, NEVER an unhandled crash or range error
          expect(e).toBeInstanceOf(BladeQLError);
        }
      }
    });
  });
});
