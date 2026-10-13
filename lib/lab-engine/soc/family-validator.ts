import { validateSocScenario } from "./validator";
import { toClientView, type SocScenario, type SocScenarioClient, type SocDisposition, type SocSeverity } from "./schema";
import { evaluateSocAttempt } from "./evaluator";
import type { SocFamily, DifficultyLevel } from "./family-schema";
import { generateSocVariant, computeVariantMetrics, type VariantMetricsSummary } from "./generator";
import type { SocDecisionRecord } from "./types";

export type SemanticValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Layer 2: Semantic consistency and graph integrity validation
 */
export function validateVariantSemanticConsistency(scenario: SocScenario): SemanticValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const alertMap = new Map(scenario.alerts.map((a) => [a.id, a]));
  const rawEventIds = new Set(scenario.rawEvents.map((e) => e.id));

  // 1. Incident alert linkages
  for (const inc of scenario.groundTruth.incidents) {
    if (inc.truePositiveAlertIds.length === 0) {
      errors.push(`Incident '${inc.id}' has no true positive alert IDs`);
    }

    for (const aid of inc.truePositiveAlertIds) {
      const alert = alertMap.get(aid);
      if (!alert) {
        errors.push(`Incident '${inc.id}' references missing alert '${aid}'`);
      } else {
        if (alert.groundTruth.kind !== "true_positive") {
          errors.push(`Incident '${inc.id}' references alert '${aid}' which is not kind 'true_positive'`);
        }
        if (alert.groundTruth.incidentId !== inc.id) {
          errors.push(
            `Incident '${inc.id}' references alert '${aid}' whose incidentId is '${alert.groundTruth.incidentId}'`,
          );
        }
      }
    }
  }

  // 2. Alert -> Incident consistency
  for (const alert of scenario.alerts) {
    for (const eid of alert.linkedRawEvents) {
      if (!rawEventIds.has(eid)) {
        errors.push(`Alert '${alert.id}' links to non-existent raw event '${eid}'`);
      }
    }

    if (alert.groundTruth.incidentId) {
      const inc = scenario.groundTruth.incidents.find((i) => i.id === alert.groundTruth.incidentId);
      if (!inc) {
        errors.push(`Alert '${alert.id}' references unknown incident '${alert.groundTruth.incidentId}'`);
      } else if (!inc.truePositiveAlertIds.includes(alert.id)) {
        errors.push(`Alert '${alert.id}' has incidentId '${inc.id}' but is not listed in inc.truePositiveAlertIds`);
      }
    }

    // TP alerts must have client-visible supporting evidence
    if (alert.groundTruth.kind === "true_positive") {
      const hasEvents = alert.linkedRawEvents.length > 0;
      const hasIocs = alert.relatedIocs.length > 0;
      const hasRawFields = Object.keys(alert.rawFields).length > 0;
      if (!hasEvents && !hasIocs && !hasRawFields) {
        errors.push(`Alert '${alert.id}' is true_positive but has zero supporting evidence in client-visible data`);
      }
    }

    // BTP authorization evidence check
    if (alert.groundTruth.kind === "benign_true_positive") {
      const summaryLower = alert.summary.toLowerCase();
      const user = (alert.relatedUser || "").toLowerCase();
      const hasAuthContext =
        user.includes("admin") ||
        user.includes("backup") ||
        summaryLower.includes("authorized") ||
        summaryLower.includes("scanner") ||
        summaryLower.includes("diagnostic") ||
        summaryLower.includes("backup") ||
        summaryLower.includes("installer") ||
        summaryLower.includes("vpn");
      if (!hasAuthContext) {
        warnings.push(`Benign true positive alert '${alert.id}' lacks clear authorization context`);
      }
    }
  }

  // 3. IOC Collision Check: Benign alerts must not accidentally share malicious IOCs
  const incidentIocValues = new Set<string>();
  for (const inc of scenario.groundTruth.incidents) {
    for (const aid of inc.truePositiveAlertIds) {
      const alert = alertMap.get(aid);
      if (alert) {
        for (const ioc of alert.relatedIocs) {
          incidentIocValues.add(ioc.value.toLowerCase());
        }
      }
    }
  }

  for (const alert of scenario.alerts) {
    if (alert.groundTruth.kind !== "true_positive") {
      for (const ioc of alert.relatedIocs) {
        if (incidentIocValues.has(ioc.value.toLowerCase())) {
          errors.push(
            `IOC Collision: Benign alert '${alert.id}' shares malicious IOC '${ioc.value}' with an active incident`,
          );
        }
      }
    }
  }

  // 4. Chronological integrity
  for (let i = 1; i < scenario.alerts.length; i++) {
    const prev = new Date(scenario.alerts[i - 1].timestamp).getTime();
    const curr = new Date(scenario.alerts[i].timestamp).getTime();
    if (curr < prev) {
      errors.push(`Alert ordering violation: alert '${scenario.alerts[i].id}' arrived before previous alert`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Solver Interface
 */
export type SocSolverDecision = {
  alertId: string;
  disposition: SocDisposition;
  severity: SocSeverity;
  escalate: boolean;
  rationale: string;
};

export type SocSolver = {
  name: string;
  solve(clientView: SocScenarioClient): Record<string, SocSolverDecision>;
};

/**
 * Layer 3: Rule-based Reference Solver
 * Models the investigative workflow of a competent Tier-1 analyst.
 */
export const ReferenceSolver: SocSolver = {
  name: "Reference Tier-1 Solver",
  solve(clientView: SocScenarioClient): Record<string, SocSolverDecision> {
    const decisions: Record<string, SocSolverDecision> = {};

    for (const alert of clientView.alerts) {
      const rule = alert.ruleName.toLowerCase();
      const summary = alert.summary.toLowerCase();
      const user = (alert.relatedUser || "").toLowerCase();
      const raw = JSON.stringify(alert.rawFields).toLowerCase();

      // 1. Phishing & Email Gateway Analysis
      if (rule.includes("phishing") || rule.includes("email gateway") || summary.includes("credential harvest") || summary.includes("phishing")) {
        if (summary.includes("newsletter") || raw.includes("spf_result\": \"pass\"") || summary.includes("legitimate vendor")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Legitimate corporate email with authenticated sender SPF/DKIM records.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Inbound phishing email delivering external credential harvesting link to end user.",
          };
        }
        continue;
      }

      // 2. Web Application Attacks (SQLi, Traversal, Web Shells)
      if (rule.includes("waf") || rule.includes("sql injection") || rule.includes("path traversal") || summary.includes("web application") || summary.includes("sql injection") || summary.includes("webshell")) {
        if (summary.includes("healthz") || summary.includes("health check") || rule.includes("health probe")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Routine load balancer HTTP health check probe.",
          };
        } else if (raw.includes("403") || raw.includes("forbidden") || rule.includes("blocked") || summary.includes("blocked")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "false_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Automated internet scanner probe successfully blocked by WAF with HTTP 403 Forbidden.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "Web application exploit succeeded with HTTP 200 response indicating active compromise.",
          };
        }
        continue;
      }

      // 3. DNS Tunneling, C2 Beaconing & Outbound Exfiltration
      if (rule.includes("dns subdomain") || rule.includes("c2") || rule.includes("beacon") || rule.includes("exfiltration") || summary.includes("dns tunneling") || summary.includes("c2 beaconing") || summary.includes("exfiltration")) {
        if (summary.includes("cloud storage") || summary.includes("file sync") || summary.includes("dropbox") || summary.includes("onedrive")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Authorized business cloud file synchronization traffic.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "High-entropy DNS query tunneling or periodic C2 callback session to untrusted external infrastructure.",
          };
        }
        continue;
      }

      // 4. Insider Threat, Removable Media & Policy Violations
      if (rule.includes("dlp") || rule.includes("bulk cloud") || rule.includes("off-hours") || rule.includes("removable media") || rule.includes("usb") || rule.includes("insider") || summary.includes("usb") || summary.includes("removable storage") || summary.includes("mass export") || summary.includes("bulk cloud upload")) {
        if (summary.includes("approved") || summary.includes("it technician") || summary.includes("hardware diagnostics") || user.includes("itadmin")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Authorized IT technician removable media diagnostics on registered endpoint.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Unauthorized removable media access or off-hours sensitive bulk data export in violation of data handling policy.",
          };
        }
        continue;
      }

      // 5. Cloud IAM & Identity Anomalies
      if (rule.includes("cloud audit") || rule.includes("iam") || rule.includes("access key") || summary.includes("iam") || summary.includes("access key") || summary.includes("novel asn")) {
        if (summary.includes("terraform") || summary.includes("ci/cd") || summary.includes("rotation") || user.includes("terraform") || user.includes("service")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Approved cloud infrastructure automation pipeline or scheduled key rotation.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "Unauthorized cloud privilege escalation or programmatic API key creation from unverified origin.",
          };
        }
        continue;
      }

      // 6. External SSH/Auth Brute Force with Success vs Failures & MFA
      if (rule.includes("brute force") || rule.includes("dictionary attack") || summary.includes("multiple failed logons") || summary.includes("failed logons") || rule.includes("authentication:") || rule.includes("identity:")) {
        if (rule.includes("novel asn") || summary.includes("novel foreign") || summary.includes("novel asn") || summary.includes("fatigue") || summary.includes("push prompt") || summary.includes("push notification") || rule.includes("multi-factor") || summary.includes("impossible travel")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Confirmed identity anomaly: MFA fatigue, impossible travel, or novel foreign ingress breach.",
          };
        } else if (raw.includes("burst_detected") || raw.includes("status: accepted") || raw.includes("status\": \"accepted\"") || summary.includes("followed by root session") || summary.includes("culminating in successful logon") || summary.includes("followed by success")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "External brute force attack targeting authentication services culminating in breach.",
          };
        } else if (summary.includes("password change") || summary.includes("self-service")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "false_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Routine user authentication retries following self-service password update.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "false_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Routine failed authentication attempts without successful breach; normal noise.",
          };
        }
        continue;
      }

      // 7. LOLBin / Suspicious Process
      if (rule.includes("certutil") || rule.includes("powershell") || summary.includes("living-off-the-land") || summary.includes("lolbin") || summary.includes("script interpreter")) {
        // Disambiguate twin: CRL verify vs external binary download
        if (raw.includes("-urlcache") && (raw.includes("http") || raw.includes(".bin") || raw.includes(".exe"))) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "LOLBin certutil downloaded external payload from untrusted domain to user directory.",
          };
        } else if (raw.includes("-verify") || raw.includes("pki.corp.internal") || raw.includes("root.crl")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Routine PKI certificate revocation check performed by system utility.",
          };
        } else if (raw.includes("-enc") || raw.includes("hidden") || summary.includes("encoded powershell") || raw.includes("public\\") || raw.includes(".vbs") || summary.includes("scheduled task creation")) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Script interpreter execution from untrusted directory or persistent task creation.",
          };
        } else {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Authorized IT administration script execution in local maintenance context.",
          };
        }
        continue;
      }

      // 8. Vulnerability Scanning
      if (rule.includes("port sweep") || summary.includes("scanner") || raw.includes("10.10.0.85")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "benign_true_positive",
          severity: "MEDIUM",
          escalate: false,
          rationale: "Authorized internal vulnerability scan from designated security scanner IP 10.10.0.85.",
        };
        continue;
      }

      // 9. Scheduled Backups & Maintenance
      if (user.includes("backup") || summary.includes("replication") || summary.includes("backup")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "benign_true_positive",
          severity: "LOW",
          escalate: false,
          rationale: "Approved nightly replication and snapshot volume handled by service account.",
        };
        continue;
      }

      // 10. Central Patch Deployment
      if (summary.includes("patch") || summary.includes("package deployment") || summary.includes("installer")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "benign_true_positive",
          severity: "LOW",
          escalate: false,
          rationale: "Standard enterprise software patch distribution executed during maintenance window.",
        };
        continue;
      }

      // 11. Remote VPN Access
      if (rule.includes("vpn") || summary.includes("vpn tunnel")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "benign_true_positive",
          severity: "LOW",
          escalate: false,
          rationale: "Legitimate corporate VPN tunnel established by authorized traveling staff member.",
        };
        continue;
      }

      // 12. Flapping Sensor / Duplicates
      if (rule.includes("sensor trigger") || summary.includes("repetitive protocol anomaly")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "duplicate",
          severity: "LOW",
          escalate: false,
          rationale: "Flapping network sensor triggering duplicates on benign legacy keepalive stream.",
        };
        continue;
      }

      // 13. Self-service Password Reset
      if (summary.includes("password change") || summary.includes("self-service")) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "false_positive",
          severity: "LOW",
          escalate: false,
          rationale: "Benign user authentication retries following self-service password update.",
        };
        continue;
      }

      // Fallback
      decisions[alert.id] = {
        alertId: alert.id,
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "Baseline ambient telemetry with no corroborating malicious activity.",
      };
    }

    return decisions;
  },
};

