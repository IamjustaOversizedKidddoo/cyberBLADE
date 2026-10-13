/**
 * Deterministic Report Grading Engine
 *
 * Pure function: Grade = f(ReportSubmission, ReportGroundTruth, Rubric, ScoringConfig)
 *
 * Zero AI, zero external lookups. All verifiable claims are evaluated against
 * the hidden ground truth using set operations, Kendall-Tau ordering, and
 * precision/recall metrics. Completes in < 150ms.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  SocReportData,
  SocReportGroundTruth,
  ReportRubric,
  RubricCriterion,
  ScoringConfig,
  CriterionResult,
  GradingResult,
  ClaimAnnotation,
  IocRowData,
  TimelineRowData,
} from "./types";
import { defangIndicator } from "./sanitizer";
import { defaultAiCriterionGrader, type AiCriterionGrader } from "./seams";

export const GRADER_VERSION = "1.0.0";
export const SCORING_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Rubric & Config Loaders (sync, cached)
// ---------------------------------------------------------------------------

let _rubricCache: Map<string, ReportRubric> | null = null;
let _scoringConfigCache: ScoringConfig | null = null;

export function loadRubric(rubricId = "incident-report-l1-rubric"): ReportRubric {
  if (!_rubricCache) {
    _rubricCache = new Map();
    const dir = path.resolve("content/soc/rubrics");
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if ((f.endsWith(".yaml") || f.endsWith(".yml")) && !f.includes("scoring-config")) {
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        const parsed = parseYaml(raw) as {
          rubricId: string;
          version: string;
          criteria: Array<{
            id: string;
            title: string;
            graderType: "deterministic" | "ai";
            weight: number;
            maxPoints: number;
            skillTags: string[];
            feedbackBands: Array<{ minScore: number; feedbackTemplate: string }>;
            teachingNotes: string;
          }>;
        };
        _rubricCache.set(parsed.rubricId, {
          id: parsed.rubricId,
          version: parsed.version,
          criteria: parsed.criteria.map((c) => ({
            id: c.id,
            title: c.title,
            skillTags: c.skillTags ?? [],
            maxPoints: c.maxPoints,
            weight: c.weight,
            graderType: c.graderType,
            feedbackBands: c.feedbackBands ?? [],
            teachingNotes: c.teachingNotes ?? "",
          })),
        });
      }
    }
  }

  const rubric = _rubricCache.get(rubricId);
  if (!rubric) {
    throw new Error(`Rubric '${rubricId}' not found. Available: ${[..._rubricCache.keys()].join(", ")}`);
  }
  return rubric;
}

export function loadScoringConfig(): ScoringConfig {
  if (_scoringConfigCache) return _scoringConfigCache;
  const filePath = path.resolve("content/soc/rubrics/scoring-config.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(raw);
  _scoringConfigCache = {
    version: parsed.version,
    weights: parsed.weights,
    penalties: {
      paddingPenaltyPerItem: parsed.penalties.paddingPenaltyPerItem,
      fabricationPenaltyPerItem: parsed.penalties.fabricationPenaltyPerItem,
      harmfulActionPenalty: parsed.penalties.harmfulActionPenalty,
      unorderedTimelinePenalty: parsed.penalties.unorderedTimelinePenalty,
      missingEvidencePenalty: parsed.penalties.missingEvidencePenalty,
      unsupportedClaimPenalty: parsed.penalties.unsupportedClaimPenalty,
    },
    tolerances: {
      timelineSeconds: parsed.tolerances.timelineSeconds,
      minNarrativeLength: parsed.tolerances.minNarrativeLength,
      maxNarrativeLength: parsed.tolerances.maxNarrativeLength,
    },
  };
  return _scoringConfigCache;
}

// ---------------------------------------------------------------------------
// Normalization Utilities
// ---------------------------------------------------------------------------

/** Normalize an indicator value for comparison: lowercase, trim, strip defanging */
function normalizeIndicator(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\[.\]/g, ".") // un-defang [.]
    .replace(/hxxp/gi, "http") // un-defang hxxp
    .replace(/\s+/g, "");
}

/** Parse a timestamp string to epoch ms, returning NaN if unparseable */
function parseTimestamp(ts: string): number {
  const d = new Date(ts);
  return d.getTime();
}

/** Count inversions in an array of indices (simplified O(n²) for small arrays) */
function countInversions(arr: number[]): number {
  let inversions = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] > arr[j]) inversions++;
    }
  }
  return inversions;
}

