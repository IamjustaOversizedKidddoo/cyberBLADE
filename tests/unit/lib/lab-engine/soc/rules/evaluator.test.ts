import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  alertToBladeQLEvent,
  evaluateDetectionRuleChallenge,
} from "@/lib/lab-engine/soc/rules/evaluator";
import type { SocAlert } from "@/lib/lab-engine/soc/schema";

describe("SOC Detection Rule Evaluator", () => {
  it("converts alert to BladeQLEvent and prevents prototype pollution keys", () => {
    const maliciousAlert: SocAlert = {
      id: "alert-1",
      timestamp: "2026-10-16T12:00:00Z",
      ruleName: "Suspicious Script",
      source: "EDR",
      severity: "HIGH",
      summary: "PowerShell download cradle",
      relatedAsset: "WS-01",
      relatedUser: "jdoe",
      linkedRawEvents: [],
      relatedIocs: [
        { type: "ip", value: "198.51.100.1" },
        { type: "__proto__" as any, value: "polluted" },
      ],
      rawFields: {
        command_line: "powershell -enc ...",
        __proto__: { admin: true } as any,
        constructor: "polluted" as any,
      },
      groundTruth: {
        kind: "true_positive",
        correctDisposition: "true_positive",
        correctSeverity: "HIGH",
        correctEscalation: true,
        acceptableAlternatives: [],
        debrief: "Simulated test",
      },
    };

    const evt = alertToBladeQLEvent(maliciousAlert);
    expect(evt.alert_id).toBe("alert-1");
    expect(evt.rule_name).toBe("Suspicious Script");
    expect(evt.command_line).toBe("powershell -enc ...");
    expect(evt.src_ip).toBe("198.51.100.1");
    // Verify no prototype pollution
    expect((Object.prototype as any).admin).toBeUndefined();
    expect(Object.getPrototypeOf(evt)).toBe(Object.prototype);
  });

  it("returns zero score for empty query", async () => {
    const res = await evaluateDetectionRuleChallenge(
      "soc-f-attachment-script-01",
      "parent-seed-test-1",
      {
        title: "Test Rule",
        severity: "medium",
        query: "   ",
      },
    );

    expect(res.passed).toBe(false);
    expect(res.recallPercent).toBe(0);
    expect(res.feedback[0]).toContain("Empty query submitted");
  });

  it("rejects oversized rule queries (> 4000 chars)", async () => {
    const longQuery = "severity == 'HIGH' " + "and summary != '' ".repeat(300);
    expect(longQuery.length).toBeGreaterThan(4000);

    const res = await evaluateDetectionRuleChallenge(
      "soc-f-attachment-script-01",
      "parent-seed-test-1",
      {
        title: "Oversized Rule",
        severity: "high",
        query: longQuery,
      },
    );

    expect(res.passed).toBe(false);
    expect(res.feedback[0]).toContain("Query exceeds maximum allowable size");
  });

  it("safely terminates potential ReDoS or runaway regex via BladeQL budgets", async () => {
    // Malicious catastrophic backtracking pattern
    const redosQuery = `summary =~ "(a+)+$"`;

    const res = await evaluateDetectionRuleChallenge(
      "soc-f-attachment-script-01",
      "parent-seed-test-1",
      {
        title: "ReDoS Test Rule",
        severity: "high",
        tactic: "TA0008",
        technique: "T1021.002",
        query: redosQuery,
      },
    );

    // Should not hang; either catches error or completes safely within budgets
    expect(typeof res.scorePercent).toBe("number");
    expect(typeof res.passed).toBe("boolean");
  });

  it("evaluates a valid detection rule against hidden holdouts and benign twins", async () => {
    const res = await evaluateDetectionRuleChallenge(
      "soc-f-attachment-script-01",
      "parent-seed-test-1",
      {
        title: "PsExec Service Installation Detected",
        description: "Detects service creation or EDR alerts indicating PsExec usage.",
        severity: "high",
        tactic: "TA0008",
        technique: "T1021.002",
        query: `severity == "HIGH" or severity == "CRITICAL"`,
      },
    );

    expect(res.holdOutTotal).toBeGreaterThan(0);
    expect(res.benignTotal).toBeGreaterThan(0);
    expect(typeof res.recallPercent).toBe("number");
    expect(typeof res.falsePositiveRatePercent).toBe("number");
    expect(typeof res.scorePercent).toBe("number");
    expect(Array.isArray(res.feedback)).toBe(true);
  });
});