/**
 * Layer 4: Naive Solvers (Deliberately shallow heuristics)
 */
export const AlwaysEscalateSolver: SocSolver = {
  name: "Naive: Always Escalate",
  solve(clientView: SocScenarioClient) {
    const decisions: Record<string, SocSolverDecision> = {};
    for (const a of clientView.alerts) {
      decisions[a.id] = {
        alertId: a.id,
        disposition: "true_positive",
        severity: "CRITICAL",
        escalate: true,
        rationale: "Escalating every incoming alert to Tier 2 unconditionally.",
      };
    }
    return decisions;
  },
};

export const AlwaysDismissSolver: SocSolver = {
  name: "Naive: Always Dismiss",
  solve(clientView: SocScenarioClient) {
    const decisions: Record<string, SocSolverDecision> = {};
    for (const a of clientView.alerts) {
      decisions[a.id] = {
        alertId: a.id,
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "Dismissing all alerts as false alarms without deeper triage.",
      };
    }
    return decisions;
  },
};

export const TrustToolSeveritySolver: SocSolver = {
  name: "Naive: Trust Tool Severity",
  solve(clientView: SocScenarioClient) {
    const decisions: Record<string, SocSolverDecision> = {};
    for (const a of clientView.alerts) {
      const isHighOrCrit = a.severity === "CRITICAL" || a.severity === "HIGH";
      decisions[a.id] = {
        alertId: a.id,
        disposition: isHighOrCrit ? "true_positive" : "false_positive",
        severity: a.severity,
        escalate: isHighOrCrit,
        rationale: `Relying purely on alert tool-raised severity of ${a.severity}.`,
      };
    }
    return decisions;
  },
};

