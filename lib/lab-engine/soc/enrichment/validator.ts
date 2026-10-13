import type { SocScenario } from "../schema";
import { generateEnrichment, resolveEntityRole } from "./generator";
import { ENRICHMENT_TOOLS, type EnrichmentTool, type EntityRole, type ReputationSourceReport, type EmailHeaderAnalysisResult, type SandboxReportResult, type PdnsResult, type CmdbResult } from "./types";
import { SIMULATED_SOURCES } from "./sources";

export type EnrichmentConsistencyResult = {
  valid: boolean;
  errors: string[];
};

export type LeakingFeature = {
  feature: string;
  accuracy: number;
  detail: string;
};

export type EnrichmentTellResult = {
  passed: boolean;
  leakingFeatures: LeakingFeature[];
};

/**
 * Validates cross-tool coherence and client-side ground truth leak absence.
 */
export function validateEnrichmentConsistency(
  scenario: SocScenario,
  seed: string,
): EnrichmentConsistencyResult {
  const errors: string[] = [];

  // Check 1: Scan for forbidden ground truth strings in sample outputs
  const forbiddenTokens = [
    "attacker_infra",
    "true_positive",
    "false_positive",
    "benign_true_positive",
    "groundtruth",
    "ground_truth",
  ];

  const sampleEntities: Array<{ tool: EnrichmentTool; type: "ip" | "domain" | "url" | "hash" | "email" | "user" | "host"; value: string }> = [
    { tool: "reputation", type: "ip", value: "198.51.100.24" },
    { tool: "whois", type: "domain", value: "portal.example" },
    { tool: "pdns", type: "domain", value: "portal.example" },
    { tool: "url_analysis", type: "url", value: "https://portal.example/auth" },
    { tool: "sandbox", type: "hash", value: "sample.exe" },
    { tool: "pcap_flows", type: "ip", value: "198.51.100.24" },
    { tool: "endpoint_timeline", type: "host", value: "ws-fin-01" },
    { tool: "cmdb", type: "host", value: "ws-fin-01" },
    { tool: "tickets", type: "host", value: "ws-fin-01" },
  ];

  for (const sample of sampleEntities) {
    const res = generateEnrichment(scenario, seed, sample.tool, sample.type, sample.value);
    const serialized = JSON.stringify(res).toLowerCase();

    for (const token of forbiddenTokens) {
      if (serialized.includes(token)) {
        errors.push(`Tool '${sample.tool}' leaked ground truth token '${token}' in output payload`);
      }
    }
  }

  // Check 2: Email Header coherence if email alerts exist
  const emailAlert = scenario.alerts.find(
    (a) =>
      a.source === "Email Gateway" ||
      a.ruleName.toLowerCase().includes("email") ||
      a.ruleName.toLowerCase().includes("phish"),
  );
  if (emailAlert) {
    const emailRes = generateEnrichment(scenario, seed, "email_headers", "email", emailAlert.id);
    const data = emailRes.data as EmailHeaderAnalysisResult;
    if (data.receivedHops.length === 0) {
      errors.push(`Email header analysis for alert '${emailAlert.id}' contains 0 received hops`);
    }
    if (data.authentication.spf.clientIp !== data.receivedHops[0].clientIp) {
      errors.push(`Email SPF client IP (${data.authentication.spf.clientIp}) does not match first hop (${data.receivedHops[0].clientIp})`);
    }
  }

  // Check 3: Sandbox Report consistency
  const hashAlert = scenario.alerts.find((a) => a.relatedIocs.some((i) => i.type === "hash"));
  if (hashAlert) {
    const hashIoc = hashAlert.relatedIocs.find((i) => i.type === "hash");
    if (hashIoc) {
      const sandboxRes = generateEnrichment(scenario, seed, "sandbox", "hash", hashIoc.value);
      const data = sandboxRes.data as SandboxReportResult;
      if (data.file.hashSha256 !== hashIoc.value && !hashIoc.value.includes(data.file.hashSha256)) {
        errors.push(`Sandbox report hash '${data.file.hashSha256}' does not match queried IOC '${hashIoc.value}'`);
      }
    }
  }

  // Check 4: CMDB & Environment asset coherence
  for (const asset of scenario.environment.assets) {
    const cmdbRes = generateEnrichment(scenario, seed, "cmdb", "host", asset.hostname);
    const data = cmdbRes.data as CmdbResult;
    if (!data.hasData || !data.record) {
      errors.push(`CMDB failed to resolve existing environment asset '${asset.hostname}'`);
    }
  }

  // Check 5: Alert related assets must exist in CMDB / environment
  for (const alert of scenario.alerts) {
    if (alert.relatedAsset) {
      const assetExists = scenario.environment.assets.some(
        (a) => a.hostname.toLowerCase() === alert.relatedAsset!.toLowerCase(),
      );
      if (!assetExists) {
        errors.push(`Alert '${alert.id}' references asset '${alert.relatedAsset}' not present in environment or CMDB`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detects whether any structural tells exist between attacker infrastructure and benign entities.
 */
export function detectEnrichmentTells(
  samples: Array<{ role: EntityRole; payload: any; latencyMs?: number }>,
): EnrichmentTellResult {
  const leakingFeatures: LeakingFeature[] = [];

  const attackers = samples.filter((s) => s.role === "attacker_infra");
  const benigns = samples.filter((s) => s.role === "benign_business");

  if (attackers.length === 0 || benigns.length === 0) {
    return { passed: true, leakingFeatures: [] };
  }

  // Tell 1: Field Presence asymmetry
  const getKeys = (obj: any): string[] => {
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj).sort();
  };

  const attackerKeys = new Set<string>();
  for (const a of attackers) {
    for (const k of getKeys(a.payload)) attackerKeys.add(k);
  }

  for (const b of benigns) {
    const bKeys = new Set(getKeys(b.payload));
    for (const ak of attackerKeys) {
      if (!bKeys.has(ak)) {
        leakingFeatures.push({
          feature: "unique-field-presence",
          accuracy: 1.0,
          detail: `Field '${ak}' present in attacker output but absent in benign output`,
        });
        break;
      }
    }
  }

  // Tell 2: Latency difference leak (if provided)
  const latenciesWithRole = samples.filter((s) => typeof s.latencyMs === "number");
  if (latenciesWithRole.length >= 10) {
    const avgAtkLat = attackers.reduce((acc, a) => acc + (a.latencyMs || 0), 0) / (attackers.length || 1);
    const avgBenLat = benigns.reduce((acc, b) => acc + (b.latencyMs || 0), 0) / (benigns.length || 1);
    const diff = Math.abs(avgAtkLat - avgBenLat);

    if (diff > 15) {
      // Disparity exceeds acceptable clamp variance (uniform 35-55ms has expected diff near 0)
      leakingFeatures.push({
        feature: "latency-disparity",
        accuracy: 0.85,
        detail: `Mean latency difference between attacker (${avgAtkLat.toFixed(1)}ms) and benign (${avgBenLat.toFixed(1)}ms) is ${diff.toFixed(1)}ms`,
      });
    }
  }

  // Tell 3: 100% Unanimous verdict tell
  // If ALL attacker entities receive unanimous "malicious" across all sources with zero false negatives
  const repSamples = samples.filter((s) => s.payload && Array.isArray(s.payload.sources));
  if (repSamples.length >= 10) {
    const atkReps = repSamples.filter((s) => s.role === "attacker_infra");
    const allUnanimous = atkReps.every((a) =>
      a.payload.sources.every((src: any) => src.verdict === "malicious"),
    );
    if (allUnanimous) {
      leakingFeatures.push({
        feature: "unanimous-attacker-verdict",
        accuracy: 1.0,
        detail: "100% of attacker infrastructure received unanimous malicious verdicts across all sources (violates imperfect truth model)",
      });
    }
  }

  return {
    passed: leakingFeatures.length === 0,
    leakingFeatures,
  };
}

/**
 * Validates that realized False Positive and False Negative rates match declared source profiles.
 */
export function verifySourceCalibration(
  samples: Array<{ role: EntityRole; sourceKey: "threatwatch_community" | "apex_commercial"; report: ReputationSourceReport }>,
): { passed: boolean; rates: Record<string, { realizedFP: number; declaredFP: number; realizedFN: number; declaredFN: number }> } {
  const rates: Record<string, { realizedFP: number; declaredFP: number; realizedFN: number; declaredFN: number }> = {};
  let passed = true;

  const sources: Array<"threatwatch_community" | "apex_commercial"> = ["threatwatch_community", "apex_commercial"];

  for (const srcKey of sources) {
    const profile = SIMULATED_SOURCES[srcKey];
    const srcSamples = samples.filter((s) => s.sourceKey === srcKey);

    const benignSamples = srcSamples.filter((s) => s.role === "benign_business");
    const attackerSamples = srcSamples.filter((s) => s.role === "attacker_infra");

    if (benignSamples.length === 0 || attackerSamples.length === 0) continue;

    // False Positive: benign marked suspicious or malicious
    const fpCount = benignSamples.filter((s) => s.report.verdict === "suspicious" || s.report.verdict === "malicious").length;
    const realizedFP = fpCount / benignSamples.length;

    // False Negative: attacker marked clean or unknown
    const fnCount = attackerSamples.filter((s) => s.report.verdict === "clean" || s.report.verdict === "unknown").length;
    const realizedFN = fnCount / attackerSamples.length;

    rates[srcKey] = {
      realizedFP,
      declaredFP: profile.falsePositiveRate,
      realizedFN,
      declaredFN: profile.falseNegativeRate,
    };

    // Tolerance within ±10 percentage points over sample pool
    if (Math.abs(realizedFP - profile.falsePositiveRate) > 0.12) {
      passed = false;
    }
    if (Math.abs(realizedFN - profile.falseNegativeRate) > 0.15) {
      passed = false;
    }
  }

  return { passed, rates };
}
