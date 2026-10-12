import { describe, it, expect } from "vitest";
import { toClientView, type SocScenario } from "@/lib/lab-engine/soc/schema";

function generateSyntheticScenario(alertCount = 600): SocScenario {
  const sources = ["EDR", "Network IDS", "Email Gateway", "Firewall", "Authentication", "Cloud Audit"] as const;
  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

  const alerts = Array.from({ length: alertCount }, (_, i) => {
    const isTP = i % 10 === 0;
    const source = sources[i % sources.length];
    const severity = severities[i % severities.length];

    return {
      id: `syn-alt-${String(i + 1).padStart(4, "0")}`,
      timestamp: new Date(1760256000000 + i * 30000).toISOString(),
      source,
      ruleName: `SYNTHETIC_DETECTION_RULE_${(i % 25) + 1}`,
      severity,
      summary: `Automated synthetic telemetry event ${i + 1} monitoring network host`,
      relatedAsset: `srv-workstation-${(i % 50) + 1}.corp.internal`,
      relatedUser: `user${(i % 30) + 1}`,
      relatedIocs: [{ type: "ip" as const, value: `10.0.${Math.floor(i / 250)}.${(i % 250) + 1}` }],
      linkedRawEvents: [],
      rawFields: {
        event_id: String(i + 1),
        process_name: i % 2 === 0 ? "cmd.exe" : "powershell.exe",
        command_line: `-syn -run arg${i}`,
      },
      groundTruth: {
        kind: (isTP ? "true_positive" : "false_positive") as "true_positive" | "false_positive",
        correctDisposition: (isTP ? "true_positive" : "false_positive") as "true_positive" | "false_positive",
        correctSeverity: severity,
        correctEscalation: isTP,
        acceptableAlternatives: [],
        debrief: `Debrief explanation for synthetic alert ${i + 1}`,
      },
    };
  });

  return {
    id: "synthetic-performance-scenario-600",
    version: 1,
    title: "Synthetic 600-Alert Performance Stress Test",
    level: "L1",
    estimatedMinutes: 60,
    skillsTested: ["soc_alert_triage", "soc_incident_correlation"],
    difficulty: "advanced",
    briefing: "Synthetic benchmark scenario.",
    rawEvents: [],
    enrichmentSources: [],
    evidenceViews: [],
    instantFeedback: false,
    examMode: false,
    environment: {
      assets: Array.from({ length: 50 }, (_, i) => ({
        id: `ast-${i + 1}`,
        hostname: `srv-workstation-${i + 1}.corp.internal`,
        ip: `10.0.1.${i + 1}`,
        role: "Workstation",
        os: "Windows 11",
        criticality: "LOW" as const,
        owner: "Finance",
        zone: "CorpNet",
        tags: ["synthetic"],
      })),
      users: Array.from({ length: 30 }, (_, i) => ({
        id: `usr-${i + 1}`,
        username: `user${i + 1}`,
        email: `user${i + 1}@corp.internal`,
        displayName: `Synthetic User ${i + 1}`,
        department: "Operations",
        role: "Operator",
      })),
      networkZones: [{ id: "z1", name: "CorpNet", cidr: "10.0.1.0/24", description: "Synthetic zone" }],
    },
    alerts,
    groundTruth: {
      incidents: [
        {
          id: "syn-inc-1",
          title: "Synthetic Incident Alpha",
          category: "Execution",
          description: "Synthetic test incident.",
          timeline: ["2026-10-12T10:00:00Z"],
          truePositiveAlertIds: ["syn-alt-0001", "syn-alt-0011"],
          rootCause: "Adversary test payload.",
          mitre: ["T1059.001"],
        },
      ],
      overallDebrief: "Synthetic test overall debrief.",
    },
  };
}

describe("SOC Queue Performance & Memory Benchmark", () => {
  it("projects, filters, and sorts a 600-alert synthetic queue with high responsiveness", () => {
    const scenario = generateSyntheticScenario(600);
    expect(scenario.alerts.length).toBe(600);

    // 1. Measure client projection speed
    const startProj = performance.now();
    const clientView = toClientView(scenario);
    const projDurationMs = performance.now() - startProj;

    expect(clientView.alerts.length).toBe(600);
    // Projection must complete in under 50ms
    expect(projDurationMs).toBeLessThan(50);

    // 2. Measure search filtering speed across 600 alerts
    const startFilter = performance.now();
    const filtered = clientView.alerts.filter((a) => {
      const q = "powershell";
      return (
        a.ruleName.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        (a.rawFields.process_name as string)?.includes(q)
      );
    });
    const filterDurationMs = performance.now() - startFilter;

    expect(filtered.length).toBeGreaterThan(0);
    // Filtering 600 complex alerts must complete in under 20ms
    expect(filterDurationMs).toBeLessThan(20);

    // 3. Measure sorting speed across 600 alerts
    const startSort = performance.now();
    const sorted = [...clientView.alerts].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const sortDurationMs = performance.now() - startSort;

    expect(sorted.length).toBe(600);
    // Sorting 600 items must complete in under 15ms
    expect(sortDurationMs).toBeLessThan(15);
  });
});
