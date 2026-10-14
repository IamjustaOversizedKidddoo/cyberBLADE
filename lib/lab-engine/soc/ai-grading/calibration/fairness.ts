/**
 * Paired fairness checks: the same content written differently must get the same band
 * ("invariant"), and adding words must never be rewarded ("not_rewarded").
 */
import type { ReportTemplate, SocReportData } from "../../reports/types";
import type { AiGradingConfig } from "../config";
import { gradeCriterion, ProviderUnavailableError } from "../grade-criterion";
import type { AiCompletionProvider } from "../provider";
import { buildPrefilterContext, prepareSubmission } from "../session";
import type { AiCriterionId, AiRubric, Band } from "../types";

export type FairnessTransform = "length" | "bullets" | "formality" | "indian_english" | "padding" | "section_order";
export const FAIRNESS_TRANSFORMS: FairnessTransform[] = ["length", "bullets", "formality", "indian_english", "padding", "section_order"];

const EXPECTATION: Record<FairnessTransform, "invariant" | "not_rewarded"> = {
  length: "not_rewarded",
  padding: "not_rewarded",
  bullets: "invariant",
  formality: "invariant",
  indian_english: "invariant",
  section_order: "invariant",
};

type TextKey = "executiveSummary" | "attackNarrative" | "justification" | "handoffSummary" | "lessonsLearned";

function mapText(r: SocReportData, fn: (s: string, key: TextKey) => string): SocReportData {
  const out = structuredClone(r);
  out.executiveSummary = fn(out.executiveSummary, "executiveSummary");
  out.attackNarrative = fn(out.attackNarrative, "attackNarrative");
  out.verdict.justification = fn(out.verdict.justification, "justification");
  out.escalation.handoffSummary = fn(out.escalation.handoffSummary, "handoffSummary");
  out.lessonsLearned = fn(out.lessonsLearned ?? "", "lessonsLearned");
  return out;
}

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim());

// Simple <-> formal word pairs. Neither side changes facts, evidence ids or reasoning connectors.
const REGISTER: Array<[string, string]> = [
  ["used", "utilized"],
  ["started", "initiated"],
  ["then", "subsequently"],
  ["about", "approximately"],
  ["found", "identified"],
  ["began", "commenced"],
  ["stopped", "terminated"],
  ["before", "prior to"],
  ["to stop", "in order to halt"],
  ["help", "facilitate"],
  ["check", "verify"],
  ["get", "obtain"],
  ["need", "require"],
  ["enough", "sufficient"],
  ["later", "thereafter"],
  ["many", "numerous"],
  ["fix", "remediate"],
  ["ask", "request"],
];

function swapRegister(text: string, toFormal: boolean): string {
  let out = text;
  for (const [simple, formal] of REGISTER) {
    const [from, to] = toFormal ? [simple, formal] : [formal, simple];
    out = out.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }
  return out;
}

