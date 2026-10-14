import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { AI_CRITERION_IDS, AI_GRADING_MODES, AI_REPORT_FIELDS, type AiGradingMode, type AiRubric } from "./types";

const CONTENT_DIR = "content/soc/ai-grading";

const configSchema = z.object({
  version: z.string(),
  defaultMode: z.enum(AI_GRADING_MODES),
  graderVersion: z.string(),
  promptVersion: z.string().regex(/^[a-z0-9.]+$/),
  sampling: z.object({
    samples: z.number().int().min(1).max(7),
    temperature: z.number().min(0).max(1),
    maxOutputTokens: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    minValidSamples: z.number().int().min(1),
    disagreementSpreadLowConfidence: z.number().int().min(1).max(3),
  }),
  weights: z.object({ perCriterionCap: z.number().min(0).max(1), totalCap: z.number().min(0).max(1) }),
  prefilter: z.object({
    minWordsPerCriterion: z.number().int().min(0),
    maxCharsPerCriterion: z.number().int().positive(),
    copyPasteLineRatio: z.number().min(0).max(1),
    templateSimilarity: z.number().min(0).max(1),
  }),
  sanity: z.object({ minWordsForHighBand: z.number().int().min(0) }),
  budgets: z.object({
    perUserDailySubmissions: z.number().int().min(0),
    perSubmissionTokenCap: z.number().int().positive(),
    globalDailyTokenCeiling: z.number().int().positive(),
  }),
  review: z.object({ randomSampleRate: z.number().min(0).max(1) }),
  jobs: z.object({
    maxAttempts: z.number().int().min(1),
    baseBackoffMs: z.number().int().positive(),
    leaseMs: z.number().int().positive(),
  }),
  drift: z.object({ maxChangedRate: z.number().min(0).max(1), maxMeanShift: z.number().min(0) }),
  gate: z.object({
    thresholdsVersion: z.string(),
    minWeightedKappa: z.number(),
    minWithinOneBand: z.number(),
    minHumanHumanKappa: z.number(),
    minCalibrationReports: z.number().int(),
    maxTestRetestFlipRate: z.number(),
    maxFairnessBandShift: z.number().int(),
    fairnessMaxMeanSignedShift: z.number(),
    fairnessMaxShiftRate: z.number(),
    injectionMaxCountedElevation: z.number().int(),
    injectionMaxSusceptibilityRate: z.number().min(0).max(1),
  }),
});
export type AiGradingConfig = z.infer<typeof configSchema>;

const bandSchema = z.object({
  band: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string().min(1),
  descriptor: z.string().min(1),
  anchors: z.tuple([z.string().min(1), z.string().min(1)]),
});

const rubricSchema = z.object({
  rubricId: z.string(),
  version: z.string(),
  appliesTo: z.object({ rubricId: z.string(), rubricVersion: z.string() }),
  criteria: z
    .array(
      z.object({
        id: z.enum(AI_CRITERION_IDS),
        title: z.string(),
        weight: z.number().min(0),
        fields: z.array(z.enum(AI_REPORT_FIELDS)).min(1),
        question: z.string(),
        bands: z.tuple([bandSchema, bandSchema, bandSchema, bandSchema]),
      }),
    )
    .length(AI_CRITERION_IDS.length),
});

let configCache: AiGradingConfig | null = null;
let rubricCache: AiRubric | null = null;

function readYaml(file: string): unknown {
  return parseYaml(fs.readFileSync(path.resolve(CONTENT_DIR, file), "utf8"));
}

export function loadAiGradingConfig(): AiGradingConfig {
  if (!configCache) configCache = configSchema.parse(readYaml("config.yaml"));
  return configCache;
}

export function loadAiRubric(): AiRubric {
  if (rubricCache) return rubricCache;
  const parsed = rubricSchema.parse(readYaml("rubric.yaml"));
  const config = loadAiGradingConfig();
  let total = 0;
  for (const [i, c] of parsed.criteria.entries()) {
    if (c.weight > config.weights.perCriterionCap) {
      throw new Error(`AI criterion ${c.id} weight ${c.weight} exceeds per-criterion cap`);
    }
    c.bands.forEach((b, idx) => {
      if (b.band !== idx) throw new Error(`AI criterion ${c.id}: bands must be ordered 0..3`);
    });
    total += c.weight;
    if (parsed.criteria.findIndex((x) => x.id === c.id) !== i) throw new Error(`duplicate AI criterion ${c.id}`);
  }
  if (total > config.weights.totalCap + 1e-9) throw new Error(`AI rubric total weight ${total} exceeds cap`);
  rubricCache = parsed as AiRubric;
  return rubricCache;
}

export function loadPromptTemplate(kind: "system" | "user", promptVersion: string): string {
  if (!/^[a-z0-9.]+$/.test(promptVersion)) throw new Error("invalid prompt version");
  return fs.readFileSync(path.resolve(CONTENT_DIR, "prompts", `${kind}.${promptVersion}.md`), "utf8");
}

/** Kill switch wins over everything; otherwise env mode, otherwise config default. Live is checked by the gate later. */
export function requestedAiGradingMode(env: NodeJS.ProcessEnv = process.env): {
  mode: AiGradingMode;
  killSwitch: boolean;
} {
  const kill = env.SOC_AI_GRADING_KILL_SWITCH;
  if (kill === "1" || kill === "true") return { mode: "off", killSwitch: true };
  const raw = env.SOC_AI_GRADING_MODE;
  const mode = (AI_GRADING_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as AiGradingMode)
    : loadAiGradingConfig().defaultMode;
  return { mode, killSwitch: false };
}

/** Test seam: drop cached config/rubric after a test writes fixtures. */
export function resetAiGradingConfigCache(): void {
  configCache = null;
  rubricCache = null;
}