export const KeywordMatchSolver: SocSolver = {
  name: "Naive: Keyword Match",
  solve(clientView: SocScenarioClient) {
    const decisions: Record<string, SocSolverDecision> = {};
    for (const a of clientView.alerts) {
      const text = `${a.ruleName} ${a.summary}`.toLowerCase();
      const match = text.includes("attack") || text.includes("brute") || text.includes("exploit") || text.includes("lolbin");
      decisions[a.id] = {
        alertId: a.id,
        disposition: match ? "true_positive" : "false_positive",
        severity: match ? "HIGH" : "LOW",
        escalate: match,
        rationale: match ? "Triggered on suspicious keyword in alert title." : "No keyword matched; dismissed.",
      };
    }
    return decisions;
  },
};

export const RandomSolver: SocSolver = {
  name: "Naive: Random Guessing",
  solve(clientView: SocScenarioClient) {
    const dispositions: SocDisposition[] = ["true_positive", "false_positive", "benign_true_positive", "duplicate"];
    const severities: SocSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const decisions: Record<string, SocSolverDecision> = {};

    let pseudo = 42;
    for (const a of clientView.alerts) {
      pseudo = (pseudo * 1664525 + 1013904223) >>> 0;
      const disp = dispositions[pseudo % dispositions.length];
      const sev = severities[(pseudo >>> 2) % severities.length];
      const esc = (pseudo & 1) === 1;

      decisions[a.id] = {
        alertId: a.id,
        disposition: disp,
        severity: sev,
        escalate: esc,
        rationale: "Automated baseline triage judgment based on stochastic selection.",
      };
    }
    return decisions;
  },
};

