import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { SocAlert, SocIncidentGroundTruth, SocAsset, SocUser, SocDisposition, SocSeverity } from "../schema";
import type {
  SocReportGroundTruth,
  SocReportData,
  IocGroundTruth,
  MilestoneGroundTruth,
  IocType,
  IocRole,
  TimelineRowData,
  IocRowData,
  TechniqueMappingData,
  ResponseActionData,
} from "./types";
import { defangIndicator } from "./sanitizer";

// ---------------------------------------------------------------------------
// Synchronous catalog loaders (used during generation — the hot path is sync)
// ---------------------------------------------------------------------------
type TechEntry = { id: string; tactic: string; name: string; description: string };
type ActionEntry = { id: string; category: string; name: string; defaultPriority: number; description: string };

let _techCache: TechEntry[] | null = null;
let _actionCache: ActionEntry[] | null = null;

function loadAttackTechniquesSync(): TechEntry[] {
  if (_techCache) return _techCache;
  const filePath = path.resolve("content/soc/attack-techniques.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(raw);
  _techCache = (parsed.catalog ?? []) as TechEntry[];
  return _techCache;
}

function loadResponseActionsSync(): ActionEntry[] {
  if (_actionCache) return _actionCache;
  const filePath = path.resolve("content/soc/response-actions.yaml");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(raw);
  _actionCache = (parsed.catalog ?? []) as ActionEntry[];
  return _actionCache;
}

/**
 * Maps arbitrary IoC string types from alerts to normalized IocType
 */
function normalizeIocType(rawType: string): IocType {
  const t = rawType.toLowerCase().trim();
  if (t === "ip" || t === "ipv4" || t === "ipv6") return "ip";
  if (t === "domain" || t === "hostname" || t === "fqdn") return "domain";
  if (t === "url" || t === "uri") return "url";
  if (t === "hash" || t === "md5" || t === "sha1" || t === "sha256") return "hash";
  if (t === "email" || t === "email_address") return "email";
  if (t === "file" || t === "file_path" || t === "path") return "file_path";
  if (t === "user" || t === "username" || t === "account") return "user";
  if (t === "host" || t === "computer" || t === "machine") return "host";
  if (t === "process" || t === "command" || t === "cmd") return "process";
  return "other";
}

/**
 * Assigns plausible tactical role for an IoC based on type and category
 */
function assignIocRole(type: IocType, category: string): IocRole {
  const cat = category.toLowerCase();
  if (type === "email") return "delivery";
  if (type === "url") return "delivery";
  if (type === "hash") {
    if (cat.includes("persist") || cat.includes("backdoor")) return "persistence";
    if (cat.includes("drop") || cat.includes("stage")) return "staging";
    return "delivery";
  }
  if (type === "ip" || type === "domain") {
    if (cat.includes("phish") || cat.includes("delivery")) return "delivery";
    if (cat.includes("exfil")) return "exfiltration";
    return "c2";
  }
  if (type === "user") return "victim";
  if (type === "host") return "victim";
  if (type === "process") {
    if (cat.includes("lateral")) return "lateral_movement";
    if (cat.includes("persist")) return "persistence";
    return "staging";
  }
  return "other";
}

/**
 * Extracts distinct action keywords from text for fuzzy matching
 */
function extractActionKeywords(ruleName: string, summary: string, category: string): string[] {
  const combined = `${ruleName} ${summary} ${category}`.toLowerCase();
  const tokens = combined.split(/[^a-z0-9_-]+/).filter((t) => t.length > 3);
  const stopWords = new Set(["alert", "detected", "detection", "security", "event", "system", "rule", "activity", "potential", "suspicious"]);
  const meaningful = tokens.filter((t) => !stopWords.has(t));
  return Array.from(new Set(meaningful)).slice(0, 8);
}

/** Severity ranking (uppercase — matches SocSeverity) */
const SEVERITY_RANK: Record<SocSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/**
 * Synthesizes a deterministic SocReportGroundTruth for an incident.
 * Pure function of (incident, alerts, environment, catalogs).
 */
export function synthesizeReportGroundTruth(
  incident: SocIncidentGroundTruth,
  allAlerts: SocAlert[],
  environment: { assets: SocAsset[]; users: SocUser[] },
): SocReportGroundTruth {
  const tpAlerts = allAlerts.filter((a) => incident.truePositiveAlertIds.includes(a.id));
  const otherAlerts = allAlerts.filter((a) => !incident.truePositiveAlertIds.includes(a.id));

  // 1. Verdict & Severity Ground Truth
  const correctDisposition: SocDisposition = "true_positive";

  let maxSevRank = 1;
  let correctSeverity: SocSeverity = "MEDIUM";
  for (const a of tpAlerts) {
    const r = SEVERITY_RANK[a.severity] ?? 1;
    if (r > maxSevRank) {
      maxSevRank = r;
      correctSeverity = a.severity;
    }
  }

  // Acceptable alternatives: adjacent severity with partial credit
  const acceptableAlternatives: Array<{ disposition: SocDisposition; severity: SocSeverity; partialCredit: number }> = [];
  if (correctSeverity === "CRITICAL") {
    acceptableAlternatives.push({ disposition: "true_positive", severity: "HIGH", partialCredit: 0.75 });
  } else if (correctSeverity === "HIGH") {
    acceptableAlternatives.push({ disposition: "true_positive", severity: "CRITICAL", partialCredit: 0.8 });
    acceptableAlternatives.push({ disposition: "true_positive", severity: "MEDIUM", partialCredit: 0.7 });
  } else if (correctSeverity === "MEDIUM") {
    acceptableAlternatives.push({ disposition: "true_positive", severity: "HIGH", partialCredit: 0.8 });
    acceptableAlternatives.push({ disposition: "true_positive", severity: "LOW", partialCredit: 0.7 });
  }

  // 2. Scope Ground Truth
  const affectedAssetSet = new Set<string>();
  const affectedUserSet = new Set<string>();
  for (const a of tpAlerts) {
    if (a.relatedAsset) affectedAssetSet.add(a.relatedAsset);
    if (a.relatedUser) affectedUserSet.add(a.relatedUser);
  }

  const affectedAssets = Array.from(affectedAssetSet).sort();
  const affectedUsers = Array.from(affectedUserSet).sort();

  const envAssetIds = environment.assets.map((ast) => ast.id);
  const envUsernames = environment.users.map((u) => u.username);

  const unrelatedAssets = envAssetIds.filter((id) => !affectedAssetSet.has(id)).sort();
  const unrelatedUsers = envUsernames.filter((u) => !affectedUserSet.has(u)).sort();

  // 3. IoCs Ground Truth
  const iocMap = new Map<string, IocGroundTruth>();
  for (const a of tpAlerts) {
    for (const rawIoc of a.relatedIocs ?? []) {
      const type = normalizeIocType(rawIoc.type);
      const val = rawIoc.value.trim().toLowerCase();
      if (!val) continue;
      const key = `${type}:${val}`;
      if (!iocMap.has(key)) {
        iocMap.set(key, {
          type,
          value: rawIoc.value.trim(),
          role: assignIocRole(type, incident.category),
          isTruePositive: true,
          description: `Extracted from alert ${a.id} (${a.ruleName})`,
        });
      }
    }
  }

  // Also record unrelated indicators from noise/benign alerts as isTruePositive = false
  for (const a of otherAlerts) {
    for (const rawIoc of a.relatedIocs ?? []) {
      const type = normalizeIocType(rawIoc.type);
      const val = rawIoc.value.trim().toLowerCase();
      if (!val) continue;
      const key = `${type}:${val}`;
      if (!iocMap.has(key)) {
        iocMap.set(key, {
          type,
          value: rawIoc.value.trim(),
          role: "unrelated_benign",
          isTruePositive: false,
          description: `Benign indicator from unrelated alert ${a.id}`,
        });
      }
    }
  }

  const iocs = Array.from(iocMap.values());

  // 4. Milestones Ground Truth
  const sortedTpAlerts = [...tpAlerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const milestones: MilestoneGroundTruth[] = sortedTpAlerts.map((a, idx) => ({
    id: `ms-${(idx + 1).toString().padStart(2, "0")}`,
    timestamp: a.timestamp,
    entity: a.relatedAsset || a.relatedUser || "network",
    actionKeywords: extractActionKeywords(a.ruleName, a.summary, incident.category),
    toleranceSeconds: 300,
    description: a.summary,
  }));

  // 5. Response Actions Ground Truth
  const requiredActionIds: string[] = [];
  const priorityOrder: string[] = [];
  const acceptableActionIds: string[] = ["collect_forensics", "notify_stakeholders"];
  const harmfulActionIds: string[] = ["reimage_host", "wipe_system", "block_all_traffic"];

  if (affectedAssets.length > 0) {
    requiredActionIds.push("isolate_host");
    priorityOrder.push("isolate_host");
  }
  if (affectedUsers.length > 0) {
    requiredActionIds.push("disable_account", "reset_credentials");
    priorityOrder.push("disable_account", "reset_credentials");
  }
  if (iocs.some((i) => i.isTruePositive && (i.type === "ip" || i.type === "domain"))) {
    requiredActionIds.push("block_ip_or_domain");
    priorityOrder.push("block_ip_or_domain");
  }
  if (iocs.some((i) => i.isTruePositive && i.type === "email")) {
    requiredActionIds.push("quarantine_email");
    priorityOrder.push("quarantine_email");
  }

  // 6. MITRE Techniques Ground Truth (sync load)
  const attackTechniquesCatalog = loadAttackTechniquesSync();
  const techMap = new Map(attackTechniquesCatalog.map((t) => [t.id, t]));
  const acceptableTechniqueIds = incident.mitre.filter((id) => techMap.has(id));
  const acceptableTactics = Array.from(
    new Set(acceptableTechniqueIds.map((id) => techMap.get(id)?.tactic).filter(Boolean) as string[]),
  );

  // 7. Escalation Ground Truth
  const escalation: SocReportGroundTruth["escalation"] = {
    requiresEscalation: true,
    acceptableTargets: ["tier_2", "incident_response", "soc_lead"],
    acceptableUrgencies: correctSeverity === "CRITICAL" ? ["immediate"] : ["priority", "immediate"],
    requiredHandoffElements: [
      "affected_assets",
      "affected_users",
      "critical_iocs",
      "containment_status",
      "recommended_next_steps",
    ],
  };

  // 8. Exemplary Model Report Generation
  const modelTimeline: TimelineRowData[] = milestones.map((m, idx) => ({
    id: `tl-model-${idx + 1}`,
    timestampUtc: m.timestamp,
    rawTimestamp: m.timestamp,
    timezone: "UTC",
    description: m.description,
    dataOrigin: "SIEM / EDR Alert",
    evidenceRef: `alert:${sortedTpAlerts[idx]?.id ?? sortedTpAlerts[0]?.id ?? "tp-alert"}`,
  }));

  const modelIocs: IocRowData[] = iocs
    .filter((i) => i.isTruePositive)
    .map((i, idx) => ({
      id: `ioc-model-${idx + 1}`,
      type: i.type,
      value: i.value,
      defangedValue: defangIndicator(i.value),
      role: i.role,
      evidenceRefs: sortedTpAlerts.slice(0, 1).map((a) => `alert:${a.id}`),
      notes: i.description,
    }));

  const modelTechniques: TechniqueMappingData[] = acceptableTechniqueIds.map((tid) => {
    const meta = techMap.get(tid);
    return {
      techniqueId: tid,
      techniqueName: meta?.name ?? tid,
      tactic: meta?.tactic ?? "defense-evasion",
      rationale: `Observed adversary behavior matching ${meta?.name ?? tid}.`,
    };
  });

  const actionCatalog = loadResponseActionsSync();
  const actionCatalogMap = new Map(actionCatalog.map((act) => [act.id, act]));

  const modelActions: ResponseActionData[] = requiredActionIds.map((aid, idx) => {
    const actMeta = actionCatalogMap.get(aid);
    return {
      actionId: aid,
      actionName: actMeta?.name ?? aid,
      category: actMeta?.category ?? "containment",
      priority: idx + 1,
      rationale: `Immediate containment required to halt adversary progression on ${affectedAssets.join(", ")}.`,
    };
  });

  const modelReport: SocReportData = {
    header: {
      title: `[INCIDENT] ${incident.title}`,
      caseId: incident.id,
      analystHandle: "model-tier1-analyst",
      createdAt: sortedTpAlerts[sortedTpAlerts.length - 1]?.timestamp ?? new Date().toISOString(),
      classification: "CONFIDENTIAL // SOC INTERNAL",
    },
    executiveSummary: `Investigation confirmed a ${correctSeverity} severity security incident involving ${incident.category}. The attack targeted assets [${affectedAssets.join(", ")}] and accounts [${affectedUsers.join(", ")}]. Containment actions including host isolation and credential resets have been executed. Immediate Tier-2 escalation is recommended.`,
    verdict: {
      disposition: correctDisposition,
      severity: correctSeverity,
      confidence: "high",
      justification: `Multiple correlated alerts confirm adversary activity matching ${incident.category}. Corroborated by telemetry and IoC analysis.`,
    },
    scope: {
      affectedAssets,
      affectedUsers,
      systemsAtRisk: `Production systems and credentials associated with ${affectedAssets.join(", ")}`,
      businessImpact: `Potential compromise of internal network segments and unauthorized credential access.`,
    },
    timeline: modelTimeline,
    iocs: modelIocs,
    attackNarrative: `The adversary initiated the intrusion via ${incident.category}. Telemetry demonstrates initial execution followed by credential harvesting and command-and-control communication. All malicious indicators have been isolated and scoped. Root cause: ${incident.rootCause}`,
    techniques: modelTechniques,
    actions: modelActions,
    escalation: {
      requiresEscalation: true,
      targetTeam: "tier_2",
      urgency: correctSeverity === "CRITICAL" ? "immediate" : "priority",
      handoffSummary: `Escalating ${incident.id} for deeper memory analysis and enterprise-wide sweep. Host isolation enacted; containment active.`,
    },
    lessonsLearned: `Review email gateway detonation rules and update endpoint behavioral heuristics for ${incident.category}.`,
    evidenceAppendix: sortedTpAlerts.map((a) => ({
      id: `ev-${a.id}`,
      type: "alert" as const,
      targetId: a.id,
      label: `${a.ruleName} (${a.severity})`,
      timestamp: a.timestamp,
      annotation: a.summary,
    })),
  };

  return {
    verdict: {
      correctDisposition,
      correctSeverity,
      acceptableAlternatives,
    },
    scope: {
      affectedAssets,
      affectedUsers,
      unrelatedAssets,
      unrelatedUsers,
    },
    iocs,
    milestones,
    actions: {
      requiredActionIds,
      priorityOrder,
      acceptableActionIds,
      harmfulActionIds,
    },
    techniques: {
      acceptableTechniqueIds,
      acceptableTactics,
    },
    escalation,
    modelReport,
  };
}
