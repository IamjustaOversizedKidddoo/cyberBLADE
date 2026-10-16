/**
 * SOC L2 Detection Rule Challenge Evaluator
 *
 * Graded on submission against hidden hold-out variants (true incident alerts)
 * and benign twins/noise (decoy/benign alerts).
 *
 * Zero oracle before submission: learners cannot test against hold-out sets beforehand.
 * Ground truth and hold-out variants never reach the client.
 */
import "server-only";
import { createHash } from "node:crypto";
import { loadSocFamily } from "../engine";
import { generateSocVariant } from "../generator";
import { executeBladeQL } from "../query/engine";
import type { BladeQLEvent } from "../query/types";
import type { SocRuleTestResult } from "../exam/types";
import type { SocAlert } from "../schema";

export type DetectionRuleInput = {
  title: string;
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
  tactic?: string;
  technique?: string;
  query: string;
};

/** Convert a scenario alert into a uniform BladeQLEvent row for query execution */
export function alertToBladeQLEvent(alert: SocAlert): BladeQLEvent {
  const row: BladeQLEvent = {
    _time: alert.timestamp,
    _raw: `${alert.ruleName}: ${alert.summary}`,
    alert_id: alert.id,
    rule_name: alert.ruleName,
    source: alert.source,
    severity: alert.severity,
    summary: alert.summary,
    asset: alert.relatedAsset ?? "",
    user: alert.relatedUser ?? "",
    hostname: alert.relatedAsset ?? "",
    username: alert.relatedUser ?? "",
  };

  if (alert.rawFields) {
    for (const [k, v] of Object.entries(alert.rawFields)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      row[k] = v;
    }
  }

  for (const ioc of alert.relatedIocs ?? []) {
    if (ioc.type === "__proto__" || ioc.type === "constructor" || ioc.type === "prototype") continue;
    row[ioc.type] = ioc.value;
    if (ioc.type === "ip" && !row.src_ip) row.src_ip = ioc.value;
    if (ioc.type === "hash" && !row.sha256) row.sha256 = ioc.value;
    if (ioc.type === "domain" && !row.domain) row.domain = ioc.value;
  }

  return row;
}

/** Deterministic hold-out seeds derived from parent seed and family */
function deriveHoldOutSeeds(familyId: string, seed: string, count = 3): string[] {
  return Array.from({ length: count }, (_, i) =>
    createHash("sha256")
      .update(`${familyId}:holdout:${i + 1}:${seed}`)
      .digest("hex")
      .slice(0, 16),
  );
}

/**
 * Evaluates a candidate detection rule against hidden hold-out attack variants
 * and benign twins generated with unreleased seeds.
 */
