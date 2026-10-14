/**
 * Computes the release gate from a calibration set. Pure: no files, no network.
 * The gate it returns always has an EMPTY sign-off; only the owner fills that in, by hand.
 */
import type { ReportTemplate } from "../../reports/types";
import type { AiGradingConfig } from "../config";
import { gradeCriterion, ProviderUnavailableError } from "../grade-criterion";
import type { CurrentVersions, GateFile } from "../gate";
import { scanForInjection } from "../injection-signals";
import type { AiCompletionProvider } from "../provider";
import { buildPrefilterContext } from "../session";
import type { AiRubric } from "../types";
import type { FairnessResult } from "./fairness";
import type { InjectionSuiteResult } from "./injection-suite";
import {
  bandFlipRate,
  bootstrapCI,
  consensusBand,
  icc21,
  krippendorffAlpha,
  meanAbsoluteError,
  quadraticWeightedKappa,
  signedBias,
  withinOneBandRate,
  type ConfidenceInterval,
} from "./metrics";
import { inputFromPacket, type CalibrationManifest, type CalibrationPacket, type HumanScore, type ModelScore } from "./packets";

/** Grade every packet `runs` times with the model under test (fresh fences each time). */
export async function gradePackets(args: {
  packets: CalibrationPacket[];
  rubric: AiRubric;
  config: AiGradingConfig;
  template: Pick<ReportTemplate, "sections">;
  provider: AiCompletionProvider;
  runs?: 1 | 2;
}): Promise<ModelScore[]> {
  const out: ModelScore[] = [];
  const runs: Array<1 | 2> = args.runs === 1 ? [1] : [1, 2];
  for (const run of runs) {
    for (const p of args.packets) {
      const criterion = args.rubric.criteria.find((c) => c.id === p.criterionId)!;
      const input = inputFromPacket(p, args.rubric, args.template);
      let band: number | null = null;
      try {
        const o = await gradeCriterion({
          criterion,
          input,
          injection: scanForInjection(input.fields),
          prefilter: buildPrefilterContext(criterion, args.template),
          provider: args.provider,
          config: args.config,
          versions: { aiRubricVersion: args.rubric.version, promptVersion: args.config.promptVersion },
        });
        band = o.status === "not_graded" ? null : (o.band ?? null);
      } catch (e) {
        if (!(e instanceof ProviderUnavailableError)) throw e;
      }
      out.push({ packetId: p.packetId, run, band });
    }
  }
  return out;
}

export interface CriterionMetrics {
  items: number;
  weightedKappa: ConfidenceInterval;
  withinOneBand: number;
  mae: number;
  signedBias: number;
  humanHumanKappa: number | null;
  alphaHumansAndModel: number | null;
  icc21: number | null;
  flipRate: number | null;
}

export interface GateEvaluation {
  overall: CriterionMetrics;
  perCriterion: Record<string, CriterionMetrics>;
  reports: number;
  failures: string[];
  passed: boolean;
}

function metricsFor(packets: CalibrationPacket[], human: HumanScore[], model: ModelScore[], seed: string): CriterionMetrics {
  const humansBy = new Map<string, HumanScore[]>();
  for (const s of human) humansBy.set(s.packetId, [...(humansBy.get(s.packetId) ?? []), s]);
  const run = (r: 1 | 2) => new Map(model.filter((m) => m.run === r && m.band !== null).map((m) => [m.packetId, m.band as number]));
  const run1 = run(1);
  const run2 = run(2);

  const items = packets
    .map((p) => ({ p, humans: (humansBy.get(p.packetId) ?? []).sort((a, b) => a.graderId.localeCompare(b.graderId)), m: run1.get(p.packetId) }))
    .filter((x): x is { p: CalibrationPacket; humans: HumanScore[]; m: number } => x.humans.length > 0 && x.m !== undefined)
    .map((x) => ({ ...x, h: consensusBand(x.humans.map((s) => s.band)) }));

  const m = items.map((x) => x.m);
  const h = items.map((x) => x.h);
  const twoHuman = items.filter((x) => x.humans.length >= 2);
  const both = packets.filter((p) => run1.has(p.packetId) && run2.has(p.packetId));

  return {
    items: items.length,
    weightedKappa: bootstrapCI(items, (s) => quadraticWeightedKappa(s.map((x) => x.m), s.map((x) => x.h)), { seed, iterations: 1000 }),
    withinOneBand: withinOneBandRate(m, h),
    mae: meanAbsoluteError(m, h),
    signedBias: signedBias(m, h),
    humanHumanKappa: twoHuman.length >= 2 ? quadraticWeightedKappa(twoHuman.map((x) => x.humans[0].band), twoHuman.map((x) => x.humans[1].band)) : null,
    alphaHumansAndModel: krippendorffAlpha(items.map((x) => [...x.humans.map((s) => s.band), x.m]), "ordinal"),
    icc21: twoHuman.length >= 2 ? icc21(twoHuman.map((x) => [x.humans[0].band, x.humans[1].band, x.m])) : null,
    flipRate: both.length ? bandFlipRate(both.map((p) => run1.get(p.packetId)!), both.map((p) => run2.get(p.packetId)!)) : null,
  };
}

