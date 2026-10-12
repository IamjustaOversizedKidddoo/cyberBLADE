import { z } from "zod";

export const SOC_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export type SocSeverity = (typeof SOC_SEVERITIES)[number];

export const SOC_DISPOSITIONS = [
  "true_positive",
  "false_positive",
  "benign_true_positive",
  "duplicate",
  "needs_more_info",
] as const;
export type SocDisposition = (typeof SOC_DISPOSITIONS)[number];

export const SOC_ALERT_SOURCES = [
  "EDR",
  "Network IDS",
  "Email Gateway",
  "Firewall",
  "Authentication",
  "Cloud Audit",
] as const;
export type SocAlertSource = (typeof SOC_ALERT_SOURCES)[number];

export const SOC_ESCALATION_TIERS = ["tier2", "incident_response", "threat_intel", "engineering"] as const;
export type SocEscalationTier = (typeof SOC_ESCALATION_TIERS)[number];

export const assetCriticalitySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const socSeveritySchema = z.enum(SOC_SEVERITIES);
export const socDispositionSchema = z.enum(SOC_DISPOSITIONS);
export const socAlertSourceSchema = z.enum(SOC_ALERT_SOURCES);
export const socEscalationTierSchema = z.enum(SOC_ESCALATION_TIERS);

export const socAssetSchema = z.object({
  id: z.string().min(1),
  hostname: z.string().min(1),
  ip: z.string().min(1),
  role: z.string().min(1),
  os: z.string().min(1),
  criticality: assetCriticalitySchema,
  owner: z.string().min(1),
  zone: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type SocAsset = z.infer<typeof socAssetSchema>;

export const socUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().min(1),
  displayName: z.string().min(1),
  department: z.string().min(1),
  role: z.string().min(1),
  riskScore: z.number().min(0).max(100).optional(),
});
export type SocUser = z.infer<typeof socUserSchema>;

export const socNetworkZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cidr: z.string().min(1),
  description: z.string().min(1),
});
export type SocNetworkZone = z.infer<typeof socNetworkZoneSchema>;

export const socRawEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  source: z.string().min(1),
  action: z.string().min(1),
  message: z.string().min(1),
  raw: z.string().optional(),
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type SocRawEvent = z.infer<typeof socRawEventSchema>;

export const acceptableAlternativeSchema = z.object({
  disposition: socDispositionSchema,
  severity: socSeveritySchema.optional(),
  reason: z.string().min(1),
  scoreMultiplier: z.number().min(0).max(1).default(1.0),
});
export type AcceptableAlternative = z.infer<typeof acceptableAlternativeSchema>;

export const socAlertGroundTruthSchema = z.object({
  kind: z.enum(["true_positive", "false_positive", "benign_true_positive", "duplicate", "informational"]),
  correctDisposition: socDispositionSchema,
  correctSeverity: socSeveritySchema,
  correctEscalation: z.boolean(),
  targetTier: socEscalationTierSchema.optional(),
  incidentId: z.string().optional(),
  acceptableAlternatives: z.array(acceptableAlternativeSchema).default([]),
  debrief: z.string().min(1),
});
export type SocAlertGroundTruth = z.infer<typeof socAlertGroundTruthSchema>;

export const socAlertIocSchema = z.object({
  type: z.enum(["ip", "domain", "hash", "url", "email"]),
  value: z.string().min(1),
});
export type SocAlertIoc = z.infer<typeof socAlertIocSchema>;

/** Base alert fields visible to learners and server */
export const socAlertClientSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  source: socAlertSourceSchema,
  ruleName: z.string().min(1),
  severity: socSeveritySchema,
  summary: z.string().min(1),
  relatedAsset: z.string().optional(),
  relatedUser: z.string().optional(),
  relatedIocs: z.array(socAlertIocSchema).default([]),
  linkedRawEvents: z.array(z.string()).default([]),
  rawFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type SocAlertClient = z.infer<typeof socAlertClientSchema>;

/** Full server-side alert including ground truth */
export const socAlertSchema = socAlertClientSchema.extend({
  groundTruth: socAlertGroundTruthSchema,
});
export type SocAlert = z.infer<typeof socAlertSchema>;

export const socIncidentGroundTruthSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  timeline: z.array(z.string()),
  truePositiveAlertIds: z.array(z.string()).min(1),
  rootCause: z.string().min(1),
  mitre: z.array(z.string()).default([]),
});
export type SocIncidentGroundTruth = z.infer<typeof socIncidentGroundTruthSchema>;

