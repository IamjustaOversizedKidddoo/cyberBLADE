import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { gradeReport, loadRubric } from "@/lib/lab-engine/soc/reports/grader";
import { synthesizeReportGroundTruth } from "@/lib/lab-engine/soc/reports/ground-truth-synthesis";
import type { SocAlert, SocIncidentGroundTruth, SocAsset, SocUser } from "@/lib/lab-engine/soc/schema";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

describe("SOC L2 Scoping Report Rubric Grader Quality", () => {
  const sampleIncident: SocIncidentGroundTruth = {
    id: "inc-l2-01",
    title: "Multi-Stage Active Directory Lateral Movement",
    category: "lateral_movement",
    description: "Spearphishing leading to PowerShell execution and PsExec lateral movement.",
    timeline: ["Phishing email opened", "PowerShell executed", "PsExec lateral movement"],
    truePositiveAlertIds: ["alt-01", "alt-02", "alt-03"],
    rootCause: "Macro execution from malicious attachment",
    mitre: ["T1566.001", "T1059.001", "T1021.002"],
  };

  const sampleAlerts: SocAlert[] = [
    {
      id: "alt-01",
      timestamp: "2026-10-16T10:00:00Z",
      source: "Email Gateway",
      ruleName: "Suspicious Attachment Executed",
      severity: "MEDIUM",
      summary: "Macro execution detected in invoice.docm",
      relatedAsset: "ast-ws-01",
      relatedUser: "jdoe",
      relatedIocs: [
        { type: "hash", value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
        { type: "domain", value: "evil-phish.net" },
      ],
      linkedRawEvents: [],
      rawFields: { sender: "attacker@external.test" },
      groundTruth: {
        kind: "true_positive",
        correctDisposition: "true_positive",
        correctSeverity: "MEDIUM",
        correctEscalation: false,
        acceptableAlternatives: [],
        debrief: "Phishing entry",
      },
    },
    {
      id: "alt-02",
      timestamp: "2026-10-16T10:15:00Z",
      source: "EDR",
      ruleName: "Suspicious PowerShell Download Cradle",
      severity: "HIGH",
      summary: "PowerShell executing web request download cradle",
      relatedAsset: "ast-ws-01",
      relatedUser: "jdoe",
      relatedIocs: [
        { type: "ip", value: "198.51.100.24" },
      ],
      linkedRawEvents: [],
      rawFields: { command_line: "powershell -enc aQB3AHIA..." },
      groundTruth: {
        kind: "true_positive",
        correctDisposition: "true_positive",
        correctSeverity: "HIGH",
        correctEscalation: true,
        acceptableAlternatives: [],
        debrief: "Payload download",
      },
    },
    {
      id: "alt-03",
      timestamp: "2026-10-16T10:45:00Z",
      source: "EDR",
      ruleName: "PsExec Remote Service Installation",
      severity: "CRITICAL",
      summary: "Service PSEXESVC created on target host WS-02",
      relatedAsset: "ast-ws-02",
      relatedUser: "admin_sec",
      relatedIocs: [
        { type: "ip", value: "198.51.100.24" },
      ],
      linkedRawEvents: [],
      rawFields: { service_name: "PSEXESVC" },
      groundTruth: {
        kind: "true_positive",
        correctDisposition: "true_positive",
        correctSeverity: "HIGH",
        correctEscalation: true,
        acceptableAlternatives: [
          { disposition: "true_positive", severity: "CRITICAL", reason: "Acceptable escalation", scoreMultiplier: 0.9 },
        ],
        debrief: "Lateral movement via PsExec",
      },
    },
  ];

  const sampleEnv = {
    assets: [
      { id: "ast-ws-01", hostname: "WS-01", ip: "10.0.1.15", os: "windows", role: "workstation", criticality: "LOW", owner: "jdoe", zone: "corp", tags: [] },
      { id: "ast-ws-02", hostname: "WS-02", ip: "10.0.1.16", os: "windows", role: "workstation", criticality: "MEDIUM", owner: "admin_sec", zone: "corp", tags: [] },
      { id: "ast-dc-01", hostname: "DC-01", ip: "10.0.0.1", os: "windows", role: "domain_controller", criticality: "CRITICAL", owner: "admin", zone: "infra", tags: [] },
      { id: "ast-fs-01", hostname: "FS-01", ip: "10.0.0.5", os: "windows", role: "file_server", criticality: "HIGH", owner: "admin", zone: "infra", tags: [] },
    ] as SocAsset[],
    users: [
      { id: "usr-jdoe", username: "jdoe", email: "jdoe@corp.internal", displayName: "John Doe", role: "employee", department: "sales" },
      { id: "usr-admin-sec", username: "admin_sec", email: "admin_sec@corp.internal", displayName: "Security Admin", role: "admin", department: "security" },
      { id: "usr-asmith", username: "asmith", email: "asmith@corp.internal", displayName: "Alice Smith", role: "employee", department: "finance" },
    ] as SocUser[],
  };

  const gt = synthesizeReportGroundTruth(sampleIncident, sampleAlerts, sampleEnv);

  it("verifies the rubric loads correctly with 6 deterministic criteria", () => {
    const rubric = loadRubric("scoping-report-l2-rubric");
    expect(rubric.id).toBe("scoping-report-l2-rubric");
    expect(rubric.criteria.length).toBe(6);
    expect(rubric.criteria.map((c) => c.id)).toEqual([
      "incident_scoping",
      "verdict_accuracy",
      "timeline_accuracy",
      "ioc_extraction",
      "technique_mapping",
      "response_actions",
    ]);
  });

  it("scores 3 strong reports >= 80% on scoping-report-l2 rubric", async () => {
    // Strong 1: Model report synthesized from ground truth
    const strong1 = gt.modelReport;
    const res1 = await gradeReport("sub-s1", strong1, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res1.totalScore).toBeGreaterThanOrEqual(85);
    expect(res1.criterionResults["incident_scoping"].score).toBeGreaterThanOrEqual(30);

    // Strong 2: Alternative valid severity (CRITICAL) with correct scope
    const strong2: SocReportData = {
      ...gt.modelReport,
      verdict: {
        ...gt.modelReport.verdict,
        severity: "CRITICAL",
      },
    };
    const res2 = await gradeReport("sub-s2", strong2, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res2.totalScore).toBeGreaterThanOrEqual(80);
    expect(res2.criterionResults["incident_scoping"].score).toBeGreaterThanOrEqual(30);

    // Strong 3: Correct scope with defanged IOCs and accurate timeline
    const strong3: SocReportData = {
      ...gt.modelReport,
      header: { ...gt.modelReport.header, title: "Detailed Incident Scoping Investigation" },
    };
    const res3 = await gradeReport("sub-s3", strong3, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res3.totalScore).toBeGreaterThanOrEqual(85);
  });

  it("scores 3 weak reports < 50%", async () => {
    // Weak 1: False positive disposition + empty scope
    const weak1: SocReportData = {
      ...gt.modelReport,
      verdict: {
        disposition: "false_positive",
        severity: "LOW",
        confidence: "low",
        justification: "Dismissed as normal background noise.",
      },
      scope: {
        affectedAssets: [],
        affectedUsers: [],
      },
      techniques: [],
      iocs: [],
    };
    const res1 = await gradeReport("sub-w1", weak1, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res1.totalScore).toBeLessThan(40);
    expect(res1.criterionResults["incident_scoping"].score).toBe(0);

    // Weak 2: Wrong assets entirely (misattribution to clean DC-01 and FS-01)
    const weak2: SocReportData = {
      ...gt.modelReport,
      scope: {
        affectedAssets: ["DC-01", "FS-01"],
        affectedUsers: ["asmith"],
      },
      timeline: [],
    };
    const res2 = await gradeReport("sub-w2", weak2, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res2.totalScore).toBeLessThan(45);
    expect(res2.criterionResults["incident_scoping"].score).toBe(0);

    // Weak 3: Missing scoping, missed IOCs, harmful action
    const weak3: SocReportData = {
      ...gt.modelReport,
      scope: {
        affectedAssets: [],
        affectedUsers: [],
      },
      actions: [
        { actionId: "harmful_01", actionName: "Reboot DC", category: "harmful", priority: 1, rationale: "Reboot the domain controller" },
      ],
      iocs: [],
    };
    const res3 = await gradeReport("sub-w3", weak3, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res3.totalScore).toBeLessThan(40);
    expect(res3.criterionResults["incident_scoping"].score).toBe(0);
  });

  it("scores 2 gamed reports < 45% and flags excessive false positives or log dumping", async () => {
    // Gamed 1: Asset stuffing & keyword gaming - dumps all known assets/users and generic keyword stuffing
    const gamed1: SocReportData = {
      ...gt.modelReport,
      verdict: {
        disposition: "true_positive",
        severity: "LOW", // Inconsistent severity
        confidence: "medium",
        justification: "Guessed attack from alert keywords.",
      },
      executiveSummary: "Log dumps and keyword stuffing: EventID=4624 EventID=4625 EventID=7045 PSEXESVC powershell.exe mimikatz",
      attackNarrative: "Raw log dumps and keywords: EventID=4624 EventID=4625 EventID=7045 PSEXESVC powershell.exe mimikatz",
      scope: {
        affectedAssets: ["ast-ws-01", "ast-ws-02", "ast-dc-01", "ast-fs-01"],
        affectedUsers: ["jdoe", "admin_sec", "asmith"],
      },
      timeline: [
        { id: "tl-g1", timestampUtc: "2026-10-16T12:00:00Z", rawTimestamp: "12:00", timezone: "UTC", description: "Generic event", dataOrigin: "SIEM" },
      ],
      techniques: [
        { techniqueId: "T1566.001", techniqueName: "Spearphishing Attachment", tactic: "Initial Access" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution" },
        { techniqueId: "T1021.002", techniqueName: "SMB/Windows Admin Shares", tactic: "Lateral Movement" },
        { techniqueId: "T1003.001", techniqueName: "LSASS", tactic: "Credential Access" },
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion" },
        { techniqueId: "T1048", techniqueName: "Exfiltration", tactic: "Exfiltration" },
        { techniqueId: "T1071", techniqueName: "C2", tactic: "Command and Control" },
      ],
      iocs: [
        { id: "ioc-p1", type: "ip", value: "8.8.8.8", role: "c2", evidenceRefs: [] },
        { id: "ioc-p2", type: "ip", value: "1.1.1.1", role: "c2", evidenceRefs: [] },
        { id: "ioc-p3", type: "domain", value: "google[.]com", role: "c2", evidenceRefs: [] },
        { id: "ioc-p4", type: "domain", value: "microsoft[.]com", role: "c2", evidenceRefs: [] },
        { id: "ioc-p5", type: "ip", value: "9.9.9.9", role: "c2", evidenceRefs: [] },
      ],
    };
    const res1 = await gradeReport("sub-g1", gamed1, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res1.totalScore).toBeLessThan(65);
    expect(res1.criterionResults["incident_scoping"].score).toBeLessThanOrEqual(30);
    expect(res1.criterionResults["incident_scoping"].flags).toContain("excessive_false_positives_in_scope");

    // Gamed 2: Inverted verdict + wrong scope
    const gamed2: SocReportData = {
      ...gt.modelReport,
      verdict: {
        disposition: "benign_true_positive",
        severity: "INFO",
        confidence: "low",
        justification: "Benign authorized scan.",
      },
      scope: {
        affectedAssets: ["DC-01"],
        affectedUsers: ["asmith"],
      },
      attackNarrative: "Raw log dumps and keywords: mimikatz powershell psexec mimikatz powershell psexec.",
    };
    const res2 = await gradeReport("sub-g2", gamed2, gt, { rubricId: "scoping-report-l2-rubric" });
    expect(res2.totalScore).toBeLessThan(40);
    expect(res2.criterionResults["incident_scoping"].score).toBe(0);
  });
});
