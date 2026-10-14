import type { SocReportData } from "./types";
import { sanitizeReportText } from "./sanitizer";

/**
 * Creates empty skeleton report data
 */
export function createEmptyReportData(
  analystHandle: string,
  caseId = "case-001",
  title = "Incident Report",
): SocReportData {
  return {
    header: {
      title: sanitizeReportText(title),
      caseId,
      analystHandle,
      createdAt: new Date().toISOString(),
      classification: "true_positive",
    },
    executiveSummary: "",
    verdict: {
      disposition: "true_positive",
      severity: "MEDIUM",
      confidence: "medium",
      justification: "",
    },
    scope: {
      affectedAssets: [],
      affectedUsers: [],
      systemsAtRisk: "",
      businessImpact: "",
    },
    timeline: [],
    iocs: [],
    attackNarrative: "",
    techniques: [],
    actions: [
      {
        actionId: "isolate-host",
        actionName: "Isolate Compromised Host",
        category: "containment",
        priority: 1,
        rationale: "Isolate host from local network segment to contain potential lateral movement.",
      },
    ],
    escalation: {
      requiresEscalation: true,
      targetTeam: "Tier-2 Incident Response",
      urgency: "priority",
      handoffSummary: "",
    },
    lessonsLearned: "",
    evidenceAppendix: [],
  };
}
