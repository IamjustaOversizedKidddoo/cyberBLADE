/**
 * Drift monitoring: re-grade a frozen canary set and compare with a recorded baseline.
 * Providers can change a model behind the same name; this catches the change.
 */
import { z } from "zod";
import type { ModelScore } from "./packets";

export const driftBaselineSchema = z.object({
  modelId: z.string(),
  promptVersion: z.string(),
  aiRubricVersion: z.string(),
  canarySetHash: z.string(),
  recordedAt: z.string(),
  bands: z.record(z.string(), z.number().int().min(0).max(3).nullable()),
});
export type DriftBaseline = z.infer<typeof driftBaselineSchema>;

export interface DriftReport {
  compared: number;
  changed: number;
  changedRate: number;
  meanShift: number;
  newlyNotGraded: number;
  versionMismatch: string[];
  alert: boolean;
  reasons: string[];
}

export function baselineFrom(scores: ModelScore[], meta: Omit<DriftBaseline, "bands">): DriftBaseline {
  return { ...meta, bands: Object.fromEntries(scores.filter((s) => s.run === 1).map((s) => [s.packetId, s.band])) };
}

export function compareDrift(
  baseline: DriftBaseline,
  current: { scores: ModelScore[]; modelId: string; promptVersion: string; aiRubricVersion: string; canarySetHash: string },
  limits: { maxChangedRate: number; maxMeanShift: number },
): DriftReport {
  const versionMismatch: string[] = [];
  if (baseline.modelId !== current.modelId) versionMismatch.push("model id differs from baseline");
  if (baseline.promptVersion !== current.promptVersion) versionMismatch.push("prompt version differs from baseline");
  if (baseline.aiRubricVersion !== current.aiRubricVersion) versionMismatch.push("AI rubric version differs from baseline");
  if (baseline.canarySetHash !== current.canarySetHash) versionMismatch.push("canary set changed");

  const now = new Map(current.scores.filter((s) => s.run === 1).map((s) => [s.packetId, s.band]));
  let compared = 0;
  let changed = 0;
  let shiftSum = 0;
  let shiftN = 0;
  let newlyNotGraded = 0;
  for (const [id, before] of Object.entries(baseline.bands)) {
    if (!now.has(id)) continue;
    const after = now.get(id) ?? null;
    compared++;
    if (before !== after) changed++;
    if (before !== null && after === null) newlyNotGraded++;
    if (before !== null && after !== null) {
      shiftSum += after - before;
      shiftN++;
    }
  }
  const changedRate = changed / Math.max(1, compared);
  const meanShift = shiftN ? shiftSum / shiftN : 0;
  const reasons = [...versionMismatch];
  if (compared === 0) reasons.push("no canary overlaps the baseline");
  if (changedRate > limits.maxChangedRate) reasons.push(`${(changedRate * 100).toFixed(1)}% of canary bands changed`);
  if (Math.abs(meanShift) > limits.maxMeanShift) reasons.push(`mean band shift ${meanShift.toFixed(2)}`);
  if (newlyNotGraded > 0) reasons.push(`${newlyNotGraded} canaries are no longer graded`);
  return { compared, changed, changedRate, meanShift, newlyNotGraded, versionMismatch, alert: reasons.length > 0, reasons };
}