/** Detect verbatim copy-paste: runs of > 120 chars identical to raw syslog text */
function detectCopyPaste(text: string): boolean {
  // Simple heuristic: long runs of typical syslog patterns
  const syslogPatterns = [
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*?(?:INFO|WARN|ERROR|DEBUG|CRITICAL)\s+.{80,}/,
    /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+.{80,}/m,
  ];
  return syslogPatterns.some((p) => p.test(text));
}

/** Detect prompt injection patterns in text fields */
function detectInjection(text: string): boolean {
  const patterns = [
    /ignore\s+(all\s+)?(previous\s+)?(instructions|rubric|rules)/i,
    /give\s+(me\s+)?(full|100|maximum|perfect)\s+(points|score|marks|credit)/i,
    /you\s+are\s+(now\s+)?(a\s+)?/i,
    /system\s*prompt/i,
    /\[INST\]/i,
    /<\|im_start\|>/i,
  ];
  return patterns.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Feedback Lookup
// ---------------------------------------------------------------------------

function lookupFeedback(criterion: RubricCriterion, score: number): string {
  // Bands are sorted descending by minScore in the YAML
  const sorted = [...criterion.feedbackBands].sort((a, b) => b.minScore - a.minScore);
  for (const band of sorted) {
    if (score >= band.minScore) {
      return band.feedbackTemplate;
    }
  }
  return sorted[sorted.length - 1]?.feedbackTemplate ?? "";
}

// ---------------------------------------------------------------------------
// Individual Criterion Graders
// ---------------------------------------------------------------------------

function gradeVerdictAccuracy(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];
  let score = 0;

  // Disposition check
  if (report.verdict.disposition === gt.verdict.correctDisposition) {
    score += criterion.maxPoints * 0.5;
    annotations.push({
      claimType: "disposition",
      status: "supported",
      detail: `Correct disposition: ${gt.verdict.correctDisposition}`,
    });
  } else {
    // Check acceptable alternatives
    const alt = gt.verdict.acceptableAlternatives.find((a) => a.disposition === report.verdict.disposition);
    if (alt) {
      score += criterion.maxPoints * 0.5 * alt.partialCredit;
      annotations.push({
        claimType: "disposition",
        status: "supported",
        detail: `Acceptable alternative disposition (${alt.partialCredit * 100}% credit)`,
      });
    } else {
      annotations.push({
        claimType: "disposition",
        status: "incorrect",
        detail: `Incorrect disposition: submitted '${report.verdict.disposition}', expected '${gt.verdict.correctDisposition}'`,
      });
      missedItems.push(`Correct disposition: ${gt.verdict.correctDisposition}`);
    }
  }

  // Severity check
  if (report.verdict.severity === gt.verdict.correctSeverity) {
    score += criterion.maxPoints * 0.5;
    annotations.push({
      claimType: "severity",
      status: "supported",
      detail: `Correct severity: ${gt.verdict.correctSeverity}`,
    });
  } else {
    const altSev = gt.verdict.acceptableAlternatives.find(
      (a) => a.severity === report.verdict.severity && a.disposition === report.verdict.disposition,
    );
    if (altSev) {
      score += criterion.maxPoints * 0.5 * altSev.partialCredit;
      annotations.push({
        claimType: "severity",
        status: "supported",
        detail: `Acceptable alternative severity (${altSev.partialCredit * 100}% credit)`,
      });
    } else {
      annotations.push({
        claimType: "severity",
        status: "incorrect",
        detail: `Incorrect severity: submitted '${report.verdict.severity}', expected '${gt.verdict.correctSeverity}'`,
      });
      missedItems.push(`Correct severity: ${gt.verdict.correctSeverity}`);
    }
  }

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags: [],
  };
}