export const socScenarioGroundTruthSchema = z.object({
  incidents: z.array(socIncidentGroundTruthSchema).min(1),
  overallDebrief: z.string().min(1),
});
export type SocScenarioGroundTruth = z.infer<typeof socScenarioGroundTruthSchema>;

/** Seams for future prompts (typed hooks) */
export const socEnrichmentSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["whois", "reputation", "sandbox", "email_headers"]),
  indicator: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});
export type SocEnrichmentSource = z.infer<typeof socEnrichmentSourceSchema>;

export const socEvidenceViewSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["timeline", "pcap", "process_tree"]),
});
export type SocEvidenceView = z.infer<typeof socEvidenceViewSchema>;

export const socReportRubricSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      weight: z.number().positive(),
    }),
  ),
});
export type SocReportRubric = z.infer<typeof socReportRubricSchema>;

/** Full Server-side scenario definition */
export const socScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string().min(1),
  level: z.enum(["L1", "L2", "L3"]),
  estimatedMinutes: z.number().int().min(5).max(480),
  skillsTested: z.array(z.string()).min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  briefing: z.string().min(1),
  seed: z.string().optional(),
  variantOf: z.string().optional(),
  generatorConfig: z.record(z.string(), z.unknown()).optional(),

  environment: z.object({
    assets: z.array(socAssetSchema).min(1),
    users: z.array(socUserSchema).min(1),
    networkZones: z.array(socNetworkZoneSchema).min(1),
  }),

  rawEvents: z.array(socRawEventSchema).default([]),
  alerts: z.array(socAlertSchema).min(5),
  groundTruth: socScenarioGroundTruthSchema,

  // Seams
  enrichmentSources: z.array(socEnrichmentSourceSchema).default([]),
  queryDataset: z
    .object({
      name: z.string().min(1),
      eventCount: z.number().int().nonnegative(),
    })
    .optional(),
  evidenceViews: z.array(socEvidenceViewSchema).default([]),
  reportRubric: socReportRubricSchema.optional(),
  instantFeedback: z.boolean().default(false),
  examMode: z.boolean().default(false),
});
export type SocScenario = z.infer<typeof socScenarioSchema>;

/** Client-facing scenario projection (100% stripped of ground truth) */
export type SocScenarioClient = {
  id: string;
  version: number;
  title: string;
  level: "L1" | "L2" | "L3";
  estimatedMinutes: number;
  skillsTested: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  briefing: string;
  environment: {
    assets: SocAsset[];
    users: SocUser[];
    networkZones: SocNetworkZone[];
  };
  rawEvents: SocRawEvent[];
  alerts: SocAlertClient[];
  evidenceViews: SocEvidenceView[];
  instantFeedback: boolean;
  examMode: boolean;
};

/**
 * Pure projection function: Strips any ground-truth fields from a SocScenario,
 * guaranteeing zero answer leakage to the browser.
 */
export function toClientView(scenario: SocScenario): SocScenarioClient {
  return {
    id: scenario.id,
    version: scenario.version,
    title: scenario.title,
    level: scenario.level,
    estimatedMinutes: scenario.estimatedMinutes,
    skillsTested: [...scenario.skillsTested],
    difficulty: scenario.difficulty,
    briefing: scenario.briefing,
    environment: {
      assets: (scenario.environment?.assets ?? []).map((a) => ({ ...a, tags: [...(a.tags ?? [])] })),
      users: (scenario.environment?.users ?? []).map((u) => ({ ...u })),
      networkZones: (scenario.environment?.networkZones ?? []).map((z) => ({ ...z })),
    },
    rawEvents: (scenario.rawEvents ?? []).map((e) => ({
      ...e,
      fields: { ...(e.fields ?? {}) },
    })),
    alerts: (scenario.alerts ?? []).map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      source: a.source,
      ruleName: a.ruleName,
      severity: a.severity,
      summary: a.summary,
      relatedAsset: a.relatedAsset,
      relatedUser: a.relatedUser,
      relatedIocs: (a.relatedIocs ?? []).map((ioc) => ({ ...ioc })),
      linkedRawEvents: [...(a.linkedRawEvents ?? [])],
      rawFields: { ...(a.rawFields ?? {}) },
    })),
    evidenceViews: (scenario.evidenceViews ?? []).map((ev) => ({ ...ev })),
    instantFeedback: !!scenario.instantFeedback,
    examMode: !!scenario.examMode,
  };
}
