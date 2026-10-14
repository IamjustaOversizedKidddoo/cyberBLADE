/**
 * Grades ONE criterion: pre-filter -> N samples (each retried once if invalid) -> validate ->
 * aggregate -> sanity/injection rules -> outcome. Pure apart from the provider calls.
 */
import { NoCompletionProviderError } from "@/lib/handler/providers/factory";
import { aggregateSamples } from "./aggregate";
import type { AiGradingConfig } from "./config";
import { buildLearnerFeedback, emptyFeedback } from "./feedback";
import type { InjectionScan } from "./injection-signals";
import { validateSample, type SampleRejection, type ValidSample } from "./output";
import { criterionText, prefilterCriterion, type PrefilterContext } from "./prefilter";
import { buildCriterionPrompt, computeInputHash, newPromptSecrets, type PromptSecrets } from "./prompt";
import type { AiCompletionProvider } from "./provider";
import { countWords } from "./text";
import type {
  AiConfidence,
  AiGradeFlag,
  AiGradeStatus,
  AiGradingInput,
  AiLearnerFeedback,
  AiRubricCriterion,
  Band,
  NotGradedReason,
  VerifiedSpan,
} from "./types";

export interface RawSample {
  sampleIndex: number;
  attempt: number;
  text: string;
  promptHash: string;
  rejection?: SampleRejection;
}

export interface CriterionOutcome {
  status: AiGradeStatus;
  notGradedReason?: NotGradedReason;
  band?: Band;
  confidence?: AiConfidence;
  eligibleToCount: boolean;
  feedback: AiLearnerFeedback;
  verifiedSpans: VerifiedSpan[];
  flags: AiGradeFlag[];
  inputHash: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  rawSamples: RawSample[];
}

/** Transient provider trouble: the job layer retries with backoff instead of recording a grade. */
export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

/** Returned when the next call would exceed a token budget. */
export interface TokenBudget {
  /** Called before each call with an estimate; false stops grading with this reason. */
  allow(estimatedTokens: number): NotGradedReason | null;
  consume(inputTokens: number, outputTokens: number): void;
}

export const UNLIMITED_BUDGET: TokenBudget = { allow: () => null, consume: () => {} };

export interface GradeCriterionArgs {
  criterion: AiRubricCriterion;
  input: AiGradingInput;
  injection: InjectionScan;
  prefilter: PrefilterContext;
  provider: AiCompletionProvider;
  config: AiGradingConfig;
  versions: { aiRubricVersion: string; promptVersion: string };
  budget?: TokenBudget;
  secrets?: () => PromptSecrets;
}

function notGraded(reason: NotGradedReason, base: Pick<CriterionOutcome, "inputHash" | "modelId" | "inputTokens" | "outputTokens" | "rawSamples">, flags: AiGradeFlag[] = []): CriterionOutcome {
  return {
    status: "not_graded",
    notGradedReason: reason,
    eligibleToCount: false,
    feedback: emptyFeedback(),
    verifiedSpans: [],
    flags,
    ...base,
  };
}

export async function gradeCriterion(args: GradeCriterionArgs): Promise<CriterionOutcome> {
  const { criterion, input, injection, config, versions } = args;
  const budget = args.budget ?? UNLIMITED_BUDGET;
  const makeSecrets = args.secrets ?? newPromptSecrets;
  const text = criterionText(input, criterion.fields);
  const inputHash = computeInputHash(criterion, input, versions);
  const acc = { inputHash, modelId: "", inputTokens: 0, outputTokens: 0, rawSamples: [] as RawSample[] };

  const skip = prefilterCriterion(text, args.prefilter, config.prefilter);
  if (skip) return notGraded(skip, acc);

  const relevantRegions = injection.regions.filter((r) => criterion.fields.includes(r.field));
  const valid: ValidSample[] = [];
  const flags = new Set<AiGradeFlag>();
  let rejectedAll = true;

  for (let i = 0; i < config.sampling.samples; i++) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildCriterionPrompt(criterion, input, versions, makeSecrets());
      const estimate = Math.ceil((prompt.system.length + prompt.user.length) / 4) + config.sampling.maxOutputTokens;
      const stop = budget.allow(estimate);
      if (stop) return notGraded(stop, acc);

      let raw: string;
      try {
        const res = await args.provider.complete({
          systemPrompt: prompt.system,
          userMessage: prompt.user,
          temperature: config.sampling.temperature,
          maxOutputTokens: config.sampling.maxOutputTokens,
          timeoutMs: config.sampling.timeoutMs,
          jsonMode: true,
        });
        raw = res.text;
        acc.modelId = res.modelId;
        acc.inputTokens += res.inputTokens;
        acc.outputTokens += res.outputTokens;
        budget.consume(res.inputTokens, res.outputTokens);
      } catch (err) {
        // No valid sample yet: let the job layer retry later. Otherwise keep what we have.
        if (valid.length === 0) {
          const msg = err instanceof NoCompletionProviderError ? err.reason : err instanceof Error ? err.message : String(err);
          throw new ProviderUnavailableError(msg);
        }
        break;
      }

      const checked = validateSample(raw, { segments: prompt.segments, canary: prompt.canary, injectionRegions: relevantRegions });
      acc.rawSamples.push({ sampleIndex: i, attempt, text: raw.slice(0, 8000), promptHash: prompt.promptHash, rejection: checked.ok ? undefined : checked.rejection });
      if (checked.ok) {
        rejectedAll = false;
        valid.push(checked.sample);
        break;
      }
      if (checked.rejection === "canary_leak") flags.add("canary_leak");
    }
  }

  if (valid.length < config.sampling.minValidSamples) {
    return notGraded(rejectedAll ? "invalid_output" : "insufficient_valid_samples", acc, [...flags]);
  }

  const agg = aggregateSamples(valid, { lowConfidenceSpread: config.sampling.disagreementSpreadLowConfidence });
  agg.flags.forEach((f) => flags.add(f));
  // A payload anywhere makes the whole submission adversarial: split attacks put half the
  // instruction in a field this criterion never reads.
  if (injection.flagged) flags.add("injection_signals");

  let status: AiGradeStatus = "graded";
  if (agg.band >= 2 && countWords(text) < config.sanity.minWordsForHighBand) {
    flags.add("sanity_high_band_short_text");
    status = "needs_review";
  }
  if (flags.has("injection_signals") || flags.has("canary_leak")) status = "needs_review";

  return {
    status,
    band: agg.band,
    confidence: agg.confidence,
    eligibleToCount: status === "graded" && agg.confidence !== "low",
    feedback: buildLearnerFeedback(criterion, agg.band, agg.strengths, agg.improvements),
    verifiedSpans: agg.spans,
    flags: [...flags],
    ...acc,
  };
}