function gradeIncidentScoping(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];

  const submittedAssets = new Set((report.scope.affectedAssets ?? []).map((a) => a.toLowerCase().trim()));
  const gtAssets = new Set(gt.scope.affectedAssets.map((a) => a.toLowerCase().trim()));
  const unrelatedAssets = new Set(gt.scope.unrelatedAssets.map((a) => a.toLowerCase().trim()));

  const submittedUsers = new Set((report.scope.affectedUsers ?? []).map((u) => u.toLowerCase().trim()));
  const gtUsers = new Set(gt.scope.affectedUsers.map((u) => u.toLowerCase().trim()));
  const unrelatedUsers = new Set(gt.scope.unrelatedUsers.map((u) => u.toLowerCase().trim()));

  // Asset scoring
  let assetCorrect = 0;
  let assetFalsePositive = 0;
  for (const a of submittedAssets) {
    if (gtAssets.has(a)) {
      assetCorrect++;
      annotations.push({ claimType: "asset", claimId: a, status: "supported", detail: `Correctly identified affected asset` });
    } else if (unrelatedAssets.has(a)) {
      assetFalsePositive++;
      annotations.push({ claimType: "asset", claimId: a, status: "incorrect", detail: `Asset is not affected by this incident` });
    } else {
      annotations.push({ claimType: "asset", claimId: a, status: "extra", detail: `Asset not recognized in scenario environment` });
    }
  }
  for (const a of gtAssets) {
    if (!submittedAssets.has(a)) {
      missedItems.push(`Missed affected asset: ${a}`);
      annotations.push({ claimType: "asset", claimId: a, status: "missing", detail: `Affected asset not identified` });
    }
  }

  // User scoring
  let userCorrect = 0;
  let userFalsePositive = 0;
  for (const u of submittedUsers) {
    if (gtUsers.has(u)) {
      userCorrect++;
      annotations.push({ claimType: "user", claimId: u, status: "supported", detail: `Correctly identified affected user` });
    } else if (unrelatedUsers.has(u)) {
      userFalsePositive++;
      annotations.push({ claimType: "user", claimId: u, status: "incorrect", detail: `User is not affected by this incident` });
    } else {
      annotations.push({ claimType: "user", claimId: u, status: "extra", detail: `User not recognized in scenario environment` });
    }
  }
  for (const u of gtUsers) {
    if (!submittedUsers.has(u)) {
      missedItems.push(`Missed affected user: ${u}`);
      annotations.push({ claimType: "user", claimId: u, status: "missing", detail: `Affected user not identified` });
    }
  }

  const totalGt = gtAssets.size + gtUsers.size;
  const totalCorrect = assetCorrect + userCorrect;
  const totalFalsePositive = assetFalsePositive + userFalsePositive;
  const recall = totalGt > 0 ? totalCorrect / totalGt : 0;
  const submitted = submittedAssets.size + submittedUsers.size;
  const precision = submitted > 0 ? totalCorrect / submitted : 0;

  // Weighted F-measure: 0.6 recall + 0.4 precision
  const fMeasure = 0.6 * recall + 0.4 * precision;
  let score = criterion.maxPoints * fMeasure;

  // Penalty for including unrelated entities
  score -= totalFalsePositive * 1.0;
  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags: totalFalsePositive > 2 ? ["excessive_false_positives_in_scope"] : [],
  };
}

function gradeIocExtraction(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
  config: ScoringConfig,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];
  const flags: string[] = [];

  // Build normalized ground truth IoC set (true positives only)
  const gtTrueIocs = gt.iocs.filter((i) => i.isTruePositive);
  const gtIocSet = new Map<string, typeof gtTrueIocs[number]>();
  for (const ioc of gtTrueIocs) {
    gtIocSet.set(normalizeIndicator(ioc.value), ioc);
  }

  // Build normalized benign IoC set
  const gtBenignIocs = gt.iocs.filter((i) => !i.isTruePositive);
  const benignIocSet = new Set(gtBenignIocs.map((i) => normalizeIndicator(i.value)));

  // Score submitted IoCs
  let truePositives = 0;
  let benignPadding = 0;
  let fabricated = 0;

  for (const submitted of report.iocs ?? []) {
    const norm = normalizeIndicator(submitted.value);
    if (gtIocSet.has(norm)) {
      truePositives++;
      const gtIoc = gtIocSet.get(norm)!;
      // Check role accuracy
      const roleCorrect = submitted.role === gtIoc.role;
      annotations.push({
        claimType: "ioc",
        claimId: submitted.value,
        status: "supported",
        detail: roleCorrect
          ? `Correct IoC with accurate role attribution`
          : `Correct IoC but role '${submitted.role}' differs from expected '${gtIoc.role}'`,
      });
    } else if (benignIocSet.has(norm)) {
      benignPadding++;
      annotations.push({
        claimType: "ioc",
        claimId: submitted.value,
        status: "incorrect",
        detail: `Benign indicator included — reduces precision`,
      });
    } else {
      fabricated++;
      annotations.push({
        claimType: "ioc",
        claimId: submitted.value,
        status: "extra",
        detail: `Indicator not observed in scenario data — unsupported claim`,
      });
    }
  }

  // Mark missed IoCs
  const submittedNorm = new Set((report.iocs ?? []).map((i) => normalizeIndicator(i.value)));
  for (const [normVal, gtIoc] of gtIocSet) {
    if (!submittedNorm.has(normVal)) {
      missedItems.push(`Missed ${gtIoc.type} IoC: ${gtIoc.value}`);
      annotations.push({
        claimType: "ioc",
        claimId: gtIoc.value,
        status: "missing",
        detail: `True-positive IoC not included in report`,
      });
    }
  }

  // Compute metrics
  const totalSubmitted = (report.iocs ?? []).length;
  const recall = gtIocSet.size > 0 ? truePositives / gtIocSet.size : 0;
  const precision = totalSubmitted > 0 ? truePositives / totalSubmitted : 0;

  // Score = maxPoints × (0.7 × Recall + 0.3 × Precision) - penalties
  let score = criterion.maxPoints * (0.7 * recall + 0.3 * precision);
  score -= benignPadding * config.penalties.paddingPenaltyPerItem;
  score -= fabricated * config.penalties.fabricationPenaltyPerItem;

  if (benignPadding > 3) flags.push("padding_detected");
  if (fabricated > 0) flags.push("fabrication_detected");

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags,
  };
}

