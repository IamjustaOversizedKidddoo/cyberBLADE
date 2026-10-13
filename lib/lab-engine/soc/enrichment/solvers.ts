import type { SocScenario, SocAlertClient, SocScenarioClient } from "../schema";
import { ReferenceSolver, type SocSolverDecision, type SocSolver } from "../family-validator";
import { generateEnrichment } from "./generator";
import type {
  EnrichmentTool,
  EntityType,
  ReputationResult,
  EmailHeaderAnalysisResult,
  SandboxReportResult,
  TicketHistoryResult,
  PcapFlowsResult,
} from "./types";

export type LookupStats = {
  totalLookups: number;
  toolCounts: Record<EnrichmentTool, number>;
};

/**
 * Layer 3 Upgrade: Enrichment-Aware Reference Solver
 * A competent Tier-1 analyst who uses appropriate investigation tools,
 * synthesizes conflicting evidence, and resolves lookalikes correctly.
 */
export const EnrichmentAwareReferenceSolver = {
  name: "Enrichment-Aware Reference Tier-1 Solver",
  solve(
    scenario: SocScenario,
    clientView: SocScenarioClient,
    seed: string,
  ): { decisions: Record<string, SocSolverDecision>; stats: LookupStats } {
    const decisions: Record<string, SocSolverDecision> = {};
    const baseDecisions = ReferenceSolver.solve(clientView);
    const stats: LookupStats = {
      totalLookups: 0,
      toolCounts: {
        reputation: 0,
        whois: 0,
        pdns: 0,
        email_headers: 0,
        url_analysis: 0,
        sandbox: 0,
        pcap_flows: 0,
        endpoint_timeline: 0,
        cmdb: 0,
        tickets: 0,
      },
    };

    function performLookup<T>(tool: EnrichmentTool, type: EntityType, value: string): T {
      stats.totalLookups++;
      stats.toolCounts[tool]++;
      const res = generateEnrichment(scenario, seed, tool, type, value);
      return res.data as T;
    }

    for (const alert of clientView.alerts) {
      const rule = alert.ruleName.toLowerCase();
      const summary = alert.summary.toLowerCase();

      // 1. Phishing & Email Analysis
      if (
        alert.source === "Email Gateway" ||
        rule.includes("phish") ||
        rule.includes("email") ||
        summary.includes("phish") ||
        summary.includes("credential harvest")
      ) {
        const emailHeaders = performLookup<EmailHeaderAnalysisResult>("email_headers", "email", alert.id);
        const hasAuthFailure =
          emailHeaders.authentication.spf.status === "fail" ||
          emailHeaders.authentication.spf.status === "softfail" ||
          emailHeaders.authentication.dmarc.status === "fail";
        const hasMismatch = emailHeaders.mismatches.some((m) => m.severity === "critical");
        const hasPhishLink = emailHeaders.bodyLinks.some((l) => l.isMismatch);

        if (hasAuthFailure || hasMismatch || hasPhishLink) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Email header analysis confirms SPF/DMARC failure and deceptive body link target mismatch.",
          };
          continue;
        } else if (emailHeaders.authentication.spf.status === "pass" && emailHeaders.authentication.dmarc.status === "pass") {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "benign_true_positive",
            severity: "LOW",
            escalate: false,
            rationale: "Email header analyzer verifies authenticated SPF/DKIM/DMARC pass with matching Return-Path.",
          };
          continue;
        }
      }

      // 2. Malware & Script Loaders (Attachment, PowerShell, Rundll32)
      if (
        alert.rawFields.hash ||
        alert.rawFields.sha256 ||
        rule.includes("macro") ||
        rule.includes("script") ||
        rule.includes("powershell") ||
        rule.includes("attachment")
      ) {
        const hash = (alert.rawFields.hash as string) || (alert.rawFields.sha256 as string) || alert.id;
        const sandbox = performLookup<SandboxReportResult>("sandbox", "hash", hash);

        if (sandbox.threatScore >= 60 || sandbox.behavior.processCreation.length > 0) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            rationale: "Sandbox detonation report reveals anomalous process execution and persistence staging.",
          };
          continue;
        }
      }

      // 3. Network Outbound Exfiltration / C2
      if (
        alert.rawFields.destinationIp ||
        alert.rawFields.serverIp ||
        rule.includes("exfiltration") ||
        rule.includes("c2") ||
        rule.includes("beacon")
      ) {
        const ip = (alert.rawFields.destinationIp as string) || (alert.rawFields.serverIp as string) || "198.51.100.24";
        const rep = performLookup<ReputationResult>("reputation", "ip", ip);
        if (rep.sources.some((s) => s.verdict === "malicious" && s.score >= 70)) {
          decisions[alert.id] = {
            alertId: alert.id,
            disposition: "true_positive",
            severity: "CRITICAL",
            escalate: true,
            rationale: "Network reputation lookup confirms active command-and-control infrastructure.",
          };
          continue;
        }
      }

      // 4. Ticket verification for maintenance / authorized activities
      const host = alert.relatedAsset || alert.relatedUser || alert.id;
      const tickets = performLookup<TicketHistoryResult>("tickets", "host", host);
      const isApprovedMaint = tickets.tickets.some((t) => t.status === "approved" && (t.category === "scheduled_maintenance" || t.category === "pen_test_notice"));
      if (isApprovedMaint) {
        decisions[alert.id] = {
          alertId: alert.id,
          disposition: "benign_true_positive",
          severity: "LOW",
          escalate: false,
          rationale: "ServiceDesk records verify approved scheduled maintenance window.",
        };
        continue;
      }

      // Use expert baseline decision
      decisions[alert.id] = baseDecisions[alert.id] || {
        alertId: alert.id,
        disposition: "false_positive",
        severity: "LOW",
        escalate: false,
        rationale: "Ambient operational telemetry with no corroborating malicious activity.",
      };
    }

    return { decisions, stats };
  },
};

