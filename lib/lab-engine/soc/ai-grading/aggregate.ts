import type { ValidSample } from "./output";
import type { AiConfidence, AiGradeFlag, Band, VerifiedSpan } from "./types";

export interface AggregatedGrade {
  band: Band;
  confidence: AiConfidence;
  spread: number;
  spans: VerifiedSpan[];
  strengths: string[];
  improvements: string[];
  flags: AiGradeFlag[];
}

/** Lower median: with an even count the more conservative band wins. */
export function medianBand(bands: Band[]): Band {
  const sorted = [...bands].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function aggregateSamples(
  samples: ValidSample[],
  opts: { lowConfidenceSpread: number },
): AggregatedGrade {
  if (samples.length === 0) throw new Error("aggregateSamples needs at least one sample");
  const bands = samples.map((s) => s.band);
  const band = medianBand(bands);
  const spread = Math.max(...bands) - Math.min(...bands);

  const agreeing = samples.filter((s) => s.band === band);
  const modelConf = [...agreeing.map((s) => s.modelConfidence)].sort((a, b) => a - b)[Math.floor((agreeing.length - 1) / 2)];

  let confidence: AiConfidence = spread === 0 ? "high" : "medium";
  if (spread >= opts.lowConfidenceSpread || modelConf < 0.5) confidence = "low";
  else if (modelConf < 0.75 && confidence === "high") confidence = "medium";

  const spans: VerifiedSpan[] = [];
  for (const s of agreeing) {
    for (const span of s.spans) {
      if (spans.length < 4 && !spans.some((x) => x.field === span.field && x.start === span.start)) spans.push(span);
    }
  }
  const best = [...agreeing].sort((a, b) => b.modelConfidence - a.modelConfidence)[0];

  const flags = new Set<AiGradeFlag>(samples.flatMap((s) => s.flags));
  if (spread >= opts.lowConfidenceSpread) flags.add("disagreement");

  return {
    band,
    confidence,
    spread,
    spans,
    strengths: best.strengths,
    improvements: best.improvements,
    flags: [...flags],
  };
}