function gradeTimelineAccuracy(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
  config: ScoringConfig,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];
  const flags: string[] = [];

  const toleranceMs = config.tolerances.timelineSeconds * 1000;
  const milestones = gt.milestones;

  if (milestones.length === 0) {
    return {
      criterionId: criterion.id,
      score: criterion.maxPoints,
      maxScore: criterion.maxPoints,
      weight: criterion.weight,
      status: "graded",
      feedback: "No timeline milestones defined for this scenario.",
      teachingPointers: [],
      annotations: [],
      missedItems: [],
      flags: [],
    };
  }

  // Match submitted timeline rows to milestones
  const submittedRows = report.timeline ?? [];
  const matchedMilestoneIndices: number[] = []; // index into milestones array
  const usedSubmittedRows = new Set<number>();

  for (let mi = 0; mi < milestones.length; mi++) {
    const milestone = milestones[mi];
    const milestoneTs = parseTimestamp(milestone.timestamp);
    if (isNaN(milestoneTs)) continue;

    let bestMatch = -1;
    let bestDist = Infinity;

    for (let si = 0; si < submittedRows.length; si++) {
      if (usedSubmittedRows.has(si)) continue;
      const row = submittedRows[si];
      const rowTs = parseTimestamp(row.timestampUtc || row.rawTimestamp);
      if (isNaN(rowTs)) continue;

      const dist = Math.abs(rowTs - milestoneTs);
      if (dist <= toleranceMs && dist < bestDist) {
        // Also check keyword overlap for disambiguation
        const descLower = (row.description ?? "").toLowerCase();
        const kwMatch = milestone.actionKeywords.some((kw) => descLower.includes(kw));
        if (kwMatch || dist < toleranceMs * 0.5) {
          bestMatch = si;
          bestDist = dist;
        }
      }
    }

    if (bestMatch >= 0) {
      matchedMilestoneIndices.push(mi);
      usedSubmittedRows.add(bestMatch);
      annotations.push({
        claimType: "milestone",
        claimId: milestone.id,
        status: "supported",
        detail: `Milestone matched: ${milestone.description}`,
      });
    } else {
      missedItems.push(`Missed milestone: ${milestone.description} (${milestone.timestamp})`);
      annotations.push({
        claimType: "milestone",
        claimId: milestone.id,
        status: "missing",
        detail: `Timeline milestone not covered`,
      });
    }
  }

  // Milestone Coverage
  const coverage = matchedMilestoneIndices.length / milestones.length;

  // Kendall-Tau ordering score (using the order of matched milestones)
  let orderScore = 1.0;
  if (matchedMilestoneIndices.length >= 2) {
    const inversions = countInversions(matchedMilestoneIndices);
    const maxInversions = (matchedMilestoneIndices.length * (matchedMilestoneIndices.length - 1)) / 2;
    orderScore = maxInversions > 0 ? 1.0 - inversions / maxInversions : 1.0;
  }

  // Detect fabricated timeline entries (rows that match NO milestone and have no valid evidence ref)
  let fabricatedRows = 0;
  for (let si = 0; si < submittedRows.length; si++) {
    if (!usedSubmittedRows.has(si)) {
      const row = submittedRows[si];
      if (!row.evidenceRef || row.evidenceRef.trim() === "") {
        fabricatedRows++;
        annotations.push({
          claimType: "timeline_row",
          claimId: row.id ?? `row-${si}`,
          status: "extra",
          detail: `Timeline entry does not match any milestone and lacks evidence reference`,
        });
      }
    }
  }

  // Score = maxPoints × (0.7 × Coverage + 0.3 × OrderScore) - fabrication penalty
  let score = criterion.maxPoints * (0.7 * coverage + 0.3 * orderScore);
  score -= fabricatedRows * config.penalties.fabricationPenaltyPerItem;

  if (fabricatedRows > 0) flags.push("fabricated_timeline_entries");
  if (orderScore < 0.5) flags.push("significant_ordering_issues");

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags,
  };
}

