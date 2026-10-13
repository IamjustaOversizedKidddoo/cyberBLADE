/**
 * Pre-Submission Report Linter (Leak-Free Format & Completeness Validator)
 *
 * Checks:
 * 1. Required sections completed
 * 2. Field length constraints
 * 3. Timeline ordering & valid UTC timestamps
 * 4. IoC defanging & valid syntax
 * 5. Evidence references existence within the learner's own visible session data
 *
 * CRITICAL SAFETY PROPERTY:
 * This validator NEVER inspects scenario ground truth.
 * Its output carries zero bits of information regarding claim correctness.
 */

import type { SocReportData, ReportTemplate, PreSubmitLintResult } from "./types";

export interface SessionEvidenceContext {
  visibleAlertIds: Set<string>;
  visibleEventIds: Set<string>;
  visibleQueryIds: Set<string>;
  visibleLookupIds: Set<string>;
}

export function lintReportDraft(
  report: SocReportData,
  template: ReportTemplate,
  sessionContext?: SessionEvidenceContext,
): PreSubmitLintResult {
  const errors: Array<{ sectionId: string; message: string }> = [];
  const warnings: Array<{ sectionId: string; message: string }> = [];
  let checksRun = 0;

  // 1. Header validation
  checksRun++;
  if (!report.header.title.trim()) {
    errors.push({ sectionId: "header", message: "Report title is required." });
  } else if (report.header.title.length > 160) {
    errors.push({ sectionId: "header", message: "Report title exceeds maximum length of 160 characters." });
  }

  // 2. Executive summary validation
  checksRun++;
  const execSection = template.sections.find((s) => s.id === "executive_summary");
  if (execSection?.required && (!report.executiveSummary || report.executiveSummary.trim().length < 30)) {
    errors.push({
      sectionId: "executive_summary",
      message: "Executive summary is incomplete (minimum 30 characters required).",
    });
  } else if (report.executiveSummary && report.executiveSummary.length > 1200) {
    errors.push({
      sectionId: "executive_summary",
      message: "Executive summary exceeds maximum limit of 1,200 characters.",
    });
  }

  // 3. Verdict & severity justification
  checksRun++;
  if (!report.verdict.justification || report.verdict.justification.trim().length < 20) {
    errors.push({
      sectionId: "verdict_and_severity",
      message: "Triage verdict requires a justification statement (minimum 20 characters).",
    });
  }

  // 4. Scope & affected entities
  checksRun++;
  const scopeSection = template.sections.find((s) => s.id === "scope_and_impact");
  if (scopeSection?.required && report.scope.affectedAssets.length === 0 && report.scope.affectedUsers.length === 0) {
    errors.push({
      sectionId: "scope_and_impact",
      message: "At least one affected asset or user identity must be specified.",
    });
  }

  // 5. Timeline validation
  checksRun++;
  const timelineSection = template.sections.find((s) => s.id === "timeline");
  if (timelineSection?.required && report.timeline.length < 2) {
    errors.push({
      sectionId: "timeline",
      message: "Incident timeline requires at least 2 chronological milestone events.",
    });
  }

  // Check chronological order of timeline rows
  let previousEpoch = -Infinity;
  let isUnordered = false;
  for (let i = 0; i < report.timeline.length; i++) {
    const row = report.timeline[i];
    const epoch = new Date(row.timestampUtc || row.rawTimestamp).getTime();
    if (isNaN(epoch)) {
      errors.push({
        sectionId: "timeline",
        message: `Timeline row #${i + 1} has an invalid timestamp format.`,
      });
    } else {
      if (epoch < previousEpoch) {
        isUnordered = true;
      }
      previousEpoch = epoch;
    }

    if (!row.description.trim()) {
      errors.push({
        sectionId: "timeline",
        message: `Timeline row #${i + 1} is missing an event description.`,
      });
    }
  }

  if (isUnordered) {
    warnings.push({
      sectionId: "timeline",
      message: "Timeline rows are not sorted in chronological order. Click 'Sort Chronologically' to reorder.",
    });
  }

  // 6. Indicators of Compromise validation
  checksRun++;
  const iocSection = template.sections.find((s) => s.id === "indicators_of_compromise");
  if (iocSection?.required && report.iocs.length === 0) {
    errors.push({
      sectionId: "indicators_of_compromise",
      message: "At least one indicator of compromise (IoC) must be documented.",
    });
  }

  for (let i = 0; i < report.iocs.length; i++) {
    const ioc = report.iocs[i];
    if (!ioc.value.trim()) {
      errors.push({
        sectionId: "indicators_of_compromise",
        message: `IoC row #${i + 1} has an empty indicator value.`,
      });
      continue;
    }

    // Check if network indicators are defanged
    if (ioc.type === "ip" || ioc.type === "domain" || ioc.type === "url") {
      const isDefanged =
        ioc.value.includes("[.]") ||
        ioc.value.includes("(.)") ||
        ioc.value.startsWith("hxxp");

      if (!isDefanged) {
        warnings.push({
          sectionId: "indicators_of_compromise",
          message: `Indicator '${ioc.value}' is not defanged. Recommended: use [.] or hxxp.`,
        });
      }
    }
  }

  // 7. Attack narrative validation
  checksRun++;
  const narrativeSection = template.sections.find((s) => s.id === "attack_narrative");
  if (narrativeSection?.required && (!report.attackNarrative || report.attackNarrative.trim().length < 50)) {
    errors.push({
      sectionId: "attack_narrative",
      message: "Attack narrative is incomplete (minimum 50 characters required).",
    });
  }

  // 8. Containment & response actions validation
  checksRun++;
  const actionSection = template.sections.find((s) => s.id === "response_actions");
  if (actionSection?.required && report.actions.length === 0) {
    errors.push({
      sectionId: "response_actions",
      message: "At least one containment or response action must be recommended.",
    });
  }

  for (const act of report.actions) {
    if (!act.rationale || act.rationale.trim().length < 10) {
      warnings.push({
        sectionId: "response_actions",
        message: `Action '${act.actionName}' is missing an analyst rationale.`,
      });
    }
  }

  // 9. Escalation handoff validation
  checksRun++;
  const escalationSection = template.sections.find((s) => s.id === "escalation_handoff");
  if (escalationSection?.required && report.escalation.requiresEscalation && !report.escalation.handoffSummary.trim()) {
    errors.push({
      sectionId: "escalation_handoff",
      message: "Escalation handoff summary is required when escalation is marked as needed.",
    });
  }

  // 10. Evidence references resolution check (pure format check against session history)
  if (sessionContext) {
    checksRun++;
    const allRefs: string[] = [];

    // Collect all cited evidence references
    for (const row of report.timeline) {
      if (row.evidenceRef) allRefs.push(row.evidenceRef);
    }
    for (const ioc of report.iocs) {
      allRefs.push(...ioc.evidenceRefs);
    }

    for (const ref of allRefs) {
      const parts = ref.split(":");
      if (parts.length < 2) continue;
      const [type, id] = parts;

      let exists = false;
      if (type === "alert") exists = sessionContext.visibleAlertIds.has(id);
      else if (type === "event") exists = sessionContext.visibleEventIds.has(id);
      else if (type === "query") exists = sessionContext.visibleQueryIds.has(id);
      else if (type === "lookup") exists = sessionContext.visibleLookupIds.has(id);
      else exists = true; // Unknown custom prefix tolerated

      if (!exists) {
        warnings.push({
          sectionId: "evidence_appendix",
          message: `Evidence reference '${ref}' was not observed in your investigation session.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checksRun,
  };
}
