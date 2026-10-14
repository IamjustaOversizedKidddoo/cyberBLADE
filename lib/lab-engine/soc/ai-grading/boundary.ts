/**
 * The information boundary. This is the ONLY place that decides what a model may see.
 *
 * Its parameters carry the learner's report, the learner-visible scenario facts and the
 * template guidance the learner was shown. There is deliberately no parameter through which
 * ground truth, model reports, seeds, family ids or deterministic scores could arrive.
 */
import type { SocReportData, ReportTemplate } from "../reports/types";
import { neutralizeUnicode, scrubPii } from "./text";
import type { AiGradingInput, AiReportField } from "./types";

/** Exactly what the learner saw in the briefing; built from toClientView(scenario). */
export interface LearnerVisibleScenarioFacts {
  title: string;
  briefing: string;
}

const FIELD_TO_TEMPLATE_SECTION: Record<AiReportField, string> = {
  executiveSummary: "executive_summary",
  attackNarrative: "attack_narrative",
  verdictJustification: "verdict_and_severity",
  timelineDescriptions: "timeline",
  iocNotes: "indicators_of_compromise",
  lessonsLearned: "lessons_learned",
  actions: "response_actions",
  escalationTeam: "escalation_handoff",
  escalationUrgency: "escalation_handoff",
  handoffSummary: "escalation_handoff",
};

function rawFieldText(report: SocReportData, field: AiReportField): string {
  switch (field) {
    case "executiveSummary":
      return report.executiveSummary ?? "";
    case "attackNarrative":
      return report.attackNarrative ?? "";
    case "verdictJustification":
      return report.verdict?.justification ?? "";
    case "timelineDescriptions":
      return (report.timeline ?? [])
        .map((r) => `- ${r.timestampUtc} ${r.description}${r.evidenceRef ? ` [${r.evidenceRef}]` : ""}`)
        .join("\n");
    case "iocNotes":
      return (report.iocs ?? [])
        .filter((i) => i.notes && i.notes.trim())
        .map((i) => `- ${i.type} ${i.defangedValue ?? i.value} (${i.role}): ${i.notes}`)
        .join("\n");
    case "lessonsLearned":
      return report.lessonsLearned ?? "";
    case "actions":
      return [...(report.actions ?? [])]
        .sort((a, b) => a.priority - b.priority)
        .map((a) => `- ${a.priority}. ${a.actionName}: ${a.rationale}`)
        .join("\n");
    case "escalationTeam":
      return report.escalation?.requiresEscalation
        ? `Escalate to: ${report.escalation.targetTeam ?? "(not named)"}`
        : "No escalation";
    case "escalationUrgency":
      return report.escalation?.urgency ? `Urgency: ${report.escalation.urgency}` : "";
    case "handoffSummary":
      return report.escalation?.handoffSummary ?? "";
  }
}

/** Template guidance per field, exactly as the learner saw it. */
export function guidanceForTemplate(template: Pick<ReportTemplate, "sections">): AiGradingInput["templateGuidance"] {
  const out: AiGradingInput["templateGuidance"] = {};
  for (const field of Object.keys(FIELD_TO_TEMPLATE_SECTION) as AiReportField[]) {
    const section = template.sections.find((s) => s.id === FIELD_TO_TEMPLATE_SECTION[field]);
    if (section) out[field] = section.guidance;
  }
  return out;
}

export interface BuiltAiGradingInput {
  input: AiGradingInput;
  /** Characters removed by Unicode neutralization (never sent; used as an injection signal). */
  invisibleCharsRemoved: number;
}

function clean(text: string, handles: string[]): { text: string; removed: number } {
  const n = neutralizeUnicode(text);
  return { text: scrubPii(n.text, handles).trim(), removed: n.removed };
}

export function buildAiGradingInput(
  report: SocReportData,
  facts: LearnerVisibleScenarioFacts,
  template: Pick<ReportTemplate, "sections">,
  options: { learnerHandles?: string[] } = {},
): BuiltAiGradingInput {
  const handles = [report.header?.analystHandle ?? "", ...(options.learnerHandles ?? [])].filter(Boolean);
  const fields: AiGradingInput["fields"] = {};
  const templateGuidance = guidanceForTemplate(template);
  let removed = 0;

  for (const field of Object.keys(FIELD_TO_TEMPLATE_SECTION) as AiReportField[]) {
    const c = clean(rawFieldText(report, field), handles);
    removed += c.removed;
    fields[field] = c.text;
  }

  const factText = clean(`${facts.title}\n${facts.briefing}`, handles).text;
  return { input: { fields, scenarioFacts: factText, templateGuidance }, invisibleCharsRemoved: removed };
}