function gradeEvidenceSupport(
  report: SocReportData,
  _gt: SocReportGroundTruth,
  criterion: RubricCriterion,
  config: ScoringConfig,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const flags: string[] = [];

  // Count evidence references across all sections
  const evidenceRefs = new Set<string>();
  const refPattern = /(?:alert|event|query|lookup):[a-z0-9_-]+/gi;

  // Collect refs from IoC evidence fields
  for (const ioc of report.iocs ?? []) {
    for (const ref of ioc.evidenceRefs ?? []) {
      evidenceRefs.add(ref.toLowerCase().trim());
    }
  }

  // Collect refs from timeline
  for (const row of report.timeline ?? []) {
    if (row.evidenceRef) {
      evidenceRefs.add(row.evidenceRef.toLowerCase().trim());
    }
  }

  // Collect refs from evidence appendix
  for (const ev of report.evidenceAppendix ?? []) {
    const syntheticRef = `${ev.type}:${ev.targetId}`.toLowerCase();
    evidenceRefs.add(syntheticRef);
  }

  // Check narrative text for inline refs
  const narrativeTexts = [
    report.executiveSummary ?? "",
    report.attackNarrative ?? "",
    report.verdict.justification ?? "",
    report.escalation.handoffSummary ?? "",
  ].join(" ");

  const inlineRefs = narrativeTexts.match(refPattern) ?? [];
  for (const ref of inlineRefs) {
    evidenceRefs.add(ref.toLowerCase().trim());
  }

  const totalRefs = evidenceRefs.size;

  // Score based on evidence density relative to claims
  const totalClaims =
    (report.iocs?.length ?? 0) +
    (report.timeline?.length ?? 0) +
    (report.techniques?.length ?? 0) +
    (report.actions?.length ?? 0);

  const evidenceDensity = totalClaims > 0 ? Math.min(1, totalRefs / totalClaims) : 0;

  // IoC rows without evidence refs
  let unsupportedIocs = 0;
  for (const ioc of report.iocs ?? []) {
    if (!ioc.evidenceRefs || ioc.evidenceRefs.length === 0) {
      unsupportedIocs++;
      annotations.push({
        claimType: "evidence",
        claimId: ioc.value,
        status: "unsupported",
        detail: `IoC '${ioc.value}' has no evidence reference`,
      });
    }
  }

  // Timeline rows without evidence refs
  let unsupportedTimeline = 0;
  for (const row of report.timeline ?? []) {
    if (!row.evidenceRef || row.evidenceRef.trim() === "") {
      unsupportedTimeline++;
      annotations.push({
        claimType: "evidence",
        claimId: row.id ?? row.description?.slice(0, 30),
        status: "unsupported",
        detail: `Timeline entry lacks evidence reference`,
      });
    }
  }

  let score = criterion.maxPoints * evidenceDensity;
  const totalUnsupported = unsupportedIocs + unsupportedTimeline;
  score -= totalUnsupported * config.penalties.missingEvidencePenalty;

  if (totalRefs === 0) flags.push("no_evidence_references");

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems: [],
    flags,
  };
}

