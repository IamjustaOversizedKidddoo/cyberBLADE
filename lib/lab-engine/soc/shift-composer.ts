import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { createRng } from "@/lib/generators/rng";
import type {
  SocScenario,
  SocAsset,
  SocUser,
  SocNetworkZone,
  SocRawEvent,
  SocAlert,
  SocIncidentGroundTruth,
  SocAlertIoc,
  AcceptableAlternative,
} from "./schema";
import {
  socFamilySchema,
  type SocFamily,
  type IncidentTemplate,
  type BenignNoiseTemplate,
} from "./family-schema";
import { loadVocab } from "./vocab";
import type { ShiftProfile } from "./shift-schema";
import { GENERATOR_VERSION, computeVariantMetrics } from "./generator";
import { balanceAlertIocs, usesIocBalancing } from "./ioc-balance";
import { synthesizeReportGroundTruth } from "./reports/ground-truth-synthesis";
import { validateSocScenario } from "./validator";
import {
  validateVariantSemanticConsistency,
  scanClientViewLeaks,
  detectTells,
  evaluateSolverOnScenario,
  ReferenceSolver,
  ALL_NAIVE_SOLVERS,
  type FamilyQualityReport,
} from "./family-validator";

/**
 * Replace all {tokens} in a template string
 */
function substituteTokens(template: string, tokens: Record<string, string | number | boolean>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (key in tokens) {
      return String(tokens[key]);
    }
    return match;
  });
}

/**
 * Replace all {tokens} in record values
 */
