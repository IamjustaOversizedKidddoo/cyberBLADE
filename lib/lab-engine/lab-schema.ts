import { z } from "zod";
import { TRACK_IDS } from "@/lib/content/schema";

const objectiveSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  prompt: z.string().min(1),
  check: z.object({
    kind: z.literal("flag"),
    answer_from: z.string().regex(/^generator\.[A-Za-z0-9_]+$/, "answer_from must be generator.<key>"),
    case_sensitive: z.boolean().default(true),
  }),
});

/** lab.yaml (spec §7.2). Only lab types that are built are accepted. */
export const labSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    type: z.enum(["terminal", "packet", "webapp"]),
    track: z.enum(TRACK_IDS),
    rank: z.number().int().min(0).max(5),
    estimated_minutes: z.number().int().min(5).max(240),
    briefing: z.string().min(1),
    dataset: z.object({ generator: z.string().min(1), params: z.record(z.string(), z.unknown()).default({}) }),
    objectives: z.array(objectiveSchema).min(1),
    hints: z.record(z.string(), z.array(z.string().min(1))).default({}),
    xp: z.number().int().positive(),
    mitre: z.array(z.string().regex(/^T\d{4}(\.\d{3})?$/)).default([]),
    challenge: z
      .object({
        rank: z.number().int().min(0).max(5),
        time_limit_minutes: z.number().int().positive(),
        cooldown_minutes: z.number().int().min(0),
      })
      .optional(),
  })
  .refine((lab) => new Set(lab.objectives.map((o) => o.id)).size === lab.objectives.length, "objective ids must be unique")
  .refine(
    (lab) => Object.keys(lab.hints).every((key) => lab.objectives.some((o) => o.id === key)),
    "every hints key must be an objective id",
  );

export type Lab = z.infer<typeof labSchema>;
export type LoadedLab = Lab & { briefingText: string };
