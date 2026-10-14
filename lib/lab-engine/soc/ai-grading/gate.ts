/**
 * Release gate. Live mode (AI grades counting toward the total) is refused server-side unless a
 * gate file exists for the exact AI rubric + prompt + grader + model, computed from a
 * non-synthetic calibration set, passing every threshold, and signed off by the owner by hand.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadAiGradingConfig, loadAiRubric, requestedAiGradingMode } from "./config";
import type { AiGradingMode } from "./types";

export const GATE_DIR = "content/soc/ai-grading/gates";

export const gateFileSchema = z.object({
  gateVersion: z.literal(1),
  aiRubricId: z.string(),
  aiRubricVersion: z.string(),
  promptVersion: z.string(),
  graderVersion: z.string(),
  modelId: z.string().min(1),
  thresholdsVersion: z.string(),
  calibrationSet: z.object({
    id: z.string(),
    hash: z.string(),
    synthetic: z.boolean(),
    reports: z.number().int().min(0),
    promptVersion: z.string(),
    modelId: z.string(),
    aiRubricVersion: z.string(),
  }),
  results: z.record(z.string(), z.unknown()),
  passed: z.boolean(),
  failures: z.array(z.string()),
  computedAt: z.string(),
  signOff: z.object({
    signedOffBy: z.string(),
    signedOffAt: z.string(),
    notes: z.string().optional(),
  }),
});
export type GateFile = z.infer<typeof gateFileSchema>;

export interface CurrentVersions {
  aiRubricId: string;
  aiRubricVersion: string;
  promptVersion: string;
  graderVersion: string;
}

export function currentVersions(): CurrentVersions {
  const rubric = loadAiRubric();
  const config = loadAiGradingConfig();
  return {
    aiRubricId: rubric.rubricId,
    aiRubricVersion: rubric.version,
    promptVersion: config.promptVersion,
    graderVersion: config.graderVersion,
  };
}

export function gateFileName(v: CurrentVersions, modelId: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${safe(v.aiRubricId)}@${safe(v.aiRubricVersion)}__${safe(v.promptVersion)}__${safe(v.graderVersion)}__${safe(modelId)}.json`;
}

/** Every reason this gate cannot authorize live grading; empty means valid. */
export function gateProblems(gate: GateFile, v: CurrentVersions, thresholdsVersion: string): string[] {
  const p: string[] = [];
  if (!gate.passed) p.push("gate did not pass its thresholds");
  if (gate.failures.length > 0) p.push(`gate recorded failures: ${gate.failures.join("; ")}`);
  if (gate.calibrationSet.synthetic) p.push("calibration set is synthetic");
  if (!gate.signOff.signedOffBy.trim() || !gate.signOff.signedOffAt.trim() || Number.isNaN(Date.parse(gate.signOff.signedOffAt))) {
    p.push("owner sign-off missing");
  }
  if (gate.aiRubricId !== v.aiRubricId || gate.aiRubricVersion !== v.aiRubricVersion) p.push("AI rubric version changed since calibration");
  if (gate.promptVersion !== v.promptVersion) p.push("prompt version changed since calibration");
  if (gate.graderVersion !== v.graderVersion) p.push("grader version changed since calibration");
  if (gate.thresholdsVersion !== thresholdsVersion) p.push("thresholds changed since calibration");
  const cs = gate.calibrationSet;
  if (cs.promptVersion !== gate.promptVersion || cs.modelId !== gate.modelId || cs.aiRubricVersion !== gate.aiRubricVersion) {
    p.push("calibration set is stale for this prompt/model/rubric");
  }
  return p;
}

export function readGateFiles(dir = GATE_DIR): Array<{ file: string; gate: GateFile | null; parseError?: string }> {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      try {
        return { file, gate: gateFileSchema.parse(JSON.parse(fs.readFileSync(path.join(abs, file), "utf8"))) };
      } catch (e) {
        return { file, gate: null, parseError: e instanceof Error ? e.message : String(e) };
      }
    });
}

/** Model ids with a currently valid gate. Only grades from these models may count in live. */
export function liveAuthorizedModels(dir = GATE_DIR): string[] {
  const v = currentVersions();
  const thresholds = loadAiGradingConfig().gate.thresholdsVersion;
  return readGateFiles(dir)
    .filter((g): g is { file: string; gate: GateFile } => g.gate !== null)
    .filter(({ file, gate }) => file === gateFileName(v, gate.modelId) && gateProblems(gate, v, thresholds).length === 0)
    .map(({ gate }) => gate.modelId);
}

export interface EffectiveMode {
  mode: AiGradingMode;
  requested: AiGradingMode;
  killSwitch: boolean;
  /** Present when live was requested but refused. */
  liveRefusedReasons?: string[];
  liveModels: string[];
}

export function resolveEffectiveMode(env: NodeJS.ProcessEnv = process.env, gateDir = GATE_DIR): EffectiveMode {
  const { mode, killSwitch } = requestedAiGradingMode(env);
  if (mode !== "live") return { mode, requested: mode, killSwitch, liveModels: [] };

  const liveModels = liveAuthorizedModels(gateDir);
  if (liveModels.length > 0) return { mode: "live", requested: "live", killSwitch, liveModels };

  const v = currentVersions();
  const thresholds = loadAiGradingConfig().gate.thresholdsVersion;
  const files = readGateFiles(gateDir);
  const reasons =
    files.length === 0
      ? ["no gate file exists"]
      : files.flatMap(({ file, gate, parseError }) =>
          gate ? gateProblems(gate, v, thresholds).map((r) => `${file}: ${r}`) : [`${file}: unreadable (${parseError})`],
        );
  return { mode: "preview", requested: "live", killSwitch, liveRefusedReasons: reasons, liveModels: [] };
}
