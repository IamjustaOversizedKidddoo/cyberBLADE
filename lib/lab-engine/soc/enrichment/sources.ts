import type { EntityRole, ReputationSourceVerdict, ReputationSourceReport } from "./types";
import type { Rng } from "@/lib/generators/rng";

export type IntelligenceSourceProfile = {
  id: string;
  name: string;
  category: "community_feed" | "commercial_intel" | "passive_dns" | "dynamic_sandbox" | "internal_directory" | "internal_servicedesk";
  coverageRate: number; // probability entity has records in this source
  falsePositiveRate: number; // probability benign entity is marked suspicious/malicious
  falseNegativeRate: number; // probability attacker entity is marked clean/unknown
  stalenessRate: number; // probability internal records are out-of-date
};

export const SIMULATED_SOURCES: Record<string, IntelligenceSourceProfile> = {
  threatwatch_community: {
    id: "threatwatch_community",
    name: "ThreatWatch Community Intel",
    category: "community_feed",
    coverageRate: 0.85,
    falsePositiveRate: 0.12,
    falseNegativeRate: 0.15,
    stalenessRate: 0.05,
  },
  apex_commercial: {
    id: "apex_commercial",
    name: "Apex Intel Threat Intelligence",
    category: "commercial_intel",
    coverageRate: 0.70,
    falsePositiveRate: 0.03,
    falseNegativeRate: 0.20,
    stalenessRate: 0.02,
  },
  passivesphere_pdns: {
    id: "passivesphere_pdns",
    name: "PassiveSphere Historical pDNS",
    category: "passive_dns",
    coverageRate: 0.88,
    falsePositiveRate: 0.08,
    falseNegativeRate: 0.10,
    stalenessRate: 0.0,
  },
  detonatex_sandbox: {
    id: "detonatex_sandbox",
    name: "DetonateX Dynamic Sandbox Lab",
    category: "dynamic_sandbox",
    coverageRate: 0.65,
    falsePositiveRate: 0.08,
    falseNegativeRate: 0.25,
    stalenessRate: 0.0,
  },
  corphive_cmdb: {
    id: "corphive_cmdb",
    name: "CorpHive Enterprise Directory & CMDB",
    category: "internal_directory",
    coverageRate: 0.95,
    falsePositiveRate: 0.0,
    falseNegativeRate: 0.0,
    stalenessRate: 0.12,
  },
  servicedesk_tickets: {
    id: "servicedesk_tickets",
    name: "ServiceDesk Change & Incident Records",
    category: "internal_servicedesk",
    coverageRate: 0.80,
    falsePositiveRate: 0.05,
    falseNegativeRate: 0.05,
    stalenessRate: 0.10,
  },
};

/**
 * Evaluates simulated reputation for an entity according to source error profiles
 */
export function evaluateSourceReputation(
  sourceKey: "threatwatch_community" | "apex_commercial",
  role: EntityRole,
  rng: Rng,
  scenarioBaseDate: string = "2026-10-12",
): ReputationSourceReport | null {
  const profile = SIMULATED_SOURCES[sourceKey];
  if (!profile) return null;

  // Check coverage
  const rollCoverage = rng.next();
  if (rollCoverage > profile.coverageRate && role !== "attacker_infra") {
    // Legitimate "no data"
    return {
      id: profile.id,
      name: profile.name,
      category: profile.category,
      verdict: "unknown",
      score: 0,
      confidence: 10,
      firstSeen: null,
      lastSeen: null,
      enginesFlagged: 0,
      totalEngines: sourceKey === "threatwatch_community" ? 14 : undefined,
      notes: "No observational history or telemetry indexed for this indicator.",
    };
  }

  let verdict: ReputationSourceVerdict = "clean";
  let score = 0;
  let confidence = 50;
  let notes = "";
  let enginesFlagged = 0;
  const totalEngines = 14;

  if (role === "attacker_infra") {
    const isFalseNegative = rng.next() < profile.falseNegativeRate;
    if (isFalseNegative) {
      verdict = "unknown";
      score = rng.int(5, 20);
      confidence = rng.int(20, 40);
      notes = "Indicator newly observed in ambient sensors; insufficient telemetry to confirm maliciousness.";
      enginesFlagged = rng.int(0, 1);
    } else {
      verdict = "malicious";
      score = rng.int(75, 98);
      confidence = rng.int(75, 95);
      notes = sourceKey === "threatwatch_community"
        ? "Corroborated by multiple community sensors as active command-and-control or credential harvesting node."
        : "Curated threat actor infrastructure linked to unauthorized staging operations.";
      enginesFlagged = rng.int(8, 13);
    }
  } else if (role === "shared_infra") {
    // Shared infrastructure (CDN, cloud storage, dynamic cloud)
    const isSuspicious = rng.next() < 0.6;
    if (isSuspicious) {
      verdict = "suspicious";
      score = rng.int(45, 68);
      confidence = 55;
      notes = "Multi-tenant cloud infrastructure with mixed reputation history. High potential for false positive by association.";
      enginesFlagged = rng.int(3, 5);
    } else {
      verdict = "clean";
      score = rng.int(10, 30);
      confidence = 70;
      notes = "Known verified CDN / multi-tenant enterprise cloud service.";
      enginesFlagged = rng.int(0, 1);
    }
  } else {
    // Benign business / victim / scanner
    const isFalsePositive = rng.next() < profile.falsePositiveRate;
    if (isFalsePositive) {
      verdict = "suspicious";
      score = rng.int(42, 60);
      confidence = 45;
      notes = sourceKey === "threatwatch_community"
        ? "Flagged by heuristic community scanners due to dynamic DNS or bulk communication patterns."
        : "Low-confidence anomaly score triggered by sudden outbound traffic spike.";
      enginesFlagged = rng.int(2, 4);
    } else {
      verdict = "clean";
      score = rng.int(0, 12);
      confidence = rng.int(80, 95);
      notes = "Known legitimate enterprise infrastructure with no adverse security records.";
      enginesFlagged = 0;
    }
  }

  const daysAgoFirst = rng.int(15, 120);
  const daysAgoLast = rng.int(0, 4);
  const firstSeen = new Date(new Date(scenarioBaseDate).getTime() - daysAgoFirst * 86400000).toISOString().split("T")[0];
  const lastSeen = new Date(new Date(scenarioBaseDate).getTime() - daysAgoLast * 86400000).toISOString().split("T")[0];

  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    verdict,
    score,
    confidence,
    firstSeen,
    lastSeen,
    enginesFlagged: sourceKey === "threatwatch_community" ? enginesFlagged : undefined,
    totalEngines: sourceKey === "threatwatch_community" ? totalEngines : undefined,
    notes,
  };
}
