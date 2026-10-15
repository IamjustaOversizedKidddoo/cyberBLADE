/**
 * Runtime schema for learner-submitted incident reports (L1-A-12). TypeScript types are not checks:
 * server actions receive whatever the browser sends. Unknown keys are dropped, every string and
 * list is capped, and only known template ids are accepted (a new id used to allow re-grading one
 * attempt any number of times).
 */
import { z } from "zod";
import { SOC_DISPOSITIONS, SOC_SEVERITIES } from "../schema";

export const REPORT_TEMPLATE_IDS = ["incident-report-l1"] as const;
export const reportTemplateIdSchema = z.enum(REPORT_TEMPLATE_IDS);

const short = z.string().max(200);
const medium = z.string().max(1000);
const long = z.string().max(6000);
const ref = z.string().max(120);

const IOC_TYPES = ["ip", "domain", "url", "hash", "email", "file_path", "user", "host", "process", "other"] as const;
const IOC_ROLES = ["delivery", "c2", "victim", "staging", "persistence", "lateral_movement", "exfiltration", "unrelated_benign", "other"] as const;

export const socReportDataSchema = z.object({
  header: z.object({
    title: short,
    caseId: short.optional(),
    analystHandle: short,
    createdAt: z.string().max(64),
    classification: short,
  }),
  executiveSummary: long,
  verdict: z.object({
    disposition: z.enum(SOC_DISPOSITIONS),
    severity: z.enum(SOC_SEVERITIES),
    confidence: z.enum(["low", "medium", "high"]),
    justification: long,
  }),
  scope: z.object({
    affectedAssets: z.array(short).max(50),
    affectedUsers: z.array(short).max(50),
    systemsAtRisk: medium.optional(),
    businessImpact: medium.optional(),
  }),
  timeline: z
    .array(
      z.object({
        id: ref,
        timestampUtc: z.string().max(64),
        rawTimestamp: z.string().max(64),
        timezone: z.string().max(64),
        description: medium,
        dataOrigin: short,
        evidenceRef: ref.optional(),
      }),
    )
    .max(50),
  iocs: z
    .array(
      z.object({
        id: ref,
        type: z.enum(IOC_TYPES),
        value: z.string().max(512),
        defangedValue: z.string().max(512).optional(),
        role: z.enum(IOC_ROLES),
        evidenceRefs: z.array(ref).max(20),
        notes: medium.optional(),
      }),
    )
    .max(50),
  attackNarrative: long,
  techniques: z.array(z.object({ techniqueId: z.string().max(32), techniqueName: short, tactic: short, rationale: medium.optional() })).max(30),
  actions: z.array(z.object({ actionId: z.string().max(64), actionName: short, category: short, priority: z.number().int().min(0).max(10), rationale: medium })).max(30),
  escalation: z.object({
    requiresEscalation: z.boolean(),
    targetTeam: short.optional(),
    urgency: z.enum(["routine", "priority", "immediate"]).optional(),
    handoffSummary: long,
  }),
  lessonsLearned: long.optional(),
  evidenceAppendix: z
    .array(z.object({ id: ref, type: z.enum(["alert", "event", "query", "lookup"]), targetId: ref, label: short, timestamp: z.string().max(64), annotation: medium.optional() }))
    .max(50)
    .optional(),
});
