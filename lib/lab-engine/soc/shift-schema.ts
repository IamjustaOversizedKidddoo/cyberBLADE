import { z } from "zod";
import { difficultyLevelSchema } from "./family-schema";

export const shiftWindowSchema = z.enum(["day_shift", "night_shift", "weekend_shift"]);
export type ShiftWindow = z.infer<typeof shiftWindowSchema>;

export const shiftIncidentSelectionSchema = z.object({
  familyId: z.string().min(1),
  incidentTemplateId: z.string().optional(),
  stageOffsetMinutes: z.number().optional(),
  linkToPreviousVictim: z.boolean().default(false),
});
export type ShiftIncidentSelection = z.infer<typeof shiftIncidentSelectionSchema>;

export const shiftNoiseMixSchema = z.object({
  alertFatigueRatio: z.number().min(0).max(1).default(0.5),
  includeFamilyBenign: z.boolean().default(true),
  extraNoiseCount: z.number().int().nonnegative().default(20),
});
export type ShiftNoiseMix = z.infer<typeof shiftNoiseMixSchema>;

export const shiftTelemetryGapsSchema = z.object({
  count: z.number().int().nonnegative().default(0),
  hideAlertProbability: z.number().min(0).max(1).default(0.2),
});
export type ShiftTelemetryGaps = z.infer<typeof shiftTelemetryGapsSchema>;

export const shiftDebriefSchema = z.object({
  briefingTemplate: z.string().min(1),
  guidanceTemplate: z.string().min(1),
});
export type ShiftDebrief = z.infer<typeof shiftDebriefSchema>;

export const shiftProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string().min(1),
  level: z.enum(["L1", "L2", "L3"]),
  description: z.string().min(1),
  estimatedMinutes: z.object({
    min: z.number().int().min(10),
    max: z.number().int().max(480),
  }),
  difficulty: difficultyLevelSchema,
  shiftWindow: shiftWindowSchema,
  targetAlertCount: z.object({
    min: z.number().int().min(50),
    max: z.number().int().max(300),
  }),
  organizationArchetypes: z.array(z.string()).min(1),
  incidentSelections: z.array(shiftIncidentSelectionSchema).min(2).max(5),
  skillsTested: z.array(z.string()).default([]),
  noiseMix: shiftNoiseMixSchema,
  telemetryGaps: shiftTelemetryGapsSchema,
  debrief: shiftDebriefSchema,
});
export type ShiftProfile = z.infer<typeof shiftProfileSchema>;
