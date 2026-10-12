import { z } from "zod";
import {
  socSeveritySchema,
  socDispositionSchema,
  socAlertSourceSchema,
  socEscalationTierSchema,
  acceptableAlternativeSchema,
} from "./schema";

export const reviewStatusSchema = z.enum(["draft", "practitioner-reviewed", "approved"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const difficultyLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export type DifficultyLevel = z.infer<typeof difficultyLevelSchema>;

export const mitreAttackPhaseSchema = z.enum([
  "reconnaissance",
  "initial_access",
  "execution",
  "persistence",
  "privilege_escalation",
  "defense_evasion",
  "credential_access",
  "discovery",
  "lateral_movement",
  "collection",
  "command_and_control",
  "exfiltration",
  "impact",
]);
export type MitreAttackPhase = z.infer<typeof mitreAttackPhaseSchema>;

export const socFamilyMetadataSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Family ID must be kebab-case lowercase alphanumerics"),
  version: z.number().int().positive(),
  title: z.string().min(1),
  level: z.enum(["L1", "L2", "L3"]),
  skillsTested: z.array(z.string().min(1)).min(1),
  estimatedMinutes: z.object({
    min: z.number().int().min(5),
    max: z.number().int().max(480),
  }),
  difficultyRange: z.array(difficultyLevelSchema).min(1),
  author: z.string().min(1),
  reviewStatus: reviewStatusSchema,
  reviewerNotes: z.string().optional(),
  publishedHash: z.string().optional(),
});
export type SocFamilyMetadata = z.infer<typeof socFamilyMetadataSchema>;

export const environmentTemplateSchema = z.object({
  organizationArchetypes: z.array(z.string()).min(1),
  assetDistribution: z.object({
    workstations: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
    servers: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
    domainControllers: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
    mailGateways: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  }),
  userDistribution: z.object({
    totalUsers: z.object({ min: z.number().int().min(3), max: z.number().int().min(3) }),
    departments: z.array(z.string()).min(1),
  }),
});
export type EnvironmentTemplate = z.infer<typeof environmentTemplateSchema>;

export const stageIocTemplateSchema = z.object({
  type: z.enum(["ip", "domain", "hash", "url", "email"]),
  valueTemplate: z.string().min(1),
});
export type StageIocTemplate = z.infer<typeof stageIocTemplateSchema>;

export const stageRawEventTemplateSchema = z.object({
  source: z.string().min(1),
  action: z.string().min(1),
  messageTemplate: z.string().min(1),
  fieldsTemplate: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type StageRawEventTemplate = z.infer<typeof stageRawEventTemplateSchema>;

export const stageAlertTemplateSchema = z.object({
  ruleName: z.string().min(1),
  source: socAlertSourceSchema,
  severity: socSeveritySchema,
  summaryTemplate: z.string().min(1),
  rawFieldsTemplate: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  relatedAssetBinding: z.string().optional(),
  relatedUserBinding: z.string().optional(),
  iocs: z.array(stageIocTemplateSchema).default([]),
});
export type StageAlertTemplate = z.infer<typeof stageAlertTemplateSchema>;

export const stageGroundTruthTemplateSchema = z.object({
  kind: z.enum(["true_positive", "false_positive", "benign_true_positive", "duplicate", "informational"]),
  correctDisposition: socDispositionSchema,
  correctSeverity: socSeveritySchema,
  correctEscalation: z.boolean(),
  targetTier: socEscalationTierSchema.optional(),
  minimumEvidenceSet: z.array(z.string()).min(1),
  acceptableAlternatives: z.array(acceptableAlternativeSchema).default([]),
  debriefTemplate: z.string().min(1),
});
export type StageGroundTruthTemplate = z.infer<typeof stageGroundTruthTemplateSchema>;

export const incidentStageTemplateSchema = z.object({
  stageId: z.string().min(1),
  name: z.string().min(1),
  phase: mitreAttackPhaseSchema,
  timingOffsetMinutes: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }),
  jitterMinutes: z.number().nonnegative().default(2),
  branching: z
    .object({
      condition: z.string().min(1),
      outcome: z.enum(["success", "blocked", "alternative"]),
      probability: z.number().min(0).max(1).optional(),
    })
    .optional(),
  telemetryGap: z
    .object({
      probability: z.number().min(0).max(1),
      hideAlert: z.boolean().default(false),
      hideRawEvents: z.boolean().default(false),
      reason: z.string().min(1),
    })
    .optional(),
  eventTemplates: z.array(stageRawEventTemplateSchema).default([]),
  alertTemplates: z.array(stageAlertTemplateSchema).default([]),
  groundTruth: stageGroundTruthTemplateSchema,
});
export type IncidentStageTemplate = z.infer<typeof incidentStageTemplateSchema>;

