import { z } from "zod";
import type { SocDisposition, SocSeverity } from "../schema";

export type IocType =
  | "ip"
  | "domain"
  | "url"
  | "hash"
  | "email"
  | "file_path"
  | "user"
  | "host"
  | "process"
  | "other";

export type IocRole =
  | "delivery"
  | "c2"
  | "victim"
  | "staging"
  | "persistence"
  | "lateral_movement"
  | "exfiltration"
  | "unrelated_benign"
  | "other";

export type EscalationUrgency = "routine" | "priority" | "immediate";

export interface TimelineRowData {
  id: string;
  timestampUtc: string;
  rawTimestamp: string;
  timezone: string;
  description: string;
  dataOrigin: string;
  evidenceRef?: string;
}

export interface IocRowData {
  id: string;
  type: IocType;
  value: string;
  defangedValue?: string;
  role: IocRole;
  evidenceRefs: string[];
  notes?: string;
}

export interface TechniqueMappingData {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  rationale?: string;
}

export interface ResponseActionData {
  actionId: string;
  actionName: string;
  category: string;
  priority: number;
  rationale: string;
}

export interface EscalationHandoffData {
  requiresEscalation: boolean;
  targetTeam?: string;
  urgency?: EscalationUrgency;
  handoffSummary: string;
}

export interface EvidenceAppendixItem {
  id: string;
  type: "alert" | "event" | "query" | "lookup";
  targetId: string;
  label: string;
  timestamp: string;
  annotation?: string;
}

export interface SocReportData {
  header: {
    title: string;
    caseId?: string;
    analystHandle: string;
    createdAt: string;
    classification: string;
  };
  executiveSummary: string;
  verdict: {
    disposition: SocDisposition;
    severity: SocSeverity;
    confidence: "low" | "medium" | "high";
    justification: string;
  };
  scope: {
    affectedAssets: string[];
    affectedUsers: string[];
    systemsAtRisk?: string;
    businessImpact?: string;
  };
  timeline: TimelineRowData[];
  iocs: IocRowData[];
  attackNarrative: string;
  techniques: TechniqueMappingData[];
  actions: ResponseActionData[];
  escalation: EscalationHandoffData;
  lessonsLearned?: string;
  evidenceAppendix?: EvidenceAppendixItem[];
}

export interface ReportTemplateSection {
  id: string;
  title: string;
  type:
    | "header"
    | "free_text"
    | "verdict"
    | "scope_picker"
    | "timeline_table"
    | "ioc_table"
    | "technique_picker"
    | "action_picker"
    | "escalation_form"
    | "evidence_appendix";
  required: boolean;
  guidance: string;
  fieldLimits?: Record<string, number>;
}

export interface ReportTemplate {
  id: string;
  version: string;
  title: string;
  description: string;
  applicableScenarios: string[];
  sections: ReportTemplateSection[];
}

export interface ReportDraft {
  id: string;
  attemptId: string;
  userId: string;
  templateId: string;
  templateVersion: string;
  versionNumber: number;
  updatedAt: string;
  content: SocReportData;
}

export interface ReportSubmission {
  id: string;
  attemptId: string;
  userId: string;
  templateId: string;
  templateVersion: string;
  submittedAt: string;
  content: SocReportData;
  rubricVersion: string;
  graderVersion: string;
  scoringVersion: string;
}

export interface PreSubmitLintResult {
  valid: boolean;
  errors: Array<{ sectionId: string; message: string }>;
  warnings: Array<{ sectionId: string; message: string }>;
  checksRun: number;
}

// ============================================================================
// Report Ground Truth Types (Server-Side Only - Hidden from learner)
// ============================================================================

export interface IocGroundTruth {
  type: IocType;
  value: string;
  role: IocRole;
  isTruePositive: boolean;
  description?: string;
}

export interface MilestoneGroundTruth {
  id: string;
  timestamp: string;
  entity: string;
  actionKeywords: string[];
  toleranceSeconds: number;
  description: string;
}

export interface ActionGroundTruth {
  requiredActionIds: string[];
  priorityOrder: string[];
  acceptableActionIds: string[];
  harmfulActionIds: string[];
}

export interface TechniqueGroundTruth {
  acceptableTechniqueIds: string[];
  acceptableTactics: string[];
}

export interface EscalationGroundTruth {
  requiresEscalation: boolean;
  acceptableTargets: string[];
  acceptableUrgencies: EscalationUrgency[];
  requiredHandoffElements: string[];
}

export interface VerdictGroundTruth {
  correctDisposition: SocDisposition;
  correctSeverity: SocSeverity;
  acceptableAlternatives: Array<{
    disposition: SocDisposition;
    severity: SocSeverity;
    partialCredit: number;
  }>;
}

export interface ScopeGroundTruth {
  affectedAssets: string[];
  affectedUsers: string[];
  unrelatedAssets: string[];
  unrelatedUsers: string[];
}

export interface SocReportGroundTruth {
  verdict: VerdictGroundTruth;
  scope: ScopeGroundTruth;
  iocs: IocGroundTruth[];
  milestones: MilestoneGroundTruth[];
  actions: ActionGroundTruth;
  techniques: TechniqueGroundTruth;
  escalation: EscalationGroundTruth;
  modelReport: SocReportData;
}

// ============================================================================
// Rubric and Grader Result Types
// ============================================================================

export interface RubricCriterion {
  id: string;
  title: string;
  skillTags: string[];
  maxPoints: number;
  weight: number;
  graderType: "deterministic" | "ai";
  feedbackBands: Array<{ minScore: number; feedbackTemplate: string }>;
  teachingNotes: string;
}

export interface ReportRubric {
  id: string;
  version: string;
  criteria: RubricCriterion[];
}

export interface ClaimAnnotation {
  claimType: string;
  claimId?: string;
  status: "supported" | "unsupported" | "missing" | "incorrect" | "extra";
  detail: string;
}

export interface CriterionResult {
  criterionId: string;
  score: number;
  maxScore: number;
  weight: number;
  status: "graded" | "not_available" | "error";
  feedback: string;
  teachingPointers: string[];
  annotations: ClaimAnnotation[];
  missedItems: string[];
  flags: string[];
}

export interface GradingResult {
  submissionId: string;
  rubricId: string;
  rubricVersion: string;
  graderVersion: string;
  scoringVersion: string;
  totalScore: number;
  maxScore: number;
  availableGradedPoints: number;
  earnedGradedPoints: number;
  isFullyGraded: boolean;
  criterionResults: Record<string, CriterionResult>;
  flags: {
    paddingDetected: boolean;
    fabricationDetected: boolean;
    contradictionsDetected: boolean;
    copyPasteDetected: boolean;
    injectionDetected: boolean;
  };
  modelReportReveal: SocReportData;
  versionLabel: string;
  computedAt: string;
}

export interface ScoringConfig {
  version: string;
  weights: Record<string, number>;
  penalties: {
    paddingPenaltyPerItem: number;
    fabricationPenaltyPerItem: number;
    harmfulActionPenalty: number;
    unorderedTimelinePenalty: number;
    missingEvidencePenalty: number;
    unsupportedClaimPenalty: number;
  };
  tolerances: {
    timelineSeconds: number;
    minNarrativeLength: number;
    maxNarrativeLength: number;
  };
}

