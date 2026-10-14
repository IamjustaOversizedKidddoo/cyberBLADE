/**
 * Calibration packets: what a human grader sees for one (report, criterion). Built through the
 * same information boundary as the model, so graders and model judge identical text.
 * Real learner text is exported ONLY for learners with active opt-in consent.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ReportTemplate } from "../../reports/types";
import { guidanceForTemplate } from "../boundary";
import { criterionText } from "../prefilter";
import { FIELD_LABELS } from "../prompt";
import type { AiCriterionId, AiGradingInput, AiRubric } from "../types";
import { AI_CRITERION_IDS } from "../types";

export const CALIBRATION_CONSENT_VERSION = "c1";

export const packetSchema = z.object({
  packetId: z.string().regex(/^[a-f0-9]{16}$/),
  /** Anonymous id of the source report (several packets share one report). */
  reportRef: z.string().regex(/^[a-f0-9]{12}$/),
  criterionId: z.enum(AI_CRITERION_IDS),
  aiRubricVersion: z.string(),
  scenarioFacts: z.string(),
  sections: z.array(z.object({ label: z.string(), text: z.string() })),
  synthetic: z.boolean(),
});
export type CalibrationPacket = z.infer<typeof packetSchema>;

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,64}$/),
  synthetic: z.boolean(),
  aiRubricVersion: z.string(),
  promptVersion: z.string(),
  modelId: z.string(),
  createdAt: z.string(),
  packetCount: z.number().int(),
  reportCount: z.number().int(),
  hash: z.string(),
  consentVersion: z.string(),
});
export type CalibrationManifest = z.infer<typeof manifestSchema>;

/** Pseudonymous grader ids only: no emails, names with spaces, or long free text. */
export const GRADER_ID = /^[A-Za-z0-9_-]{2,40}$/;

export const humanScoreSchema = z.object({
  packetId: z.string().regex(/^[a-f0-9]{16}$/),
  graderId: z.string().regex(GRADER_ID, "grader id must be a pseudonym (letters, digits, _ or -)"),
  band: z.number().int().min(0).max(3),
});
export type HumanScore = z.infer<typeof humanScoreSchema>;

export const modelScoreSchema = z.object({
  packetId: z.string().regex(/^[a-f0-9]{16}$/),
  run: z.union([z.literal(1), z.literal(2)]),
  band: z.number().int().min(0).max(3).nullable(),
});
export type ModelScore = z.infer<typeof modelScoreSchema>;

const h = (s: string) => createHash("sha256").update(s).digest("hex");

export function newExportSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Packets for one prepared submission. `sourceId` never leaves this function except hashed with a secret salt. */
export function packetsForSubmission(
  input: AiGradingInput,
  rubric: AiRubric,
  opts: { sourceId: string; salt: string; synthetic: boolean },
): CalibrationPacket[] {
  const reportRef = h(`${opts.salt}|report|${opts.sourceId}`).slice(0, 12);
  return rubric.criteria
    .filter((c) => criterionText(input, c.fields).trim())
    .map((c) => ({
      packetId: h(`${opts.salt}|${opts.sourceId}|${c.id}`).slice(0, 16),
      reportRef,
      criterionId: c.id as AiCriterionId,
      aiRubricVersion: rubric.version,
      scenarioFacts: input.scenarioFacts,
      sections: c.fields.map((f) => ({ label: FIELD_LABELS[f], text: input.fields[f] ?? "" })).filter((s) => s.text.trim()),
      synthetic: opts.synthetic,
    }));
}

/** Rebuild the AI grading input for a packet (graders and model see the same text). */
export function inputFromPacket(p: CalibrationPacket, rubric: AiRubric, template: Pick<ReportTemplate, "sections">): AiGradingInput {
  const crit = rubric.criteria.find((c) => c.id === p.criterionId);
  if (!crit) throw new Error(`unknown criterion ${p.criterionId}`);
  const fields: AiGradingInput["fields"] = {};
  for (const f of crit.fields) fields[f] = p.sections.find((s) => s.label === FIELD_LABELS[f])?.text ?? "";
  return { fields, scenarioFacts: p.scenarioFacts, templateGuidance: guidanceForTemplate(template) };
}

export function hashPackets(packets: CalibrationPacket[]): string {
  return h(JSON.stringify([...packets].sort((a, b) => a.packetId.localeCompare(b.packetId))));
}

/** CSV with header `packetId,graderId,band`. Rejects anything that is not a pseudonymous id. */
export function parseHumanScoresCsv(csv: string): HumanScore[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const [header, ...rows] = lines;
  if (header?.replace(/\s/g, "") !== "packetId,graderId,band") throw new Error("expected header: packetId,graderId,band");
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const [packetId, graderId, band] = row.split(",").map((x) => x.trim());
    const parsed = humanScoreSchema.safeParse({ packetId, graderId, band: Number(band) });
    if (!parsed.success) throw new Error(`row ${i + 2}: ${parsed.error.issues.map((x) => x.message).join("; ")}`);
    const key = `${packetId}|${graderId}`;
    if (seen.has(key)) throw new Error(`row ${i + 2}: duplicate score for ${key}`);
    seen.add(key);
    return parsed.data;
  });
}
