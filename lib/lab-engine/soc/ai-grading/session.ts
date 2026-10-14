/**
 * Prepares one submitted report for AI grading: sanitized input, injection scan and the
 * per-criterion pre-filter context. Everything downstream works from this object only.
 */
import { createEmptyReportData } from "../reports/defaults";
import type { ReportTemplate, SocReportData } from "../reports/types";
import { buildAiGradingInput, type LearnerVisibleScenarioFacts } from "./boundary";
import { scanForInjection, type InjectionScan } from "./injection-signals";
import { criterionText, type PrefilterContext } from "./prefilter";
import type { AiGradingInput, AiRubricCriterion } from "./types";

export interface PreparedSubmission {
  input: AiGradingInput;
  injection: InjectionScan;
}

export function prepareSubmission(
  report: SocReportData,
  facts: LearnerVisibleScenarioFacts,
  template: Pick<ReportTemplate, "sections">,
  learnerHandles: string[] = [],
): PreparedSubmission {
  const built = buildAiGradingInput(report, facts, template, { learnerHandles });
  return { input: built.input, injection: scanForInjection(built.input.fields, built.invisibleCharsRemoved) };
}

/** What an untouched scaffold and the template guidance look like for this criterion's fields. */
export function buildPrefilterContext(
  criterion: AiRubricCriterion,
  template: Pick<ReportTemplate, "sections">,
): PrefilterContext {
  const scaffold = buildAiGradingInput(createEmptyReportData("analyst"), { title: "", briefing: "" }, template).input;
  return {
    scaffoldText: criterionText(scaffold, criterion.fields),
    guidanceText: [...new Set(criterion.fields.map((f) => scaffold.templateGuidance[f] ?? ""))].join("\n"),
  };
}