function gradeTechniqueMapping(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];

  const acceptableIds = new Set(gt.techniques.acceptableTechniqueIds.map((id) => id.toUpperCase()));
  const acceptableTactics = new Set(gt.techniques.acceptableTactics.map((t) => t.toLowerCase()));

  let correct = 0;
  let tacticOnly = 0;
  let wrong = 0;

  for (const tech of report.techniques ?? []) {
    const tid = tech.techniqueId.toUpperCase();
    if (acceptableIds.has(tid)) {
      correct++;
      annotations.push({
        claimType: "technique",
        claimId: tech.techniqueId,
        status: "supported",
        detail: `Correct ATT&CK technique mapping`,
      });
    } else if (acceptableTactics.has(tech.tactic?.toLowerCase() ?? "")) {
      tacticOnly++;
      annotations.push({
        claimType: "technique",
        claimId: tech.techniqueId,
        status: "supported",
        detail: `Correct tactic but technique ID differs from expected (partial credit)`,
      });
    } else {
      wrong++;
      annotations.push({
        claimType: "technique",
        claimId: tech.techniqueId,
        status: "incorrect",
        detail: `Technique not associated with this incident's observed behaviors`,
      });
    }
  }

  // Mark missed techniques
  const submittedTechIds = new Set((report.techniques ?? []).map((t) => t.techniqueId.toUpperCase()));
  for (const tid of acceptableIds) {
    if (!submittedTechIds.has(tid)) {
      missedItems.push(`Missed technique: ${tid}`);
    }
  }

  const totalAcceptable = acceptableIds.size;
  const recall = totalAcceptable > 0 ? (correct + tacticOnly * 0.5) / totalAcceptable : 0;

  let score = criterion.maxPoints * Math.min(1, recall);
  score -= wrong * 0.5; // small penalty for wrong techniques

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags: [],
  };
}

function gradeResponseActions(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
  config: ScoringConfig,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];
  const flags: string[] = [];

  const requiredSet = new Set(gt.actions.requiredActionIds);
  const acceptableSet = new Set(gt.actions.acceptableActionIds);
  const harmfulSet = new Set(gt.actions.harmfulActionIds);

  let requiredFound = 0;
  let harmfulSelected = 0;

  for (const action of report.actions ?? []) {
    const aid = action.actionId;
    if (requiredSet.has(aid)) {
      requiredFound++;
      annotations.push({
        claimType: "action",
        claimId: aid,
        status: "supported",
        detail: `Required containment action correctly selected`,
      });
    } else if (acceptableSet.has(aid)) {
      annotations.push({
        claimType: "action",
        claimId: aid,
        status: "supported",
        detail: `Acceptable supplementary action`,
      });
    } else if (harmfulSet.has(aid)) {
      harmfulSelected++;
      annotations.push({
        claimType: "action",
        claimId: aid,
        status: "incorrect",
        detail: `HARMFUL action selected — this would destroy evidence or cause collateral damage`,
      });
      flags.push(`harmful_action_${aid}`);
    } else {
      annotations.push({
        claimType: "action",
        claimId: aid,
        status: "extra",
        detail: `Action not in the required or recommended set for this incident`,
      });
    }
  }

  // Mark missed required actions
  const submittedActionIds = new Set((report.actions ?? []).map((a) => a.actionId));
  for (const reqId of requiredSet) {
    if (!submittedActionIds.has(reqId)) {
      missedItems.push(`Missing required action: ${reqId}`);
      annotations.push({
        claimType: "action",
        claimId: reqId,
        status: "missing",
        detail: `Required containment action not selected`,
      });
    }
  }

  // Score = maxPoints × (requiredFound / requiredTotal) - harmful penalties
  const recall = requiredSet.size > 0 ? requiredFound / requiredSet.size : 0;
  let score = criterion.maxPoints * recall;
  score -= harmfulSelected * config.penalties.harmfulActionPenalty;

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags,
  };
}

