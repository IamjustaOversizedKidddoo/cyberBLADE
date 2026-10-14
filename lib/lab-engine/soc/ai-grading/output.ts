/**
 * Validates one raw model response. Anything that is not a well-formed, rule-abiding
 * answer is rejected with a code; the caller retries once and otherwise does not grade.
 */
import { z } from "zod";
import { overlapsRegion, type InjectionRegion } from "./injection-signals";
import type { FieldSegment } from "./prompt";
import type { AiGradeFlag, Band, VerifiedSpan } from "./types";

export const MAX_RAW_OUTPUT_CHARS = 8000;

const outputSchema = z
  .object({
    band: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    confidence: z.number().min(0).max(1),
    evidenceSpans: z.array(z.string().min(3).max(240)).max(4),
    strengths: z.array(z.string().min(1).max(300)).max(3),
    improvements: z.array(z.string().min(1).max(300)).max(3),
    insufficientInformation: z.boolean(),
  })
  .strict();

export type SampleRejection =
  | "empty"
  | "oversized"
  | "not_json"
  | "schema"
  | "canary_leak"
  | "span_not_verbatim"
  | "band_without_evidence"
  | "insufficient_with_band";

export interface ValidSample {
  band: Band;
  modelConfidence: number;
  spans: VerifiedSpan[];
  strengths: string[];
  improvements: string[];
  insufficientInformation: boolean;
  flags: AiGradeFlag[];
}

export type SampleResult = { ok: true; sample: ValidSample } | { ok: false; rejection: SampleRejection };

/** Accept a bare JSON object, optionally inside one ```json fence. Nothing else. */
function extractJson(raw: string): string | null {
  const t = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*)\n```$/.exec(t);
  const body = (fenced ? fenced[1] : t).trim();
  return body.startsWith("{") && body.endsWith("}") ? body : null;
}

function locate(span: string, segments: FieldSegment[]): VerifiedSpan | null {
  for (const s of segments) {
    const start = s.text.indexOf(span);
    if (start !== -1) return { text: span, field: s.field, start, end: start + span.length };
  }
  return null;
}

export function validateSample(
  raw: string,
  ctx: { segments: FieldSegment[]; canary: string; injectionRegions: InjectionRegion[] },
): SampleResult {
  if (!raw || !raw.trim()) return { ok: false, rejection: "empty" };
  if (raw.length > MAX_RAW_OUTPUT_CHARS) return { ok: false, rejection: "oversized" };
  if (raw.includes(ctx.canary)) return { ok: false, rejection: "canary_leak" };

  const body = extractJson(raw);
  if (!body) return { ok: false, rejection: "not_json" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, rejection: "not_json" };
  }
  const result = outputSchema.safeParse(parsed);
  if (!result.success) return { ok: false, rejection: "schema" };
  const out = result.data;

  const flags: AiGradeFlag[] = [];
  const spans: VerifiedSpan[] = [];
  for (const quote of out.evidenceSpans) {
    const found = locate(quote, ctx.segments);
    if (!found) return { ok: false, rejection: "span_not_verbatim" };
    if (overlapsRegion(ctx.injectionRegions, found.field, found.start, found.end)) {
      if (!flags.includes("spans_in_instruction_region")) flags.push("spans_in_instruction_region");
      continue; // quoting the injection is not evidence of good writing
    }
    // Overlapping quotes are one piece of evidence, not two.
    const overlaps = spans.some((s) => s.field === found.field && found.start < s.end && found.end > s.start);
    if (!overlaps) spans.push(found);
  }

  if (out.insufficientInformation && out.band !== 0) return { ok: false, rejection: "insufficient_with_band" };
  if (out.insufficientInformation) flags.push("insufficient_information");
  if (out.band >= 1 && spans.length < 1) return { ok: false, rejection: "band_without_evidence" };
  if (out.band === 3 && spans.length < 2) return { ok: false, rejection: "band_without_evidence" };

  return {
    ok: true,
    sample: {
      band: out.band,
      modelConfidence: out.confidence,
      spans,
      strengths: out.strengths,
      improvements: out.improvements,
      insufficientInformation: out.insufficientInformation,
      flags,
    },
  };
}