export function evaluateGate(args: {
  manifest: CalibrationManifest;
  packets: CalibrationPacket[];
  human: HumanScore[];
  model: ModelScore[];
  fairness: FairnessResult | null;
  injection: InjectionSuiteResult | null;
  config: AiGradingConfig;
  current: CurrentVersions;
  modelId: string;
}): GateEvaluation {
  const g = args.config.gate;
  const overall = metricsFor(args.packets, args.human, args.model, `${args.manifest.id}|all`);
  const perCriterion: Record<string, CriterionMetrics> = {};
  for (const c of [...new Set(args.packets.map((p) => p.criterionId))]) {
    perCriterion[c] = metricsFor(args.packets.filter((p) => p.criterionId === c), args.human, args.model, `${args.manifest.id}|${c}`);
  }
  const reports = new Set(args.packets.map((p) => p.reportRef)).size;

  const f: string[] = [];
  if (args.manifest.synthetic || args.packets.some((p) => p.synthetic)) f.push("calibration set is synthetic (demo only)");
  if (reports < g.minCalibrationReports) f.push(`only ${reports} reports (need ${g.minCalibrationReports})`);
  if (args.manifest.promptVersion !== args.current.promptVersion) f.push("calibration set was built for another prompt version");
  if (args.manifest.aiRubricVersion !== args.current.aiRubricVersion) f.push("calibration set was built for another AI rubric version");
  if (args.manifest.modelId !== args.modelId) f.push("calibration set was graded by another model");
  const k = overall.weightedKappa.estimate;
  if (k === null || k < g.minWeightedKappa) f.push(`weighted kappa ${k?.toFixed(3) ?? "n/a"} < ${g.minWeightedKappa}`);
  if (overall.withinOneBand < g.minWithinOneBand) f.push(`within-one-band ${(overall.withinOneBand * 100).toFixed(1)}% < ${g.minWithinOneBand * 100}%`);
  if (overall.humanHumanKappa === null || overall.humanHumanKappa < g.minHumanHumanKappa) {
    f.push(`human-human kappa ${overall.humanHumanKappa?.toFixed(3) ?? "n/a (needs 2+ graders per report)"} < ${g.minHumanHumanKappa}`);
  }
  if (overall.flipRate === null || overall.flipRate > g.maxTestRetestFlipRate) f.push(`test-retest flip rate ${overall.flipRate ?? "n/a"} > ${g.maxTestRetestFlipRate}`);
  for (const [c, m] of Object.entries(perCriterion)) {
    if (m.weightedKappa.estimate === null || m.weightedKappa.estimate < g.minWeightedKappa) f.push(`${c}: weighted kappa ${m.weightedKappa.estimate?.toFixed(3) ?? "n/a"} < ${g.minWeightedKappa}`);
  }
  if (!args.fairness) f.push("fairness suite not run");
  else if (!args.fairness.passed) f.push(`fairness failed: ${args.fairness.transforms.filter((t) => !t.passed).map((t) => t.transform).join(", ")}`);
  if (!args.injection) f.push("injection suite not run");
  else if (!args.injection.passed) f.push(`injection failed: ${args.injection.elevated} counted elevations, model obeyed ${(args.injection.susceptibilityRate * 100).toFixed(1)}%`);

  return { overall, perCriterion, reports, failures: f, passed: f.length === 0 };
}

export function toGateFile(ev: GateEvaluation, args: { manifest: CalibrationManifest; current: CurrentVersions; modelId: string; thresholdsVersion: string; computedAt: string }): GateFile {
  return {
    gateVersion: 1,
    ...args.current,
    modelId: args.modelId,
    thresholdsVersion: args.thresholdsVersion,
    calibrationSet: {
      id: args.manifest.id,
      hash: args.manifest.hash,
      synthetic: args.manifest.synthetic,
      reports: ev.reports,
      promptVersion: args.manifest.promptVersion,
      modelId: args.manifest.modelId,
      aiRubricVersion: args.manifest.aiRubricVersion,
    },
    results: { overall: ev.overall, perCriterion: ev.perCriterion },
    passed: ev.passed,
    failures: ev.failures,
    computedAt: args.computedAt,
    // Deliberately empty. Live mode stays refused until the owner fills these in by hand.
    signOff: { signedOffBy: "", signedOffAt: "", notes: "" },
  };
}