function substituteRecord(
  rec: Record<string, string | number | boolean>,
  tokens: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "string") {
      out[k] = substituteTokens(v, tokens);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatIsoTime(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Load all registered families from disk
 */
export function loadFamilyCatalog(familiesDir?: string): Map<string, SocFamily> {
  const dir = familiesDir ?? path.resolve("content/soc/families");
  const map = new Map<string, SocFamily>();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  for (const f of files) {
    const rawContent = fs.readFileSync(path.join(dir, f), "utf8");
    const parsed = socFamilySchema.safeParse(parseYaml(rawContent));
    if (parsed.success) {
      map.set(parsed.data.metadata.id, parsed.data);
    }
  }

  return map;
}

/**
 * Compose a full SOC shift scenario from a ShiftProfile and seed.
 * Pure deterministic function of (shiftProfile, seed).
 */
export function composeShiftScenario(
  shiftProfile: ShiftProfile,
  seed: string,
  familyMap?: Map<string, SocFamily>,
  options: { generatorVersion?: string } = {},
): SocScenario {
  const catalog = familyMap ?? loadFamilyCatalog();
  const vocab = loadVocab();

  // Sub-stream derivation
  const envRng = createRng(`${seed}:shift:env`);
  const incRng = createRng(`${seed}:shift:incidents`);
  const noiseRng = createRng(`${seed}:shift:noise`);
  const timeRng = createRng(`${seed}:shift:timing`);

  // 1. Shift Window & Base Epoch
  let baseShiftIso = "2026-10-12T08:00:00Z";
  if (shiftProfile.shiftWindow === "night_shift") {
    baseShiftIso = "2026-10-12T23:00:00Z";
  } else if (shiftProfile.shiftWindow === "weekend_shift") {
    baseShiftIso = "2026-10-17T14:00:00Z";
  }
  const shiftEpoch = new Date(baseShiftIso).getTime();

  // 2. Organization & Network
  const orgArchetypeId = envRng.pick(shiftProfile.organizationArchetypes);
  const org = vocab.organizations.find((o) => o.id === orgArchetypeId) ?? vocab.organizations[0];
  const networkZones: SocNetworkZone[] = org.zones.map((z) => ({ ...z }));

  // 3. User Generation
  const deptConfigs = vocab.users.departments;
  const numUsers = 8;
  const users: SocUser[] = [];
  const usedUsernames = new Set<string>();

  for (let i = 0; i < numUsers; i++) {
    const dept = deptConfigs[i % deptConfigs.length];
    const role = envRng.pick(dept.roles);
    const firstName = envRng.pick(vocab.users.names.firstNames);
    const lastName = envRng.pick(vocab.users.names.lastNames);
    let username = `${firstName[0].toLowerCase()}${lastName.toLowerCase().replace(/[^a-z]/g, "")}`;
    if (usedUsernames.has(username)) {
      username = `${username}${i}`;
    }
    usedUsernames.add(username);

    users.push({
      id: `usr-${(i + 1).toString().padStart(3, "0")}`,
      username,
      email: `${username}@${org.domain}`,
      displayName: `${firstName} ${lastName}`,
      department: dept.name,
      role: role.title,
      riskScore: Math.max(0, Math.min(100, role.baseRisk + envRng.int(-5, 10))),
    });
  }

  // System Accounts
  users.push({
    id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
    username: "itadmin",
    email: `itadmin@${org.domain}`,
    displayName: "IT Administrator",
    department: "IT Operations",
    role: "Systems Administrator",
    riskScore: 15,
  });
  users.push({
    id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
    username: "svc-backup",
    email: `svc-backup@${org.domain}`,
    displayName: "Service Account - Backup Daemon",
    department: "Infrastructure",
    role: "Service Principal",
    riskScore: 0,
  });
  users.push({
    id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
    username: "root",
    email: `root@${org.domain}`,
    displayName: "Root Administrator (System)",
    department: "Infrastructure",
    role: "System Superuser",
    riskScore: 0,
  });
  users.push({
    id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
    username: "system",
    email: `system@${org.domain}`,
    displayName: "NT AUTHORITY\\SYSTEM",
    department: "Infrastructure",
    role: "System Principal",
    riskScore: 0,
  });

  // 4. Asset Generation
  const assets: SocAsset[] = [];
  let assetCounter = 1;

  // Workstations for users
  for (let i = 0; i < 6; i++) {
    const owner = users[i];
    const deptCode = owner.department.toLowerCase().slice(0, 3);
    const hostname = `ws-${deptCode}-${(i + 1).toString().padStart(2, "0")}.${org.domain}`;
    assets.push({
      id: `ast-${assetCounter.toString().padStart(3, "0")}`,
      hostname,
      ip: `10.10.${(i + 1) % 250}.${envRng.int(10, 200)}`,
      role: "Workstation",
      os: "Windows 11 Enterprise 23H2",
      criticality: owner.department === "Finance" ? "HIGH" : "MEDIUM",
      owner: owner.username,
      zone: "zone-workstations",
      tags: ["endpoint", deptCode],
    });
    assetCounter++;
  }

  // Staging / Web Servers
  for (let i = 0; i < 2; i++) {
    const hostname = `srv-stage-${(i + 1).toString().padStart(2, "0")}.${org.domain}`;
    assets.push({
      id: `ast-${assetCounter.toString().padStart(3, "0")}`,
      hostname,
      ip: `10.20.1.${50 + i}`,
      role: "Staging Application Server",
      os: "Ubuntu 24.04 LTS",
      criticality: "MEDIUM",
      owner: "devops-team",
      zone: "zone-dmz",
      tags: ["staging", "web", "external-facing"],
    });
    assetCounter++;
  }

  // Domain Controller
  const dcHostname = `dc-01.${org.domain}`;
  assets.push({
    id: `ast-${assetCounter.toString().padStart(3, "0")}`,
    hostname: dcHostname,
    ip: "10.10.0.10",
    role: "Active Directory Domain Controller",
    os: "Windows Server 2022 Datacenter",
    criticality: "CRITICAL",
    owner: "it-admin",
    zone: "zone-core",
    tags: ["infrastructure", "identity", "crown-jewel"],
  });
  assetCounter++;

  // Email Gateway
  const mailHostname = `srv-mail-01.${org.domain}`;
  assets.push({
    id: `ast-${assetCounter.toString().padStart(3, "0")}`,
    hostname: mailHostname,
    ip: "10.20.2.15",
    role: "Secure Email Gateway",
    os: "Hardened Linux Appliance",
    criticality: "HIGH",
    owner: "sec-ops",
    zone: "zone-dmz",
    tags: ["mail", "perimeter"],
  });
  assetCounter++;

  // Production Database
  const dbHostname = `srv-prod-db-01.${org.domain}`;
  assets.push({
    id: `ast-${assetCounter.toString().padStart(3, "0")}`,
    hostname: dbHostname,
    ip: "10.30.2.10",
    role: "Production Database",
    os: "RHEL 9.3 Enterprise",
    criticality: "CRITICAL",
    owner: "dba-team",
    zone: "zone-databases",
    tags: ["crown-jewel", "production", "database"],
  });

  // 5. Staged Incidents & Noise
  type StagedRawEvent = SocRawEvent & { tempId: string };
  type StagedAlert = SocAlert & { tempId: string; tempIncidentId?: string };

  const stagedRawEvents: StagedRawEvent[] = [];
  const stagedAlerts: StagedAlert[] = [];
  const incidentsGroundTruth: SocIncidentGroundTruth[] = [];

  const assignedVictimAssets = new Set<string>();
  let previousVictimAsset: SocAsset | null = null;
  let previousVictimUser: SocUser | null = null;
  let previousIncidentId: string | null = null;

  const extIpPools = Object.values(vocab.iocs.externalIps);
  let extIpPoolIndex = 0;
  let remainingGaps = shiftProfile.telemetryGaps.count;

  for (let selIdx = 0; selIdx < shiftProfile.incidentSelections.length; selIdx++) {
    const sel = shiftProfile.incidentSelections[selIdx];
    const family = catalog.get(sel.familyId);
    if (!family) {
      throw new Error(`Shift composer: family '${sel.familyId}' not found in catalog`);
    }

    // Select incident template
    let incTemplate: IncidentTemplate | undefined;
    if (sel.incidentTemplateId) {
      incTemplate = family.incidentTemplates.find((t) => t.id === sel.incidentTemplateId);
    }
    if (!incTemplate) {
      incTemplate = incRng.pick(family.incidentTemplates);
    }

    // Determine victim asset and user
    let victimAsset: SocAsset;
    let victimUser: SocUser;
    let tempIncId: string;
    let isLinkedToPrev = false;

    if (sel.linkToPreviousVictim && previousVictimAsset && previousVictimUser && previousIncidentId) {
      victimAsset = previousVictimAsset;
      victimUser = previousVictimUser;
      tempIncId = previousIncidentId;
      isLinkedToPrev = true;
    } else {
      const availableWorkstations = assets.filter((a) => a.role === "Workstation" && !assignedVictimAssets.has(a.id));
      victimAsset = availableWorkstations.length > 0 ? incRng.pick(availableWorkstations) : assets[0];
      assignedVictimAssets.add(victimAsset.id);
      victimUser = users.find((u) => u.username === victimAsset.owner) ?? users[0];
      tempIncId = `temp-inc-${incidentsGroundTruth.length + 1}`;
      previousVictimAsset = victimAsset;
      previousVictimUser = victimUser;
      previousIncidentId = tempIncId;
    }

    const targetServer = assets.find((a) => a.role.includes("Staging") || a.role.includes("Database")) ?? assets[1];

    // Pick distinct external IOCs
    const ipPool = extIpPools[extIpPoolIndex % extIpPools.length];
    extIpPoolIndex++;
    const attackerIp = incRng.pick(ipPool);
    const phishingDomain = incRng.pick(vocab.iocs.phishingDomains);
    const c2Domain = incRng.pick(vocab.iocs.c2Domains);
    const fileHash = incRng.pick(vocab.iocs.fileHashes.maliciousPayloader);
    const proc = vocab.iocs.suspiciousProcesses[0];

    const tokens: Record<string, string | number | boolean> = {
      orgName: org.name,
      orgDomain: org.domain,
      victimUser: victimUser.username,
      victimUserEmail: victimUser.email,
      victimUserDisplayName: victimUser.displayName,
      victimAsset: victimAsset.hostname,
      victimAssetId: victimAsset.id,
      victimIp: victimAsset.ip,
      targetServer: targetServer.hostname,
      targetServerIp: targetServer.ip,
      dcHostname,
      mailHostname,
      attackerIp,
      phishingDomain,
      c2Domain,
      c2Ip: attackerIp,
      fileHash,
      processName: proc.name,
      processPath: proc.path,
      maliciousArgs: proc.maliciousArgs.replace("{c2Domain}", c2Domain),
      benignArgs: proc.benignArgs,
    };

    const incidentTitle = substituteTokens(incTemplate.titleTemplate, tokens);
    const rootCause = substituteTokens(incTemplate.rootCauseTemplate, tokens);
    const tempIncidentAlertIds: string[] = [];

    // Base minute offset for this incident
    const incBaseMinutes = sel.stageOffsetMinutes ?? selIdx * 35 + timeRng.int(-5, 10);

    for (const stage of incTemplate.stages) {
      const stageOffset = timeRng.int(stage.timingOffsetMinutes.min, stage.timingOffsetMinutes.max);
      const jitter = timeRng.float(-stage.jitterMinutes, stage.jitterMinutes);
      const stageEpoch = shiftEpoch + (incBaseMinutes + stageOffset + jitter) * 60 * 1000;
      const stageTime = formatIsoTime(stageEpoch);

      // Handle telemetry gap
      let isAlertGap = false;
      let isRawGap = false;
      if (stage.telemetryGap && remainingGaps > 0) {
        if (incRng.next() <= (stage.telemetryGap.probability ?? shiftProfile.telemetryGaps.hideAlertProbability)) {
          isAlertGap = stage.telemetryGap.hideAlert ?? false;
          isRawGap = stage.telemetryGap.hideRawEvents ?? false;
          remainingGaps--;
        }
      }

      // Generate Raw Events for stage
      const stageCreatedEventTempIds: string[] = [];
      if (!isRawGap) {
        for (const evtTpl of stage.eventTemplates) {
          const evtTempId = `temp-evt-${stagedRawEvents.length + 1}`;
          stageCreatedEventTempIds.push(evtTempId);

          const eventMessage = substituteTokens(evtTpl.messageTemplate, tokens);
          const fields = substituteRecord(evtTpl.fieldsTemplate, tokens);

          stagedRawEvents.push({
            id: evtTempId,
            tempId: evtTempId,
            timestamp: stageTime,
            source: evtTpl.source,
            action: evtTpl.action,
            message: eventMessage,
            fields,
          });
        }
      }

      // Generate Alerts for stage
      if (!isAlertGap) {
        for (const altTpl of stage.alertTemplates) {
          const altTempId = `temp-alt-${stagedAlerts.length + 1}`;
          tempIncidentAlertIds.push(altTempId);

          const summary = substituteTokens(altTpl.summaryTemplate, tokens);
          const rawFields = substituteRecord(altTpl.rawFieldsTemplate, tokens);
          const debrief = substituteTokens(stage.groundTruth.debriefTemplate, tokens);

          const iocs: SocAlertIoc[] = altTpl.iocs.map((ioc) => ({
            type: ioc.type,
            value: substituteTokens(ioc.valueTemplate, tokens),
          }));

          const boundAsset = altTpl.relatedAssetBinding === "targetServer" ? targetServer.hostname : victimAsset.hostname;
          const boundUser = altTpl.relatedUserBinding === "targetServer" ? "root" : victimUser.username;

          stagedAlerts.push({
            id: altTempId,
            tempId: altTempId,
            tempIncidentId: tempIncId,
            timestamp: stageTime,
            source: altTpl.source,
            ruleName: altTpl.ruleName,
            severity: altTpl.severity,
            summary,
            relatedAsset: boundAsset,
            relatedUser: boundUser,
            relatedIocs: iocs,
            linkedRawEvents: [...stageCreatedEventTempIds],
            rawFields,
            groundTruth: {
              kind: stage.groundTruth.kind,
              correctDisposition: stage.groundTruth.correctDisposition,
              correctSeverity: stage.groundTruth.correctSeverity,
              correctEscalation: stage.groundTruth.correctEscalation,
              targetTier: stage.groundTruth.targetTier,
              incidentId: tempIncId,
              acceptableAlternatives: stage.groundTruth.acceptableAlternatives.map((alt) => ({ ...alt })),
              debrief,
            },
          });
        }
      }
    }

    if (isLinkedToPrev) {
      // Append alerts to previous incident
      const existingInc = incidentsGroundTruth.find((i) => i.id === tempIncId);
      if (existingInc) {
        existingInc.truePositiveAlertIds.push(...tempIncidentAlertIds);
        existingInc.title = `${existingInc.title} & Multi-Stage Lateral Attack`;
        existingInc.mitre = Array.from(new Set([...existingInc.mitre, ...incTemplate.mitreTags]));
      }
    } else {
      incidentsGroundTruth.push({
        id: tempIncId,
        title: incidentTitle,
        category: incTemplate.category,
        description: rootCause,
        timeline: [],
        truePositiveAlertIds: tempIncidentAlertIds,
        rootCause,
        mitre: [...incTemplate.mitreTags],
      });
    }
  }

  // 6. Benign Noise Generation
  const targetAlertCount = noiseRng.int(
    shiftProfile.targetAlertCount.min,
    shiftProfile.targetAlertCount.max,
  );
  const currentIncidentAlertCount = stagedAlerts.length;
  const noiseAlertsNeeded = Math.max(25, targetAlertCount - currentIncidentAlertCount);

  // Pool benign templates
  const alertFatigueFamily = catalog.get("soc-f-alert-fatigue-01");
  const participatingFamilies = shiftProfile.incidentSelections
    .map((s) => catalog.get(s.familyId))
    .filter(Boolean) as SocFamily[];

  const fatigueBenignPool = alertFatigueFamily ? alertFatigueFamily.benignTemplates : [];
  const familyBenignPool = participatingFamilies.flatMap((f) => f.benignTemplates);

  let noiseGeneratedCount = 0;
  let noiseIndex = 0;

  while (noiseGeneratedCount < noiseAlertsNeeded) {
    // Decide whether to pick fatigue noise or participating family noise
    const pickFatigue =
      fatigueBenignPool.length > 0 &&
      (familyBenignPool.length === 0 || noiseRng.next() < shiftProfile.noiseMix.alertFatigueRatio);

    const benignTpl: BenignNoiseTemplate = pickFatigue
      ? fatigueBenignPool[noiseIndex % fatigueBenignPool.length]
      : familyBenignPool[noiseIndex % familyBenignPool.length];
    noiseIndex++;

    const actorUser = noiseRng.pick(users);
    const targetAsset = noiseRng.pick(assets);
    const scannerIp = "10.10.0.85";
    const roamingIp = "198.51.100.201";

    const noiseTokens: Record<string, string | number | boolean> = {
      username: actorUser.username,
      hostname: targetAsset.hostname,
      scannerIp,
      roamingIp,
      orgDomain: org.domain,
    };

    let timeMinutes = 0;
    if (benignTpl.timePattern === "business_hours") {
      timeMinutes = timeRng.int(10, 360);
    } else if (benignTpl.timePattern === "batch_window_nightly") {
      timeMinutes = timeRng.int(-60, 60);
    } else if (benignTpl.timePattern === "batch_window_maintenance") {
      timeMinutes = timeRng.int(-30, 180);
    } else {
      timeMinutes = timeRng.int(-30, 360);
    }
    const noiseEpoch = shiftEpoch + timeMinutes * 60 * 1000;
    const noiseTime = formatIsoTime(noiseEpoch);

    // Raw events
    const noiseEventTempIds: string[] = [];
    for (const evtTpl of benignTpl.eventTemplates) {
      const evtTempId = `temp-evt-${stagedRawEvents.length + 1}`;
      noiseEventTempIds.push(evtTempId);
      stagedRawEvents.push({
        id: evtTempId,
        tempId: evtTempId,
        timestamp: noiseTime,
        source: evtTpl.source,
        action: evtTpl.action,
        message: substituteTokens(evtTpl.messageTemplate, noiseTokens),
        fields: substituteRecord(evtTpl.fieldsTemplate, noiseTokens),
      });
    }

    // Alerts
    for (const altTpl of benignTpl.alertTemplates) {
      const altTempId = `temp-alt-${stagedAlerts.length + 1}`;
      const summary = substituteTokens(altTpl.summaryTemplate, noiseTokens);
      const rawFields = substituteRecord(altTpl.rawFieldsTemplate, noiseTokens);
      const debrief = substituteTokens(benignTpl.groundTruth.debriefTemplate, noiseTokens);

      const iocs: SocAlertIoc[] = altTpl.iocs.map((ioc: { type: "ip" | "domain" | "hash" | "url" | "email"; valueTemplate: string }) => ({
        type: ioc.type,
        value: substituteTokens(ioc.valueTemplate, noiseTokens),
      }));

      stagedAlerts.push({
        id: altTempId,
        tempId: altTempId,
        timestamp: noiseTime,
        source: altTpl.source,
        ruleName: altTpl.ruleName,
        severity: altTpl.severity,
        summary,
        relatedAsset: targetAsset.hostname,
        relatedUser: actorUser.username,
        relatedIocs: iocs,
        linkedRawEvents: [...noiseEventTempIds],
        rawFields,
        groundTruth: {
          kind: benignTpl.groundTruth.kind,
          correctDisposition: benignTpl.groundTruth.correctDisposition,
          correctSeverity: benignTpl.groundTruth.correctSeverity,
          correctEscalation: benignTpl.groundTruth.correctEscalation,
          acceptableAlternatives: benignTpl.groundTruth.acceptableAlternatives.map((alt: AcceptableAlternative) => ({ ...alt })),
          debrief,
        },
      });

      noiseGeneratedCount++;
      if (noiseGeneratedCount >= noiseAlertsNeeded) break;
    }
  }

  // 7. Chronological Ordering & Opaque IDs
  stagedRawEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const eventIdMap = new Map<string, string>();
  const finalRawEvents: SocRawEvent[] = stagedRawEvents.map((evt, idx) => {
    const finalId = `evt-${(idx + 1).toString().padStart(3, "0")}`;
    eventIdMap.set(evt.tempId, finalId);
    return {
      id: finalId,
      timestamp: evt.timestamp,
      source: evt.source,
      action: evt.action,
      message: evt.message,
      fields: evt.fields,
    };
  });

  stagedAlerts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const alertIdMap = new Map<string, string>();
  const finalAlerts: SocAlert[] = stagedAlerts.map((alt, idx) => {
    const finalId = `alt-${(idx + 1).toString().padStart(3, "0")}`;
    alertIdMap.set(alt.tempId, finalId);

    const finalLinkedEvents = alt.linkedRawEvents
      .map((tempEvtId) => eventIdMap.get(tempEvtId) ?? tempEvtId)
      .filter((id) => finalRawEvents.some((e) => e.id === id));

    return {
      id: finalId,
      timestamp: alt.timestamp,
      source: alt.source,
      ruleName: alt.ruleName,
      severity: alt.severity,
      summary: alt.summary,
      relatedAsset: alt.relatedAsset,
      relatedUser: alt.relatedUser,
      relatedIocs: alt.relatedIocs,
      linkedRawEvents: finalLinkedEvents,
      rawFields: alt.rawFields,
      groundTruth: {
        ...alt.groundTruth,
      },
    };
  });

  const incidentIdMap = new Map<string, string>();
  const finalIncidents: SocIncidentGroundTruth[] = incidentsGroundTruth.map((inc, idx) => {
    const finalIncId = `inc-${(idx + 1).toString().padStart(3, "0")}`;
    incidentIdMap.set(inc.id, finalIncId);

    const finalTpAlertIds = inc.truePositiveAlertIds
      .map((tempAltId) => alertIdMap.get(tempAltId)!)
      .filter(Boolean);

    const relatedTimestamps = finalAlerts
      .filter((a) => finalTpAlertIds.includes(a.id))
      .map((a) => a.timestamp)
      .sort();

    const incBase: SocIncidentGroundTruth = {
      id: finalIncId,
      title: inc.title,
      category: inc.category,
      description: inc.description,
      timeline: relatedTimestamps,
      truePositiveAlertIds: finalTpAlertIds,
      rootCause: inc.rootCause,
      mitre: inc.mitre,
    };
    incBase.reportGroundTruth = synthesizeReportGroundTruth(incBase, finalAlerts, { assets, users });
    return incBase;
  });

  for (let i = 0; i < finalAlerts.length; i++) {
    const origStaged = stagedAlerts[i];
    if (origStaged.tempIncidentId && incidentIdMap.has(origStaged.tempIncidentId)) {
      finalAlerts[i].groundTruth.incidentId = incidentIdMap.get(origStaged.tempIncidentId);
    }
  }

  // 8. Synthesis
  const briefing = substituteTokens(shiftProfile.debrief.briefingTemplate, {
    orgName: org.name,
    alertCount: finalAlerts.length,
    shiftWindow: shiftProfile.shiftWindow,
    incidentCount: finalIncidents.length,
  });

  const overallDebrief = substituteTokens(shiftProfile.debrief.guidanceTemplate, {
    orgName: org.name,
    alertCount: finalAlerts.length,
    shiftWindow: shiftProfile.shiftWindow,
    incidentCount: finalIncidents.length,
  });

  const skillsTested =
    shiftProfile.skillsTested.length > 0
      ? [...shiftProfile.skillsTested]
      : Array.from(new Set(participatingFamilies.flatMap((f) => f.metadata.skillsTested)));

  const seedHash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const generatorVersion = options.generatorVersion ?? GENERATOR_VERSION;

  const composed: SocScenario = {
    id: `${shiftProfile.id}-${seedHash}`,
    version: shiftProfile.version,
    title: `${shiftProfile.title} (Shift ${seedHash})`,
    level: shiftProfile.level,
    estimatedMinutes: shiftProfile.estimatedMinutes.max,
    skillsTested,
    difficulty: shiftProfile.difficulty,
    briefing,
    seed,
    variantOf: shiftProfile.id,
    generatorConfig: {
      generatorVersion,
      familyVersion: shiftProfile.version,
      difficulty: shiftProfile.difficulty,
    },
    environment: {
      assets,
      users,
      networkZones,
    },
    rawEvents: finalRawEvents,
    alerts: finalAlerts,
    groundTruth: {
      incidents: finalIncidents,
      overallDebrief,
    },
    enrichmentSources: [],
    evidenceViews: [],
    instantFeedback: false,
    examMode: false,
  };
  // Version-pinned: attempts created before 1.1.0 keep their original alerts.
  return usesIocBalancing(generatorVersion) ? balanceAlertIocs(composed) : composed;
}

/**
 * Run the comprehensive proof toolchain over a ShiftProfile
 */
export function runShiftProof(
  shiftProfile: ShiftProfile,
  seedCount: number = 50,
  familyMap?: Map<string, SocFamily>,
): FamilyQualityReport {
  let structuralPasses = 0;
  let semanticPasses = 0;
  let tellPasses = 0;
  let leakPasses = 0;

  const generatedScenarios: SocScenario[] = [];
  const refScores: number[] = [];
  const naiveScoresMap = new Map<string, number[]>();
  for (const solver of ALL_NAIVE_SOLVERS) {
    naiveScoresMap.set(solver.name, []);
  }

  const alertCounts: number[] = [];
  const eventCounts: number[] = [];
  const incCounts: number[] = [];
  const noiseRatios: number[] = [];
  const timings: number[] = [];

  for (let s = 1; s <= seedCount; s++) {
    const seed = `proof-shift-${shiftProfile.id}-${s}`;
    const t0 = performance.now();

    const sc = composeShiftScenario(shiftProfile, seed, familyMap);
    const duration = performance.now() - t0;
    timings.push(duration);
    generatedScenarios.push(sc);

    // Layer 1: Structural
    const structResult = validateSocScenario(sc, `${shiftProfile.id}-${seed}`);
    if (structResult.valid) structuralPasses++;

    // Layer 2: Semantic
    const semResult = validateVariantSemanticConsistency(sc);
    if (semResult.valid) semanticPasses++;

    // Layer 3: Reference Solver
    const refScore = evaluateSolverOnScenario(ReferenceSolver, sc).scorePercentage;
    refScores.push(refScore);

    // Layer 4: Naive Solvers
    for (const solver of ALL_NAIVE_SOLVERS) {
      const score = evaluateSolverOnScenario(solver, sc).scorePercentage;
      naiveScoresMap.get(solver.name)!.push(score);
    }

    // Layer 6: Leak Scanner
    const leakResult = scanClientViewLeaks(sc);
    if (leakResult.passed) leakPasses++;

    // Metrics
    alertCounts.push(sc.alerts.length);
    eventCounts.push(sc.rawEvents.length);
    incCounts.push(sc.groundTruth.incidents.length);
    const fpCount = sc.alerts.filter((a) => a.groundTruth.kind !== "true_positive").length;
    noiseRatios.push(fpCount / sc.alerts.length);
  }

  const refMin = Math.min(...refScores);
  const refMean = Number((refScores.reduce((a, b) => a + b, 0) / seedCount).toFixed(1));
  const refMax = Math.max(...refScores);

  const naiveSummaries = ALL_NAIVE_SOLVERS.map((solver) => {
    const scores = naiveScoresMap.get(solver.name)!;
    return {
      name: solver.name,
      meanScore: Number((scores.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
      maxScore: Math.max(...scores),
    };
  });

  const bestNaiveMaxScore = Math.max(...naiveSummaries.map((s) => s.maxScore));
  const referenceToNaiveMargin = Number((refMin - bestNaiveMaxScore).toFixed(1));

  timings.sort((a, b) => a - b);
  const p50 = Number(timings[Math.floor(timings.length * 0.5)].toFixed(2));
  const p95 = Number(timings[Math.floor(timings.length * 0.95)].toFixed(2));
  const maxTime = Number(timings[timings.length - 1].toFixed(2));

  const variantMetrics = computeVariantMetrics(generatedScenarios);

  const weakestAreas: string[] = [];
  const pooledTellResult = detectTells(generatedScenarios);
  if (!pooledTellResult.passed) {
    for (const leak of pooledTellResult.leakingFeatures) {
      weakestAreas.push(`Tell detected: '${leak.feature}' separates true positives with ${(leak.accuracy * 100).toFixed(1)}% accuracy`);
    }
  }
  tellPasses = pooledTellResult.passed ? seedCount : 0;

  if (refMin < 80) weakestAreas.push(`Reference solver scored as low as ${refMin}% on some seeds`);
  if (bestNaiveMaxScore > 65) weakestAreas.push(`Naive solver reached up to ${bestNaiveMaxScore}% (too high)`);

  const verdict =
    structuralPasses === seedCount &&
    semanticPasses === seedCount &&
    tellPasses === seedCount &&
    leakPasses === seedCount &&
    refMin >= 75 &&
    bestNaiveMaxScore <= 70
      ? "PASSED"
      : "FAILED";

  return {
    familyId: shiftProfile.id,
    version: shiftProfile.version,
    sampleSize: seedCount,
    difficulty: shiftProfile.difficulty,
    structuralPassRate: Number(((structuralPasses / seedCount) * 100).toFixed(1)),
    semanticPassRate: Number(((semanticPasses / seedCount) * 100).toFixed(1)),
    tellDetectionPassRate: Number(((tellPasses / seedCount) * 100).toFixed(1)),
    leakScanPassRate: Number(((leakPasses / seedCount) * 100).toFixed(1)),
    rejectionRate: 0,
    referenceSolver: {
      minScore: refMin,
      meanScore: refMean,
      maxScore: refMax,
      passingSeedsRate: Number(((refScores.filter((s) => s >= 75).length / seedCount) * 100).toFixed(1)),
    },
    naiveSolvers: naiveSummaries,
    bestNaiveMaxScore,
    referenceToNaiveMargin,
    distributions: {
      alertCounts: {
        min: Math.min(...alertCounts),
        mean: Number((alertCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...alertCounts),
      },
      eventCounts: {
        min: Math.min(...eventCounts),
        mean: Number((eventCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...eventCounts),
      },
      incidentCounts: {
        min: Math.min(...incCounts),
        mean: Number((incCounts.reduce((a, b) => a + b, 0) / seedCount).toFixed(1)),
        max: Math.max(...incCounts),
      },
      noiseRatios: {
        min: Number(Math.min(...noiseRatios).toFixed(2)),
        mean: Number((noiseRatios.reduce((a, b) => a + b, 0) / seedCount).toFixed(2)),
        max: Number(Math.max(...noiseRatios).toFixed(2)),
      },
    },
    variantDistance: variantMetrics,
    generationTimingsMs: {
      p50,
      p95,
      max: maxTime,
    },
    weakestAreas,
    verdict,
  };
}