/**
 * Layer 4: Lazy Enrichment Solver
 * Blindly trusts only the very first source it checks (ThreatWatch Community),
 * ignoring conflicting sources, error profiles, and internal context.
 */
export const LazyEnrichmentSolver = {
  name: "Naive: Lazy Single-Source Enrichment Solver",
  solve(
    scenario: SocScenario,
    clientView: SocScenarioClient,
    seed: string,
  ): Record<string, SocSolverDecision> {
    const decisions: Record<string, SocSolverDecision> = {};

    for (const a of clientView.alerts) {
      const target = (a.relatedIocs && a.relatedIocs[0]?.value) || a.relatedAsset || a.id;
      const repRes = generateEnrichment(scenario, seed, "reputation", "ip", target);
      const rep = repRes.data as ReputationResult;

      // Blindly checks first source (ThreatWatch)
      const tw = rep.sources.find((s) => s.id === "threatwatch_community");
      const isFlagged = tw && (tw.verdict === "malicious" || tw.verdict === "suspicious");

      decisions[a.id] = {
        alertId: a.id,
        disposition: isFlagged ? "true_positive" : "false_positive",
        severity: isFlagged ? "HIGH" : "LOW",
        escalate: Boolean(isFlagged),
        rationale: "Blindly following ThreatWatch community feed single-source verdict.",
      };
    }

    return decisions;
  },
};

/**
 * Layer 4: Score-Only Solver
 * Trusts only the commercial numeric reputation score (Apex Intel),
 * ignoring behavioral context and internal tickets.
 */
export const ScoreOnlySolver = {
  name: "Naive: Score-Only Enrichment Solver",
  solve(
    scenario: SocScenario,
    clientView: SocScenarioClient,
    seed: string,
  ): Record<string, SocSolverDecision> {
    const decisions: Record<string, SocSolverDecision> = {};

    for (const a of clientView.alerts) {
      const target = (a.relatedIocs && a.relatedIocs[0]?.value) || a.relatedAsset || a.id;
      const repRes = generateEnrichment(scenario, seed, "reputation", "ip", target);
      const rep = repRes.data as ReputationResult;

      const apex = rep.sources.find((s) => s.id === "apex_commercial");
      const isHighScore = apex && apex.score >= 50;

      decisions[a.id] = {
        alertId: a.id,
        disposition: isHighScore ? "true_positive" : "false_positive",
        severity: isHighScore ? "CRITICAL" : "LOW",
        escalate: Boolean(isHighScore),
        rationale: "Threshold triage: classifying as true positive if commercial score >= 50.",
      };
    }

    return decisions;
  },
};
