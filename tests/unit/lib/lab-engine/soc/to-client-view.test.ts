import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { toClientView, type SocScenario, type SocAlert } from "@/lib/lab-engine/soc/schema";

const DENIED_STRINGS = [
  "groundTruth",
  "correctDisposition",
  "correctSeverity",
  "correctEscalation",
  "targetTier",
  "rootCause",
  "truePositiveAlertIds",
  "acceptableAlternatives",
];

describe("toClientView Anti-Cheat & Zero-Knowledge Guarantee", () => {
  it("never includes any ground-truth fields in demo scenario client projection", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const scenario = parseYaml(raw) as SocScenario;

    const clientView = toClientView(scenario);
    const json = JSON.stringify(clientView);

    for (const denied of DENIED_STRINGS) {
      expect(json).not.toContain(`"${denied}"`);
    }

    // Verify secret strings from ground truth do not appear
    expect(json).not.toContain(scenario.groundTruth.overallDebrief);
    for (const inc of scenario.groundTruth.incidents) {
      expect(json).not.toContain(inc.rootCause);
    }
    for (const alert of scenario.alerts) {
      expect(json).not.toContain(alert.groundTruth.debrief);
    }
  });

  it("property test: over 50 randomized synthetic scenarios, toClientView never leaks ground truth", () => {
    for (let i = 0; i < 50; i++) {
      const mockAlerts: SocAlert[] = Array.from({ length: 10 }, (_, idx) => ({
        id: `alt-test-${idx}`,
        timestamp: new Date(Date.now() - idx * 60000).toISOString(),
        source: "EDR",
        ruleName: `TEST_RULE_${idx}`,
        severity: "HIGH",
        summary: `Synthetic test alert ${idx}`,
        relatedAsset: "ws-test.corp.internal",
        relatedUser: "user-test",
        relatedIocs: [{ type: "ip", value: "192.0.2.1" }],
        linkedRawEvents: [],
        rawFields: { testKey: `val-${idx}` },
        groundTruth: {
          kind: idx % 2 === 0 ? "true_positive" : "false_positive",
          correctDisposition: idx % 2 === 0 ? "true_positive" : "false_positive",
          correctSeverity: "HIGH",
          correctEscalation: idx % 2 === 0,
          incidentId: idx % 2 === 0 ? "inc-01" : undefined,
          debrief: `TOP_SECRET_ALERT_DEBRIEF_${i}_${idx}`,
          acceptableAlternatives: [],
        },
      }));

      const syntheticScenario: SocScenario = {
        id: `synthetic-${i}`,
        version: 1,
        title: `Synthetic Scenario ${i}`,
        level: "L1",
        estimatedMinutes: 30,
        skillsTested: ["soc_alert_triage"],
        difficulty: "beginner",
        briefing: "Synthetic briefing",
        environment: {
          assets: [
            {
              id: "ast-01",
              hostname: "ws-test.corp.internal",
              ip: "10.0.0.1",
              role: "Workstation",
              os: "Windows 11",
              criticality: "LOW",
              owner: "user-test",
              zone: "zone-01",
            },
          ],
          users: [
            {
              id: "usr-01",
              username: "user-test",
              email: "test@corp.internal",
              displayName: "Test User",
              department: "IT",
              role: "Tester",
            },
          ],
          networkZones: [
            { id: "zone-01", name: "Test Zone", cidr: "10.0.0.0/24", description: "Test" },
          ],
        },
        rawEvents: [],
        alerts: mockAlerts,
        groundTruth: {
          incidents: [
            {
              id: "inc-01",
              title: "Incident Title",
              category: "malware",
              description: "Incident Description",
              timeline: ["Step 1"],
              truePositiveAlertIds: ["alt-test-0"],
              rootCause: `SUPER_SECRET_ROOT_CAUSE_${i}`,
              mitre: ["T1001"],
            },
          ],
          overallDebrief: `TOP_SECRET_OVERALL_DEBRIEF_${i}`,
        },
        enrichmentSources: [],
        evidenceViews: [],
        instantFeedback: false,
        examMode: false,
      };

      const client = toClientView(syntheticScenario);
      const serialized = JSON.stringify(client);

      for (const denied of DENIED_STRINGS) {
        expect(serialized).not.toContain(`"${denied}"`);
      }
      expect(serialized).not.toContain(`SUPER_SECRET_ROOT_CAUSE_${i}`);
      expect(serialized).not.toContain(`TOP_SECRET_OVERALL_DEBRIEF_${i}`);
      for (let idx = 0; idx < 10; idx++) {
        expect(serialized).not.toContain(`TOP_SECRET_ALERT_DEBRIEF_${i}_${idx}`);
      }
    }
  });
});
