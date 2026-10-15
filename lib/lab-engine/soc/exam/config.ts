/**
 * Loads content/soc/exams/config.yaml (provisional exam formats) and readiness.yaml.
 * Node-only; used by the exam service and the content gate.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { SOC_EXAM_FORMATS, type SocExamFormat } from "./types";

const formatSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(600),
  variants: z.array(z.string().regex(/^(shift-|soc-f-)[a-z0-9-]+$/)).optional(),
  itemCount: z.number().int().min(1).max(100).optional(),
  budgets: z.object({ queries: z.number().int().min(0).optional(), lookups: z.number().int().min(0).optional(), questionAnswers: z.number().int().min(0).optional() }),
  sla: z.object({ targetSecondsPerAlert: z.number().positive(), firstContainmentWithinMinutes: z.number().positive() }).optional(),
  cooldownMinutes: z.number().int().min(0),
  maxAttempts: z.object({ count: z.number().int().min(1), windowDays: z.number().int().min(1) }),
  xp: z.number().int().min(0),
  countsForReadiness: z.boolean(),
  weights: z.record(z.string(), z.number().min(0).max(1)),
});

export const examConfigSchema = z
  .object({
    version: z.number().int(),
    provisional: z.boolean(),
    formats: z.object(Object.fromEntries(SOC_EXAM_FORMATS.map((f) => [f, formatSchema])) as Record<SocExamFormat, typeof formatSchema>),
  })
  .refine((c) => SOC_EXAM_FORMATS.every((f) => Math.abs(Object.values(c.formats[f].weights).reduce((a, b) => a + b, 0) - 1) < 1e-9), "weights must sum to 1")
  .refine((c) => SOC_EXAM_FORMATS.every((f) => (f === "knowledge" ? !!c.formats[f].itemCount : (c.formats[f].variants?.length ?? 0) > 0)), "scenario formats need variants; knowledge needs itemCount");

export type SocExamConfig = z.infer<typeof examConfigSchema>;
export type SocExamFormatConfig = SocExamConfig["formats"][SocExamFormat];

const ROOT = "content/soc/exams";

let cached: SocExamConfig | null = null;
export function loadExamConfig(root = ROOT): SocExamConfig {
  if (root === ROOT && cached) return cached;
  const c = examConfigSchema.parse(parseYaml(fs.readFileSync(path.join(root, "config.yaml"), "utf8")));
  if (root === ROOT) cached = c;
  return c;
}

export const readinessConfigSchema = z.object({
  version: z.number().int(),
  provisional: z.literal(true),
  windowAttempts: z.number().int().min(2),
  minFormats: z.number().int().min(1),
  minVariants: z.number().int().min(1),
  ready: z.object({ overall: z.number().min(0).max(100), skillFloor: z.number().min(0).max(100), reportFloor: z.number().min(0).max(100) }),
  close: z.object({ overall: z.number().min(0).max(100), skillFloor: z.number().min(0).max(100), reportFloor: z.number().min(0).max(100) }),
  requireWithinTime: z.boolean(),
  requireNoIntegrityFlags: z.boolean(),
});
export type ReadinessConfig = z.infer<typeof readinessConfigSchema>;

export function loadReadinessConfig(root = ROOT): ReadinessConfig {
  return readinessConfigSchema.parse(parseYaml(fs.readFileSync(path.join(root, "readiness.yaml"), "utf8")));
}
