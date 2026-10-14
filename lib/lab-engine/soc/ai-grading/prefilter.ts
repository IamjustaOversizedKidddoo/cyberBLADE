/**
 * Cheap, deterministic checks that decide a criterion is not worth a model call.
 * A skipped criterion is reported as "Not graded: <reason>", never scored.
 */
import type { AiGradingConfig } from "./config";
import { countWords } from "./text";
import type { AiGradingInput, AiReportField, NotGradedReason } from "./types";

export function criterionText(input: AiGradingInput, fields: AiReportField[]): string {
  return fields
    .map((f) => input.fields[f] ?? "")
    .filter((t) => t.trim())
    .join("\n\n");
}

const KV_PAIR = /\b[\w.-]+=("[^"]*"|\S+)/g;
const RAW_LOG_LINE = [
  /^\s*[{[]\s*"/, // JSON object/array line
  /^<\d{1,3}>/, // syslog priority
  /^[A-Z][a-z]{2}\s+\d{1,2}\s\d\d:\d\d:\d\d\s\S+\s\S+(\[\d+\])?:/, // classic syslog header
  /\bCEF:\d+\|/, // CEF
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z?\s+\S+\s+\S+=/, // ISO timestamp followed by key=value
];

export function looksLikeRawLogLine(line: string): boolean {
  if (RAW_LOG_LINE.some((re) => re.test(line))) return true;
  return (line.match(KV_PAIR)?.length ?? 0) >= 3;
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Share of the text's tokens that also appear in the reference (guidance + empty scaffold). */
function coverage(text: string, reference: Set<string>): number {
  const t = tokens(text);
  if (t.length === 0) return 1;
  return t.filter((w) => reference.has(w)).length / t.length;
}

export interface PrefilterContext {
  /** Text of the same fields produced from an untouched empty scaffold. */
  scaffoldText: string;
  /** Template guidance shown for the same fields. */
  guidanceText: string;
}

export function prefilterCriterion(
  text: string,
  ctx: PrefilterContext,
  config: AiGradingConfig["prefilter"],
): NotGradedReason | null {
  if (text.length > config.maxCharsPerCriterion) return "over_length";
  if (countWords(text) < config.minWordsPerCriterion) return "empty";

  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized === ctx.scaffoldText.replace(/\s+/g, " ").trim().toLowerCase()) return "template_only";
  const reference = new Set([...tokens(ctx.guidanceText), ...tokens(ctx.scaffoldText)]);
  if (coverage(text, reference) >= config.templateSimilarity) return "template_only";

  const lines = text.split("\n").filter((l) => l.trim());
  const logLines = lines.filter(looksLikeRawLogLine).length;
  if (lines.length >= 3 && logLines / lines.length >= config.copyPasteLineRatio) return "copy_paste_dominated";
  return null;
}