function gradeEscalationHandoff(
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const missedItems: string[] = [];
  let score = 0;

  // 1. Escalation decision (binary)
  if (report.escalation.requiresEscalation === gt.escalation.requiresEscalation) {
    score += criterion.maxPoints * 0.3;
    annotations.push({
      claimType: "escalation_decision",
      status: "supported",
      detail: `Correct escalation decision`,
    });
  } else {
    annotations.push({
      claimType: "escalation_decision",
      status: "incorrect",
      detail: `Escalation decision incorrect: submitted ${report.escalation.requiresEscalation}, expected ${gt.escalation.requiresEscalation}`,
    });
    missedItems.push(`Escalation required: ${gt.escalation.requiresEscalation}`);
  }

  // 2. Target team
  if (report.escalation.targetTeam) {
    const targetNorm = report.escalation.targetTeam.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const acceptable = gt.escalation.acceptableTargets.some(
      (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "_") === targetNorm,
    );
    if (acceptable) {
      score += criterion.maxPoints * 0.2;
      annotations.push({
        claimType: "escalation_target",
        status: "supported",
        detail: `Appropriate escalation target`,
      });
    } else {
      annotations.push({
        claimType: "escalation_target",
        status: "incorrect",
        detail: `Escalation target '${report.escalation.targetTeam}' is not in the acceptable set`,
      });
    }
  } else {
    missedItems.push("Escalation target team not specified");
  }

  // 3. Urgency
  if (report.escalation.urgency) {
    if (gt.escalation.acceptableUrgencies.includes(report.escalation.urgency)) {
      score += criterion.maxPoints * 0.2;
      annotations.push({
        claimType: "escalation_urgency",
        status: "supported",
        detail: `Appropriate urgency level`,
      });
    } else {
      annotations.push({
        claimType: "escalation_urgency",
        status: "incorrect",
        detail: `Urgency '${report.escalation.urgency}' does not match expected levels`,
      });
    }
  }

  // 4. Handoff summary content (check for required elements)
  const summaryLower = (report.escalation.handoffSummary ?? "").toLowerCase();
  let handoffElements = 0;
  for (const element of gt.escalation.requiredHandoffElements) {
    const keywords = element.split("_");
    const found = keywords.some((kw) => summaryLower.includes(kw));
    if (found) {
      handoffElements++;
      annotations.push({
        claimType: "handoff_element",
        claimId: element,
        status: "supported",
        detail: `Handoff includes ${element.replace(/_/g, " ")}`,
      });
    } else {
      missedItems.push(`Handoff missing: ${element.replace(/_/g, " ")}`);
    }
  }

  const totalElements = gt.escalation.requiredHandoffElements.length;
  if (totalElements > 0) {
    score += criterion.maxPoints * 0.3 * (handoffElements / totalElements);
  }

  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems,
    flags: [],
  };
}

function gradeReportHygiene(
  report: SocReportData,
  _gt: SocReportGroundTruth,
  criterion: RubricCriterion,
): CriterionResult {
  const annotations: ClaimAnnotation[] = [];
  const flags: string[] = [];
  let deductions = 0;

  // 1. Check IoC defanging
  let undefangedCount = 0;
  for (const ioc of report.iocs ?? []) {
    if (ioc.type === "ip" || ioc.type === "domain" || ioc.type === "url") {
      const shouldDefang = defangIndicator(ioc.value);
      const hasDefanged = ioc.defangedValue && ioc.defangedValue.trim().length > 0;
      if (!hasDefanged && shouldDefang !== ioc.value) {
        undefangedCount++;
        annotations.push({
          claimType: "hygiene",
          claimId: ioc.value,
          status: "incorrect",
          detail: `Indicator not defanged: should be '${shouldDefang}'`,
        });
      }
    }
  }
  deductions += undefangedCount * 0.5;

  // 2. Check for raw log dumps in narrative sections
  const narrativeFields = [
    report.executiveSummary ?? "",
    report.attackNarrative ?? "",
    report.verdict.justification ?? "",
  ];

  for (const field of narrativeFields) {
    if (detectCopyPaste(field)) {
      deductions += 1.5;
      flags.push("copy_paste_detected");
      annotations.push({
        claimType: "hygiene",
        status: "incorrect",
        detail: `Raw log data detected in narrative section — logs belong in the Evidence Appendix`,
      });
    }
  }

  // 3. Check for prompt injection attempts
  const allText = [
    report.executiveSummary ?? "",
    report.attackNarrative ?? "",
    report.verdict.justification ?? "",
    report.escalation.handoffSummary ?? "",
    report.lessonsLearned ?? "",
  ].join(" ");

  if (detectInjection(allText)) {
    flags.push("injection_detected");
    annotations.push({
      claimType: "hygiene",
      status: "incorrect",
      detail: `Potential prompt injection pattern detected — text is treated as passive data`,
    });
    // No scoring penalty (deterministic grader ignores instructions) but flag it
  }

  // 4. Basic formatting checks
  if ((report.header.title ?? "").length < 5) {
    deductions += 0.5;
    annotations.push({
      claimType: "hygiene",
      status: "incorrect",
      detail: `Report title is too short or missing`,
    });
  }

  let score = criterion.maxPoints - deductions;
  score = Math.max(0, Math.min(criterion.maxPoints, Math.round(score * 100) / 100));

  return {
    criterionId: criterion.id,
    score,
    maxScore: criterion.maxPoints,
    weight: criterion.weight,
    status: "graded",
    feedback: lookupFeedback(criterion, score),
    teachingPointers: score < criterion.maxPoints ? [criterion.teachingNotes] : [],
    annotations,
    missedItems: [],
    flags,
  };
}

// ---------------------------------------------------------------------------
// Grader Dispatch Map
// ---------------------------------------------------------------------------