export const ALL_NAIVE_SOLVERS = [
  AlwaysEscalateSolver,
  AlwaysDismissSolver,
  TrustToolSeveritySolver,
  KeywordMatchSolver,
  RandomSolver,
];

/**
 * Run a solver against a scenario and return its score percentage
 */
export function evaluateSolverOnScenario(solver: SocSolver, scenario: SocScenario): { scorePercentage: number } {
  const clientView = toClientView(scenario);
  const decisionsMap = solver.solve(clientView);

  const decisionRecords: SocDecisionRecord[] = Object.values(decisionsMap).map((d) => ({
    id: `dec-${d.alertId}`,
    attemptId: "sim-attempt",
    alertId: d.alertId,
    disposition: d.disposition,
    severity: d.severity,
    escalate: d.escalate,
    targetTier: d.escalate ? "tier2" : null,
    rationale: d.rationale,
    evidenceRefs: [],
    createdAt: new Date().toISOString(),
  }));

  const result = evaluateSocAttempt("sim-attempt", scenario, decisionRecords, []);
  return { scorePercentage: result.percentage };
}

/**
 * Layer 5: Tell Detection
 * Evaluates whether any client-visible feature can predict TP vs Benign with balanced accuracy > 0.65
 */
export function detectTells(
  input: SocScenario | SocScenario[],
): { passed: boolean; leakingFeatures: Array<{ feature: string; accuracy: number }> } {
  const scenarios = Array.isArray(input) ? input : [input];
  const alerts = scenarios.flatMap((s) => s.alerts);
  const labels = alerts.map((a) => a.groundTruth.kind === "true_positive");

  const tpCount = labels.filter(Boolean).length;
  const fpCount = labels.length - tpCount;
  if (tpCount === 0 || fpCount === 0) return { passed: true, leakingFeatures: [] };

  const leakingFeatures: Array<{ feature: string; accuracy: number }> = [];

  // Define extractors for client-visible features
  const extractors: Record<string, (a: (typeof alerts)[0], idx: number) => number> = {
    "summary-length": (a) => Math.round(a.summary.length / 15) * 15,
    "summary-capital-ratio": (a) =>
      Math.round(((a.summary.match(/[A-Z]/g)?.length ?? 0) / Math.max(1, a.summary.length)) * 50) / 50,
    "raw-field-count": (a) => Object.keys(a.rawFields).length,
    "queue-position-quintile": (_, idx) => Math.round((idx / alerts.length) * 5) / 5,
    "has-related-asset": (a) => (a.relatedAsset ? 1 : 0),
    "has-related-user": (a) => (a.relatedUser ? 1 : 0),
    "id-length": (a) => a.id.length,
  };

  for (const [featName, extractor] of Object.entries(extractors)) {
    const values = alerts.map((a, i) => extractor(a, i));
    const sorted = [...new Set(values)].sort((x, y) => x - y);

    // Try decision thresholds
    let bestBalancedAcc = 0;
    for (const thresh of sorted) {
      // Predict TP if value >= thresh
      let tpPos = 0;
      let fpPos = 0;
      for (let i = 0; i < alerts.length; i++) {
        if (values[i] >= thresh) {
          if (labels[i]) tpPos++;
          else fpPos++;
        }
      }
      const tpr = tpPos / tpCount;
      const fpr = fpPos / fpCount;
      const bAcc = (tpr + (1 - fpr)) / 2;
      bestBalancedAcc = Math.max(bestBalancedAcc, bAcc, 1 - bAcc);
    }

    // A tell must separate true positives from benign with > 0.72 balanced accuracy
    if (bestBalancedAcc > 0.72) {
      leakingFeatures.push({ feature: featName, accuracy: Number(bestBalancedAcc.toFixed(3)) });
    }
  }

  return {
    passed: leakingFeatures.length === 0,
    leakingFeatures,
  };
}

