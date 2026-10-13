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