type DeterministicGrader = (
  report: SocReportData,
  gt: SocReportGroundTruth,
  criterion: RubricCriterion,
  config: ScoringConfig,
) => CriterionResult;

const DETERMINISTIC_GRADERS: Record<string, DeterministicGrader> = {
  verdict_accuracy: (r, g, c, _cfg) => gradeVerdictAccuracy(r, g, c),
  incident_scoping: (r, g, c, _cfg) => gradeIncidentScoping(r, g, c),
  ioc_extraction: gradeIocExtraction,
  timeline_accuracy: gradeTimelineAccuracy,
  evidence_support: gradeEvidenceSupport,
  technique_mapping: (r, g, c, _cfg) => gradeTechniqueMapping(r, g, c),
  response_actions: gradeResponseActions,
  escalation_handoff: (r, g, c, _cfg) => gradeEscalationHandoff(r, g, c),
  report_hygiene: (r, g, c, _cfg) => gradeReportHygiene(r, g, c),
};

// ---------------------------------------------------------------------------
// Main Grading Entry Point
// ---------------------------------------------------------------------------

export interface GradeReportOptions {
  rubricId?: string;
  aiGrader?: AiCriterionGrader;
}

/**
 * Grade a submitted report against ground truth.
 *
 * Pure function: Grade = f(submission, groundTruth, rubric, scoringConfig)
 *
 * Returns a complete GradingResult with per-criterion scores, feedback,
 * annotations, flags, and the model report for post-submission reveal.
 */
export async function gradeReport(
  submissionId: string,
  report: SocReportData,
  groundTruth: SocReportGroundTruth,
  options: GradeReportOptions = {},
): Promise<GradingResult> {
  const rubric = loadRubric(options.rubricId);
  const config = loadScoringConfig();
  const aiGrader = options.aiGrader ?? defaultAiCriterionGrader;

  const criterionResults: Record<string, CriterionResult> = {};
  let totalEarned = 0;
  let totalMax = 0;
  let availableGradedPoints = 0;
  let earnedGradedPoints = 0;
  let isFullyGraded = true;

  // Global flag detection
  let paddingDetected = false;
  let fabricationDetected = false;
  let contradictionsDetected = false;
  let copyPasteDetected = false;
  let injectionDetected = false;

  for (const criterion of rubric.criteria) {
    let result: CriterionResult;

    if (criterion.graderType === "deterministic") {
      const grader = DETERMINISTIC_GRADERS[criterion.id];
      if (grader) {
        result = grader(report, groundTruth, criterion, config);
      } else {
        // Unknown criterion — skip gracefully
        result = {
          criterionId: criterion.id,
          score: 0,
          maxScore: criterion.maxPoints,
          weight: criterion.weight,
          status: "not_available",
          feedback: `Grader for '${criterion.id}' is not yet implemented.`,
          teachingPointers: [],
          annotations: [],
          missedItems: [],
          flags: [],
        };
        isFullyGraded = false;
      }
    } else {
      // AI criterion — delegate to seam
      result = await aiGrader.gradeCriterion(criterion.id, report, groundTruth, rubric);
      if (result.status === "not_available") {
        isFullyGraded = false;
      }
    }

    criterionResults[criterion.id] = result;

    if (result.status === "graded") {
      totalEarned += result.score * result.weight;
      totalMax += result.maxScore * result.weight;
      availableGradedPoints += result.maxScore;
      earnedGradedPoints += result.score;
    }

    // Aggregate flags
    for (const flag of result.flags) {
      if (flag.includes("padding")) paddingDetected = true;
      if (flag.includes("fabricat")) fabricationDetected = true;
      if (flag.includes("contradiction")) contradictionsDetected = true;
      if (flag.includes("copy_paste")) copyPasteDetected = true;
      if (flag.includes("injection")) injectionDetected = true;
    }
  }

  // Compute weighted total score (0-100 scale)
  const totalScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100 * 100) / 100 : 0;

  return {
    submissionId,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    graderVersion: GRADER_VERSION,
    scoringVersion: SCORING_VERSION,
    totalScore,
    maxScore: 100,
    availableGradedPoints,
    earnedGradedPoints,
    isFullyGraded,
    criterionResults,
    flags: {
      paddingDetected,
      fabricationDetected,
      contradictionsDetected,
      copyPasteDetected,
      injectionDetected,
    },
    modelReportReveal: groundTruth.modelReport,
    versionLabel: `grader:${GRADER_VERSION}/scoring:${SCORING_VERSION}/rubric:${rubric.version}`,
    computedAt: new Date().toISOString(),
  };
}