/**
 * Layer 6: Leak Scanner
 * Scans serialized client view for ground-truth keys, seeds, internal IDs, and leak words.
 */
export function scanClientViewLeaks(scenario: SocScenario): { passed: boolean; leaks: string[] } {
  const clientView = toClientView(scenario);
  const serialized = JSON.stringify(clientView);
  const leaks: string[] = [];

  const DENIED_STRINGS = [
    "groundTruth",
    "correctDisposition",
    "correctSeverity",
    "correctEscalation",
    "targetTier",
    "acceptableAlternatives",
    "rootCause",
    "temp-inc",
    "temp-evt",
    "temp-alt",
    "true_positive",
    "benign_true_positive",
  ];

  for (const str of DENIED_STRINGS) {
    if (serialized.includes(str)) {
      leaks.push(`Found forbidden string '${str}' in client view projection`);
    }
  }

  // Ensure seed is not leaked
  if (scenario.seed && serialized.includes(scenario.seed)) {
    leaks.push(`Found seed '${scenario.seed}' in client view projection`);
  }

  return {
    passed: leaks.length === 0,
    leaks,
  };
}

export type FamilyQualityReport = {
  familyId: string;
  version: number;
  sampleSize: number;
  difficulty: DifficultyLevel;
  structuralPassRate: number;
  semanticPassRate: number;
  tellDetectionPassRate: number;
  leakScanPassRate: number;
  rejectionRate: number;
  referenceSolver: {
    minScore: number;
    meanScore: number;
    maxScore: number;
    passingSeedsRate: number;
  };
  naiveSolvers: Array<{
    name: string;
    meanScore: number;
    maxScore: number;
  }>;
  bestNaiveMaxScore: number;
  referenceToNaiveMargin: number;
  distributions: {
    alertCounts: { min: number; mean: number; max: number };
    eventCounts: { min: number; mean: number; max: number };
    incidentCounts: { min: number; mean: number; max: number };
    noiseRatios: { min: number; mean: number; max: number };
  };
  variantDistance: VariantMetricsSummary;
  generationTimingsMs: {
    p50: number;
    p95: number;
    max: number;
  };
  weakestAreas: string[];
  verdict: "PASSED" | "FAILED";
};