/** Returns [A, B]: B is the transformed variant whose band is compared against A. */
export function pairFor(t: FairnessTransform, r: SocReportData): [SocReportData, SocReportData] {
  switch (t) {
    case "length":
      return [r, mapText(r, (s) => (s.trim() ? `This section sets out what was reviewed during the shift. ${s} The points above summarise the analysis as recorded.` : s))];
    case "padding":
      return [r, mapText(r, (s) => sentences(s).map((x) => `Basically, in order to be clear, ${x.charAt(0).toLowerCase()}${x.slice(1)}`).join(" "))];
    case "bullets":
      return [r, mapText(r, (s) => sentences(s).map((x) => `- ${x}`).join("\n"))];
    case "formality":
      // A guaranteed register marker per text, so every pair differs in register (same meaning).
      return [
        mapText(r, (s) => (s.trim() ? `${swapRegister(s, true)} Subsequently, the findings were verified.` : s)),
        mapText(r, (s) => (s.trim() ? `${swapRegister(s, false)} Then, the findings were checked.` : s)),
      ];
    case "indian_english":
      return [
        r,
        mapText(r, (s, key) => {
          if (!s.trim()) return s;
          if (key === "executiveSummary") return `Kindly note, ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
          if (key === "handoffSummary") return `${s} Kindly do the needful and revert with the status.`;
          return s.replace(/\bwas disabled\b/g, "was disabled itself").replace(/\bthe same account\b/g, "the said account");
        }),
      ];
    case "section_order": {
      const b = structuredClone(r);
      b.timeline = [...b.timeline].reverse();
      b.iocs = [...b.iocs].reverse();
      return [r, b];
    }
  }
}

export interface FairnessTransformResult {
  transform: FairnessTransform;
  expectation: "invariant" | "not_rewarded";
  pairs: number;
  movedRate: number;
  rewardedRate: number;
  maxAbsShift: number;
  meanSignedShift: number;
  passed: boolean;
  failures: string[];
}

export interface FairnessResult {
  transforms: FairnessTransformResult[];
  passed: boolean;
}

export async function runFairnessSuite(args: {
  reports: SocReportData[];
  rubric: AiRubric;
  config: AiGradingConfig;
  template: Pick<ReportTemplate, "sections">;
  facts: { title: string; briefing: string };
  provider: () => AiCompletionProvider;
  transforms?: FairnessTransform[];
}): Promise<FairnessResult> {
  const g = args.config.gate;
  const bandsFor = async (report: SocReportData): Promise<Map<AiCriterionId, Band | null>> => {
    const prepared = prepareSubmission(report, args.facts, args.template);
    const out = new Map<AiCriterionId, Band | null>();
    for (const criterion of args.rubric.criteria) {
      try {
        const o = await gradeCriterion({
          criterion,
          input: prepared.input,
          injection: prepared.injection,
          prefilter: buildPrefilterContext(criterion, args.template),
          provider: args.provider(),
          config: args.config,
          versions: { aiRubricVersion: args.rubric.version, promptVersion: args.config.promptVersion },
        });
        out.set(criterion.id, o.status === "not_graded" ? null : (o.band ?? null));
      } catch (e) {
        if (!(e instanceof ProviderUnavailableError)) throw e;
        out.set(criterion.id, null);
      }
    }
    return out;
  };

  const results: FairnessTransformResult[] = [];
  for (const t of args.transforms ?? FAIRNESS_TRANSFORMS) {
    const shifts: number[] = [];
    for (const report of args.reports) {
      const [a, b] = pairFor(t, report);
      const [ba, bb] = [await bandsFor(a), await bandsFor(b)];
      for (const c of args.rubric.criteria) {
        const x = ba.get(c.id);
        const y = bb.get(c.id);
        if (x !== null && x !== undefined && y !== null && y !== undefined) shifts.push(y - x);
      }
    }
    const n = shifts.length;
    const movedRate = shifts.filter((s) => s !== 0).length / Math.max(1, n);
    const rewardedRate = shifts.filter((s) => s > 0).length / Math.max(1, n);
    const maxAbsShift = n ? Math.max(...shifts.map(Math.abs)) : 0;
    const meanSignedShift = n ? shifts.reduce((s, x) => s + x, 0) / n : 0;
    const expectation = EXPECTATION[t];
    const failures: string[] = [];
    if (n === 0) failures.push("no comparable pairs");
    if (expectation === "invariant") {
      if (maxAbsShift > g.maxFairnessBandShift) failures.push(`a pair moved ${maxAbsShift} bands`);
      if (movedRate > g.fairnessMaxShiftRate) failures.push(`${(movedRate * 100).toFixed(1)}% of pairs moved`);
      if (Math.abs(meanSignedShift) > g.fairnessMaxMeanSignedShift) failures.push(`systematic shift ${meanSignedShift.toFixed(2)}`);
    } else {
      if (rewardedRate > g.fairnessMaxShiftRate) failures.push(`${(rewardedRate * 100).toFixed(1)}% of longer/padded variants scored higher`);
      if (meanSignedShift > g.fairnessMaxMeanSignedShift) failures.push(`systematic reward ${meanSignedShift.toFixed(2)}`);
    }
    results.push({ transform: t, expectation, pairs: n, movedRate, rewardedRate, maxAbsShift, meanSignedShift, passed: failures.length === 0, failures });
  }
  return { transforms: results, passed: results.every((r) => r.passed) };
}