export const incidentTemplateSchema = z.object({
  id: z.string().min(1),
  titleTemplate: z.string().min(1),
  category: z.string().min(1),
  rootCauseTemplate: z.string().min(1),
  mitreTags: z.array(z.string()).default([]),
  stages: z.array(incidentStageTemplateSchema).min(1),
});
export type IncidentTemplate = z.infer<typeof incidentTemplateSchema>;

export const benignNoiseTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  frequencyRange: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }),
  timePattern: z.enum(["business_hours", "batch_window_nightly", "batch_window_maintenance", "anytime"]),
  actorRole: z.string().min(1),
  eventTemplates: z.array(stageRawEventTemplateSchema).default([]),
  alertTemplates: z.array(stageAlertTemplateSchema).min(1),
  groundTruth: stageGroundTruthTemplateSchema,
});
export type BenignNoiseTemplate = z.infer<typeof benignNoiseTemplateSchema>;

export const twinTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  toolOrTechnique: z.string().min(1),
  maliciousStageRef: z.string().min(1),
  benignTemplateRef: z.string().min(1),
  distinguishingEvidence: z.string().min(1),
  acceptableAlternatives: z.array(acceptableAlternativeSchema).default([]),
});
export type TwinTemplate = z.infer<typeof twinTemplateSchema>;

export const difficultyProfileConfigSchema = z.object({
  incidentCount: z.number().int().positive(),
  noiseRatio: z.number().min(0).max(1),
  ambiguityCount: z.number().int().nonnegative(),
  telemetryGapCount: z.number().int().nonnegative(),
  targetAlertCount: z.number().int().positive(),
  expectedScoreCeilingNaive: z.number().min(0).max(100),
  expectedMinScoreReference: z.number().min(0).max(100),
});
export type DifficultyProfileConfig = z.infer<typeof difficultyProfileConfigSchema>;

export const variationAxesSchema = z.object({
  incidentCount: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  noiseRatio: z.object({ min: z.number().min(0), max: z.number().max(1) }),
  ambiguityCount: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }),
  telemetryGapCount: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }),
  targetAlertCount: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  difficultyProfiles: z.record(difficultyLevelSchema, difficultyProfileConfigSchema),
});
export type VariationAxes = z.infer<typeof variationAxesSchema>;

export const debriefTemplatesSchema = z.object({
  overallBriefingTemplate: z.string().min(1),
  generalGuidanceTemplate: z.string().min(1),
  incidentDebriefTemplates: z.record(z.string(), z.string()).default({}),
});
export type DebriefTemplates = z.infer<typeof debriefTemplatesSchema>;

/** Typed Seams for Future Prompts */
export const enrichmentHookSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  dataPoints: z.array(z.string()).default([]),
});
export type EnrichmentHook = z.infer<typeof enrichmentHookSchema>;

export const queryDatasetHookSchema = z.object({
  datasetName: z.string().min(1),
  extraEventGenerators: z.array(z.string()).default([]),
});
export type QueryDatasetHook = z.infer<typeof queryDatasetHookSchema>;

export const evidenceViewHookSchema = z.object({
  id: z.string().min(1),
  viewType: z.enum(["timeline", "pcap", "process_tree"]),
});
export type EvidenceViewHook = z.infer<typeof evidenceViewHookSchema>;

export const reportRubricHookSchema = z.object({
  sectionId: z.string().min(1),
  criteria: z.array(z.string()).default([]),
});
export type ReportRubricHook = z.infer<typeof reportRubricHookSchema>;

export const familyHooksSchema = z.object({
  enrichmentHooks: z.array(enrichmentHookSchema).default([]),
  queryDatasetHooks: z.array(queryDatasetHookSchema).default([]),
  evidenceViewHooks: z.array(evidenceViewHookSchema).default([]),
  reportRubricHooks: z.array(reportRubricHookSchema).default([]),
});
export type FamilyHooks = z.infer<typeof familyHooksSchema>;

/** Complete SocFamily Schema */
export const socFamilySchema = z.object({
  metadata: socFamilyMetadataSchema,
  environmentTemplate: environmentTemplateSchema,
  incidentTemplates: z.array(incidentTemplateSchema).min(1),
  benignTemplates: z.array(benignNoiseTemplateSchema).min(1),
  twinTemplates: z.array(twinTemplateSchema).default([]),
  variationAxes: variationAxesSchema,
  debriefTemplates: debriefTemplatesSchema,
  hooks: familyHooksSchema.default({
    enrichmentHooks: [],
    queryDatasetHooks: [],
    evidenceViewHooks: [],
    reportRubricHooks: [],
  }),
});
export type SocFamily = z.infer<typeof socFamilySchema>;
