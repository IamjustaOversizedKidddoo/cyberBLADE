import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ReportTemplate, SocReportData } from "./types";
import type { SocCaseRecord, SocDecisionRecord } from "../types";
import { createEmptyReportData } from "./defaults";

export { createEmptyReportData };

let cachedTemplates: Map<string, ReportTemplate> | null = null;
let cachedTechniques: Array<{ id: string; tactic: string; name: string; description: string }> | null = null;
let cachedActions: Array<{ id: string; category: string; name: string; defaultPriority: number; description: string }> | null = null;

/**
 * Loads all report templates from content/soc/report-templates/
 */
export async function loadReportTemplates(): Promise<Map<string, ReportTemplate>> {
  if (cachedTemplates) return cachedTemplates;

  const dir = path.resolve("content/soc/report-templates");
  const files = await fs.readdir(dir);
  const map = new Map<string, ReportTemplate>();

  for (const f of files) {
    if (f.endsWith(".yaml") || f.endsWith(".yml")) {
      const content = await fs.readFile(path.join(dir, f), "utf8");
      const parsed = parseYaml(content) as ReportTemplate;
      map.set(parsed.id, parsed);
    }
  }

  cachedTemplates = map;
  return map;
}

/**
 * Loads a specific report template by ID
 */
export async function getReportTemplate(templateId = "incident-report-l1"): Promise<ReportTemplate> {
  const templates = await loadReportTemplates();
  const tpl = templates.get(templateId);
  if (!tpl) {
    // Fallback to first available template or default structure
    return (
      templates.get("incident-report-l1") ?? {
        id: "incident-report-l1",
        version: "1.0.0",
        title: "SOC Tier-1 Incident Report",
        description: "Standard L1 incident report template",
        applicableScenarios: ["*"],
        sections: [],
      }
    );
  }
  return tpl;
}

/**
 * Loads curated MITRE ATT&CK techniques
 */
export async function loadAttackTechniques(): Promise<
  Array<{ id: string; tactic: string; name: string; description: string }>
> {
  if (cachedTechniques) return cachedTechniques;

  const filePath = path.resolve("content/soc/attack-techniques.yaml");
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseYaml(content);
  cachedTechniques = parsed.catalog ?? [];
  return cachedTechniques!;
}

/**
 * Loads vendor-neutral response actions catalog
 */
export async function loadResponseActions(): Promise<
  Array<{ id: string; category: string; name: string; defaultPriority: number; description: string }>
> {
  if (cachedActions) return cachedActions;

  const filePath = path.resolve("content/soc/response-actions.yaml");
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseYaml(content);
  cachedActions = parsed.catalog ?? [];
  return cachedActions!;
}


/**
 * Leak-free helper: builds a draft pre-filled with the learner's own case notes and decisions
 */
export function createDraftFromCaseNotes(
  targetCase: SocCaseRecord | undefined,
  decisions: SocDecisionRecord[],
  analystHandle: string,
): SocReportData {
  const base = createEmptyReportData(
    analystHandle,
    targetCase?.id ?? "case-001",
    targetCase?.title ?? "Security Incident Investigation",
  );

  if (targetCase) {
    base.header.title = targetCase.title;
    base.verdict.severity = targetCase.severity;
    base.attackNarrative = targetCase.notes || "";
    base.executiveSummary = targetCase.notes
      ? targetCase.notes.slice(0, 300)
      : "";
  }

  // Pre-fill decided alerts as evidence appendix items (strictly what learner decided)
  const evidenceItems: SocReportData["evidenceAppendix"] = [];
  for (const d of decisions) {
    evidenceItems.push({
      id: `ev-${d.alertId}`,
      type: "alert",
      targetId: d.alertId,
      label: `Alert ${d.alertId} (${d.disposition} - ${d.severity})`,
      timestamp: d.createdAt,
      annotation: d.rationale,
    });
  }
  base.evidenceAppendix = evidenceItems;

  return base;
}
