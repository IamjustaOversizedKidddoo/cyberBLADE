/**
 * Extended-time accommodation (admin only, default off). Pure validation + audit line; the CLI
 * (scripts/soc-exam-accommodation.mts) writes the record and appends the audit line. A multiplier
 * applies to exams started after it is set; running exams keep their stored deadline.
 */
import { z } from "zod";
import type { SocExamAccommodation } from "./types";

export const accommodationInputSchema = z.object({
  userId: z.string().min(1).max(128),
  // Owner decision 2026-10-16 (docs/ops/decisions.md): at most x2 (the database CHECK allows up to
  // x3). 1 switches the accommodation off.
  multiplier: z.number().min(1).max(2).refine((m) => Math.round(m * 100) === m * 100, "use at most two decimals"),
  reason: z.string().trim().min(5).max(200),
  setBy: z.string().trim().min(2).max(64),
});

export function buildAccommodation(raw: unknown, now: Date): { record: SocExamAccommodation; audit: string } {
  const input = accommodationInputSchema.parse(raw);
  const record: SocExamAccommodation = { ...input, setAt: now.toISOString() };
  const audit = JSON.stringify({ at: record.setAt, action: input.multiplier === 1 ? "accommodation_off" : "accommodation_set", userId: input.userId, multiplier: input.multiplier, setBy: input.setBy, reason: input.reason });
  return { record, audit };
}