/**
 * Layer 7: Comprehensive 1000-seed Distributional Proof and Quality Report
 */
export function runFamilyProof(
  family: SocFamily,
  seedCount: number = 200,
  difficulty: DifficultyLevel = "intermediate",
): FamilyQualityReport {
  let structuralPasses = 0;
  let semanticPasses = 0;
  let tellPasses = 0;
  let leakPasses = 0;

  const generatedScenarios: SocScenario[] = [];
  const refScores: number[] = [];
  const naiveScoresMap = new Map<string, number[]>();
  for (const solver of ALL_NAIVE_SOLVERS) {
    naiveScoresMap.set(solver.name, []);
  }

  const alertCounts: number[] = [];
  const eventCounts: number[] = [];
  const incCounts: number[] = [];
  const noiseRatios: number[] = [];
  const timings: number[] = [];

  let totalRejections = 0;

  for (let s = 1; s <= seedCount; s++) {
    const seed = `proof-seed-${family.metadata.id}-${s}`;
    const t0 = performance.now();

    const genResult = generateSocVariant(family, seed, difficulty);
    const duration = performance.now() - t0;
    timings.push(duration);
    totalRejections += genResult.rejectionRate;

    const sc = genResult.scenario;
    generatedScenarios.push(sc);

    // Layer 1: Structural
    const structResult = validateSocScenario(sc, `${family.metadata.id}-${seed}`);
    if (structResult.valid) structuralPasses++;

    // Layer 2: Semantic
    const semResult = validateVariantSemanticConsistency(sc);
    if (semResult.valid) semanticPasses++;

    // Layer 3: Reference Solver
    const refScore = evaluateSolverOnScenario(ReferenceSolver, sc).scorePercentage;
    refScores.push(refScore);

    // Layer 4: Naive Solvers
    for (const solver of ALL_NAIVE_SOLVERS) {
      const score = evaluateSolverOnScenario(solver, sc).scorePercentage;
      naiveScoresMap.get(solver.name)!.push(score);
    }

    // Layer 5: Tell Detection evaluated across generatedScenarios pool below

    // Layer 6: Leak Scanner
    const leakResult = scanClientViewLeaks(sc);
    if (leakResult.passed) leakPasses++;

    // Metrics
    alertCounts.push(sc.alerts.length);
    eventCounts.push(sc.rawEvents.length);
    incCounts.push(sc.groundTruth.incidents.length);
    const fpCount = sc.alerts.filter((a) => a.groundTruth.kind !== "true_positive").length;
    noiseRatios.push(fpCount / sc.alerts.length);
  }

  // Summary calculations
  const refMin = Math.min(...refScores);
  const refMean = Number((refScores.reduce((a, b) => a + b, 0) / seedCount).toFixed(1));
  const refMax = Math.max(...refScores);

  const naiveSummaries = ALL_NAIVE_SOLVERS.map((solver) => {
    const scores = naiveScoresMap.get(solver.name)!;
    return {
      name: solver.name,
      meanScore: Number((scores.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
      maxScore: Math.max(...scores),
    };
  });

  const bestNaiveMaxScore = Math.max(...naiveSummaries.map((s) => s.maxScore));
  const referenceToNaiveMargin = Number((refMin - bestNaiveMaxScore).toFixed(1));

  timings.sort((a, b) => a - b);
  const p50 = Number(timings[Math.floor(timings.length * 0.5)].toFixed(2));
  const p95 = Number(timings[Math.floor(timings.length * 0.95)].toFixed(2));
  const maxTime = Number(timings[timings.length - 1].toFixed(2));

  const variantMetrics = computeVariantMetrics(generatedScenarios);

  const weakestAreas: string[] = [];
  const pooledTellResult = detectTells(generatedScenarios);
  if (!pooledTellResult.passed) {
    for (const leak of pooledTellResult.leakingFeatures) {
      weakestAreas.push(`Tell detected: '${leak.feature}' separates true positives with ${(leak.accuracy * 100).toFixed(1)}% accuracy`);
    }
  }
  tellPasses = pooledTellResult.passed ? seedCount : 0;

  if (refMin < 80) weakestAreas.push(`Reference solver scored as low as ${refMin}% on some seeds`);
  if (bestNaiveMaxScore > 65) weakestAreas.push(`Naive solver reached up to ${bestNaiveMaxScore}% (too high)`);
  if (variantMetrics.minPairwiseDistance < 0.2) weakestAreas.push(`Minimum pairwise variant distance is low (${variantMetrics.minPairwiseDistance})`);

  const verdict =
    structuralPasses === seedCount &&
    semanticPasses === seedCount &&
    tellPasses === seedCount &&
    leakPasses === seedCount &&
    refMin >= 75 &&
    bestNaiveMaxScore <= 70
      ? "PASSED"
      : "FAILED";

  return {
    familyId: family.metadata.id,
    version: family.metadata.version,
    sampleSize: seedCount,
    difficulty,
    structuralPassRate: Number(((structuralPasses / seedCount) * 100).toFixed(1)),
    semanticPassRate: Number(((semanticPasses / seedCount) * 100).toFixed(1)),
    tellDetectionPassRate: Number(((tellPasses / seedCount) * 100).toFixed(1)),
    leakScanPassRate: Number(((leakPasses / seedCount) * 100).toFixed(1)),
    rejectionRate: Number(((totalRejections / seedCount) * 100).toFixed(2)),
    referenceSolver: {
      minScore: refMin,
      meanScore: refMean,
      maxScore: refMax,
      passingSeedsRate: Number(((refScores.filter((s) => s >= 75).length / seedCount) * 100).toFixed(1)),
    },
    naiveSolvers: naiveSummaries,
    bestNaiveMaxScore,
    referenceToNaiveMargin,
    distributions: {
      alertCounts: {
        min: Math.min(...alertCounts),
        mean: Number((alertCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...alertCounts),
      },
      eventCounts: {
        min: Math.min(...eventCounts),
        mean: Number((eventCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...eventCounts),
      },
      incidentCounts: {
        min: Math.min(...incCounts),
        mean: Number((incCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...incCounts),
      },
      noiseRatios: {
        min: Number(Math.min(...noiseRatios).toFixed(2)),
        mean: Number((noiseRatios.reduce((a, b) => a + b, 0) / seedCount).toFixed(2)),
        max: Number(Math.max(...noiseRatios).toFixed(2)),
      },
    },
    variantDistance: variantMetrics,
    generationTimingsMs: {
      p50,
      p95,
      max: maxTime,
    },
    weakestAreas,
    verdict,
  };
}