export async function evaluateDetectionRuleChallenge(
  familyId: string,
  parentSeed: string,
  rule: DetectionRuleInput,
): Promise<SocRuleTestResult> {
  const feedback: string[] = [];
  const family = await loadSocFamily(familyId);
  const holdOutSeeds = deriveHoldOutSeeds(familyId, parentSeed, 3);

  const holdOutEvents: BladeQLEvent[] = [];
  const benignEvents: BladeQLEvent[] = [];

  for (const hSeed of holdOutSeeds) {
    const { scenario } = generateSocVariant(family, hSeed, "intermediate");
    for (const alert of scenario.alerts) {
      const evt = alertToBladeQLEvent(alert);
      if (alert.groundTruth.kind === "true_positive") {
        holdOutEvents.push(evt);
      } else {
        benignEvents.push(evt);
      }
    }
  }

  // Fallback protection if scenario generator generated no distinct benign events
  if (holdOutEvents.length === 0) {
    holdOutEvents.push({
      _time: new Date().toISOString(),
      _raw: `${familyId} simulated true positive`,
      rule_name: "Simulated-Incident",
      source: "EDR",
      severity: "HIGH",
      summary: "Simulated true positive event",
      alert_id: "holdout-sim-1",
    });
  }
  if (benignEvents.length === 0) {
    benignEvents.push({
      _time: new Date().toISOString(),
      _raw: `Benign routine maintenance`,
      rule_name: "Benign-Maintenance",
      source: "EDR",
      severity: "LOW",
      summary: "Benign noise event",
      alert_id: "benign-sim-1",
    });
  }

  const queryTrimmed = rule.query?.trim() ?? "";
  if (!queryTrimmed) {
    return {
      holdOutTotal: holdOutEvents.length,
      holdOutDetected: 0,
      benignTotal: benignEvents.length,
      benignTriggered: 0,
      recallPercent: 0,
      precisionPercent: 0,
      falsePositiveRatePercent: 0,
      passed: false,
      scorePercent: 0,
      feedback: ["Empty query submitted. No events matched."],
    };
  }

  if (queryTrimmed.length > 4000) {
    return {
      holdOutTotal: holdOutEvents.length,
      holdOutDetected: 0,
      benignTotal: benignEvents.length,
      benignTriggered: 0,
      recallPercent: 0,
      precisionPercent: 0,
      falsePositiveRatePercent: 0,
      passed: false,
      scorePercent: 0,
      feedback: ["Query exceeds maximum allowable size (4000 characters)."],
    };
  }

  let matchedHoldOutCount = 0;
  let triggeredBenignCount = 0;

  try {
    // 1. Evaluate against hidden hold-out variants (True Positive Recall)
    const holdOutResult = executeBladeQL(queryTrimmed, holdOutEvents, {
      budgets: { maxEventsIn: 10000, maxEventsOut: 1000, maxRegexMatches: 5000, maxExecutionTimeMs: 2000 },
    });
    const matchedHoldOutIds = new Set(
      holdOutResult.events.map((e) => (e.alert_id as string) || (e._raw as string)),
    );
    matchedHoldOutCount = holdOutEvents.filter((e) =>
      matchedHoldOutIds.has((e.alert_id as string) || (e._raw as string)),
    ).length;

    // 2. Evaluate against benign twins (False Positive Avoidance)
    const benignResult = executeBladeQL(queryTrimmed, benignEvents, {
      budgets: { maxEventsIn: 10000, maxEventsOut: 1000, maxRegexMatches: 5000, maxExecutionTimeMs: 2000 },
    });
    const matchedBenignIds = new Set(
      benignResult.events.map((e) => (e.alert_id as string) || (e._raw as string)),
    );
    triggeredBenignCount = benignEvents.filter((e) =>
      matchedBenignIds.has((e.alert_id as string) || (e._raw as string)),
    ).length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      holdOutTotal: holdOutEvents.length,
      holdOutDetected: 0,
      benignTotal: benignEvents.length,
      benignTriggered: 0,
      recallPercent: 0,
      precisionPercent: 0,
      falsePositiveRatePercent: 0,
      passed: false,
      scorePercent: 0,
      feedback: [`Query execution failed: ${msg}`],
    };
  }

  const holdOutTotal = holdOutEvents.length;
  const benignTotal = benignEvents.length;

  const recallPercent = Math.round((matchedHoldOutCount / holdOutTotal) * 100);
  const falsePositiveRatePercent = Math.round((triggeredBenignCount / benignTotal) * 100);
  const totalTriggered = matchedHoldOutCount + triggeredBenignCount;
  const precisionPercent =
    totalTriggered > 0 ? Math.round((matchedHoldOutCount / totalTriggered) * 100) : 0;

  // Rule quality checks
  let qualityScore = 100;
  if (!rule.technique || !/^T\d{4}(\.\d{3})?$/i.test(rule.technique.trim())) {
    qualityScore -= 40;
    feedback.push("Missing or invalid MITRE ATT&CK technique ID (expected format: T1xxx or T1xxx.yyy).");
  } else {
    feedback.push(`Tagged technique ${rule.technique.toUpperCase()} aligned.`);
  }

  if (!rule.tactic || rule.tactic.trim().length < 3) {
    qualityScore -= 20;
    feedback.push("Missing ATT&CK tactic category.");
  }

  if (!rule.title || rule.title.trim().length < 5) {
    qualityScore -= 20;
    feedback.push("Rule title is too short or generic.");
  }

  if (queryTrimmed.length > 2000) {
    qualityScore -= 20;
    feedback.push("Rule query is overly long; consider optimizing filter predicates.");
  }

  // Weightings: Detection 50%, FP Control 35%, Rule Quality 15%
  const fpControlPercent = Math.max(0, 100 - falsePositiveRatePercent);
  const scorePercent = Math.min(
    100,
    Math.round(recallPercent * 0.5 + fpControlPercent * 0.35 + qualityScore * 0.15),
  );

  // Diagnostic feedback
  feedback.push(`Detected ${matchedHoldOutCount}/${holdOutTotal} hold-out variants (${recallPercent}% recall).`);
  if (triggeredBenignCount === 0) {
    feedback.push("Zero false positives triggered on benign twin datasets (100% specificity).");
  } else {
    feedback.push(`Triggered ${triggeredBenignCount}/${benignTotal} benign decoy alerts (${falsePositiveRatePercent}% false positive rate).`);
  }

  const passed = recallPercent >= 70 && falsePositiveRatePercent <= 15;

  return {
    holdOutTotal,
    holdOutDetected: matchedHoldOutCount,
    benignTotal,
    benignTriggered: triggeredBenignCount,
    recallPercent,
    precisionPercent,
    falsePositiveRatePercent,
    passed,
    scorePercent,
    feedback,
  };
}
