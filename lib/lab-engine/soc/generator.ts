import crypto from "node:crypto";
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
} from "./schema";
import type {
  SocFamily,
  DifficultyLevel,
} from "./family-schema";
import { loadVocab, type SocVocab } from "./vocab";
import { synthesizeReportGroundTruth } from "./reports/ground-truth-synthesis";
import { NOISE_ROAMING_IP, balanceAlertIocs, reservedLiterals, seededIncidentIocs, usesIocBalancing, usesSeededIocs } from "./ioc-balance";

// 1.1.0: IOC balancing on non-true-positive alerts (L1-A-03). 1.2.0: per-seed indicator values
// (L1-A-09). Attempts keep their pinned version.
export const GENERATOR_VERSION = "1.2.0";

export type GenerationOptions = {
  maxAttempts?: number;
  shiftStartTime?: string; // Default: 2026-10-12T08:00:00Z
  /** The attempt's pinned generator version; omitted = current (new attempts). */
  generatorVersion?: string;
};

export type GenerationResult = {
  scenario: SocScenario;
  contentHash: string;
  attemptCount: number;
  rejectionRate: number;
};

/**
 * Replace all {tokens} in a string template with values from dictionary
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

/**
 * Format ISO timestamp deterministically from epoch milliseconds
 */
function formatIsoTime(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/**
 * Pure deterministic generator for SOC Scenarios.
 * Pure function of (family, familyVersion, generatorVersion, seed, difficulty).
 */
export function generateSocVariant(
  family: SocFamily,
  seed: string,
  difficulty: DifficultyLevel = "intermediate",
  options: GenerationOptions = {},
): GenerationResult {
  const maxAttempts = options.maxAttempts ?? 5;
  const vocab = loadVocab();

  let attemptIndex = 0;
  let rejections = 0;

  while (attemptIndex < maxAttempts) {
    const attemptSeed = attemptIndex === 0 ? seed : `${seed}:retry:${attemptIndex}`;
    attemptIndex++;

    try {
      const generatorVersion = options.generatorVersion ?? GENERATOR_VERSION;
      const base = generateSingleVariant(family, attemptSeed, difficulty, vocab, options.shiftStartTime, generatorVersion);
      const pinned = { ...base, generatorConfig: { ...base.generatorConfig!, generatorVersion } };
      // Version-pinned: attempts created before 1.1.0 keep their original alerts.
      const scenario = usesIocBalancing(generatorVersion) ? balanceAlertIocs(pinned) : pinned;
      const contentHash = computeScenarioHash(scenario);

      return {
        scenario,
        contentHash,
        attemptCount: attemptIndex,
        rejectionRate: rejections / attemptIndex,
      };
    } catch {
      rejections++;
      if (attemptIndex >= maxAttempts) {
        throw new Error(
          `Failed to generate valid scenario for family '${family.metadata.id}' after ${maxAttempts} attempts with seed '${seed}'`,
        );
      }
    }
  }

  throw new Error(`Generation exceeded max attempts`);
}

function generateSingleVariant(
  family: SocFamily,
  seed: string,
  difficulty: DifficultyLevel,
  vocab: SocVocab,
  baseShiftStartTime?: string,
  generatorVersion: string = GENERATOR_VERSION,
): SocScenario {
  // 1. Sub-stream derivation: guarantees adding noise/text changes never alters incident logic
  const envRng = createRng(`${seed}:environment`);
  const incRng = createRng(`${seed}:incidents`);
  const noiseRng = createRng(`${seed}:noise`);
  const timeRng = createRng(`${seed}:timing`);
  const _idRng = createRng(`${seed}:ids`);
  const _textRng = createRng(`${seed}:text`);

  // 2. Select difficulty profile
  const profile = family.variationAxes.difficultyProfiles[difficulty] ??
    family.variationAxes.difficultyProfiles.intermediate ?? {
      incidentCount: 2,
      noiseRatio: 0.75,
      ambiguityCount: 2,
      telemetryGapCount: 1,
      targetAlertCount: 40,
      expectedScoreCeilingNaive: 50,
      expectedMinScoreReference: 85,
    };

  // Base timestamp for the shift
  const shiftEpoch = new Date(baseShiftStartTime ?? "2026-10-12T08:00:00Z").getTime();

  // 3. Environment sampling
  const orgArchetypeId = envRng.pick(family.environmentTemplate.organizationArchetypes);
  const org = vocab.organizations.find((o) => o.id === orgArchetypeId) ?? vocab.organizations[0];

  const networkZones: SocNetworkZone[] = org.zones.map((z) => ({ ...z }));

  // Sample users
  const deptConfigs = vocab.users.departments;
  const numUsers = envRng.int(
    family.environmentTemplate.userDistribution.totalUsers.min,
    family.environmentTemplate.userDistribution.totalUsers.max,
  );

  const users: SocUser[] = [];
  const usedUsernames = new Set<string>();

  for (let i = 0; i < numUsers; i++) {
    const dept = envRng.pick(deptConfigs);
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

  // Ensure at least one IT Admin / Service Account and system principals
  if (!users.some((u) => u.department === "IT Operations")) {
    users.push({
      id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
      username: "itadmin",
      email: `itadmin@${org.domain}`,
      displayName: "IT Administrator",
      department: "IT Operations",
      role: "Systems Administrator",
      riskScore: 15,
    });
  }
  if (!users.some((u) => u.username === "svc-backup")) {
    users.push({
      id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
      username: "svc-backup",
      email: `svc-backup@${org.domain}`,
      displayName: "Service Account - Backup Daemon",
      department: "Infrastructure",
      role: "Service Principal",
      riskScore: 0,
    });
  }
  if (!users.some((u) => u.username === "root")) {
    users.push({
      id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
      username: "root",
      email: `root@${org.domain}`,
      displayName: "Root Administrator (System)",
      department: "Infrastructure",
      role: "System Superuser",
      riskScore: 0,
    });
  }
  if (!users.some((u) => u.username === "system")) {
    users.push({
      id: `usr-${(users.length + 1).toString().padStart(3, "0")}`,
      username: "system",
      email: `system@${org.domain}`,
      displayName: "NT AUTHORITY\\SYSTEM",
      department: "Infrastructure",
      role: "System Principal",
      riskScore: 0,
    });
  }

  // Sample Assets
  const assets: SocAsset[] = [];
  let assetCounter = 1;

  // Workstations
  const wsCount = envRng.int(
    family.environmentTemplate.assetDistribution.workstations.min,
    family.environmentTemplate.assetDistribution.workstations.max,
  );
  for (let i = 0; i < wsCount; i++) {
    const owner = users[i % users.length];
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
  const srvCount = envRng.int(
    family.environmentTemplate.assetDistribution.servers.min,
    family.environmentTemplate.assetDistribution.servers.max,
  );
  for (let i = 0; i < srvCount; i++) {
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

  // 4. Incident chains instantiation
  const incidentCount = Math.min(
    profile.incidentCount,
    family.incidentTemplates.length,
  );
  const shuffledIncTemplates = incRng.shuffle(family.incidentTemplates);
  const selectedIncTemplates = shuffledIncTemplates.slice(0, incidentCount);

  type StagedRawEvent = SocRawEvent & { tempId: string };
  type StagedAlert = SocAlert & { tempId: string; tempIncidentId?: string; isTwin?: boolean };

  const stagedRawEvents: StagedRawEvent[] = [];
  const stagedAlerts: StagedAlert[] = [];
  const incidentsGroundTruth: SocIncidentGroundTruth[] = [];

  // Keep track of used assets and IOCs to avoid unintended collisions
  const assignedVictimAssets = new Set<string>();
  let remainingGaps = profile.telemetryGapCount;

  // External IP pools
  const extIpPools = Object.values(vocab.iocs.externalIps);
  let extIpPoolIndex = 0;

  for (let incIdx = 0; incIdx < selectedIncTemplates.length; incIdx++) {
    const incTemplate = selectedIncTemplates[incIdx];
    const tempIncId = `temp-inc-${incIdx + 1}`;

    // Select victim asset and user not yet compromised
    const availableWorkstations = assets.filter((a) => a.role === "Workstation" && !assignedVictimAssets.has(a.id));
    const victimAsset = availableWorkstations.length > 0 ? incRng.pick(availableWorkstations) : assets[0];
    assignedVictimAssets.add(victimAsset.id);

    const victimUser = users.find((u) => u.username === victimAsset.owner) ?? users[0];
    const targetServer = assets.find((a) => a.role.includes("Staging") || a.role.includes("Database")) ?? assets[1];

    // Select IOCs from pool
    const ipPool = extIpPools[extIpPoolIndex % extIpPools.length];
    extIpPoolIndex++;
    // The pool picks always run (same RNG stream for every version); 1.2.0+ replaces the values.
    const pooledIocs = {
      attackerIp: incRng.pick(ipPool),
      phishingDomain: incRng.pick(vocab.iocs.phishingDomains),
      c2Domain: incRng.pick(vocab.iocs.c2Domains),
      fileHash: incRng.pick(vocab.iocs.fileHashes.maliciousPayloader),
    };
    const { attackerIp, phishingDomain, c2Domain, fileHash } = usesSeededIocs(generatorVersion)
      ? seededIncidentIocs(`${seed}:inc:${incIdx}`, pooledIocs, reservedLiterals(family, vocab))
      : pooledIocs;
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

    // Base jitter offset for this incident
    const incBaseMinutes = timeRng.int(-5, 15);

    for (const stage of incTemplate.stages) {
      const stageOffset = timeRng.int(stage.timingOffsetMinutes.min, stage.timingOffsetMinutes.max);
      const jitter = timeRng.float(-stage.jitterMinutes, stage.jitterMinutes);
      const stageEpoch = shiftEpoch + (incBaseMinutes + stageOffset + jitter) * 60 * 1000;
      const stageTime = formatIsoTime(stageEpoch);

      // Handle telemetry gap
      let isAlertGap = false;
      let isRawGap = false;
      if (stage.telemetryGap && remainingGaps > 0) {
        if (incRng.next() <= stage.telemetryGap.probability) {
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

  // 5. Generate Benign Noise
  const currentIncidentAlertCount = stagedAlerts.length;
  const targetTotal = Math.max(profile.targetAlertCount, Math.round(currentIncidentAlertCount / (1 - profile.noiseRatio)));
  const noiseAlertsNeeded = Math.max(10, targetTotal - currentIncidentAlertCount);

  let noiseGeneratedCount = 0;
  let benignIndex = 0;

  while (noiseGeneratedCount < noiseAlertsNeeded) {
    const benignTpl = family.benignTemplates[benignIndex % family.benignTemplates.length];
    benignIndex++;

    const actorUser = noiseRng.pick(users);
    const targetAsset = noiseRng.pick(assets);
    const scannerIp = "10.10.0.85";
    const roamingIp = NOISE_ROAMING_IP;

    const noiseTokens: Record<string, string | number | boolean> = {
      username: actorUser.username,
      hostname: targetAsset.hostname,
      scannerIp,
      roamingIp,
      orgDomain: org.domain,
    };

    // Calculate time based on pattern
    let timeMinutes = 0;
    if (benignTpl.timePattern === "business_hours") {
      timeMinutes = timeRng.int(10, 240);
    } else if (benignTpl.timePattern === "batch_window_nightly") {
      timeMinutes = timeRng.int(-60, 30);
    } else if (benignTpl.timePattern === "batch_window_maintenance") {
      timeMinutes = timeRng.int(-30, 90);
    } else {
      timeMinutes = timeRng.int(-45, 220);
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

      const iocs: SocAlertIoc[] = (altTpl.iocs ?? []).map((ioc) => ({
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
          acceptableAlternatives: benignTpl.groundTruth.acceptableAlternatives.map((alt) => ({ ...alt })),
          debrief,
        },
      });

      noiseGeneratedCount++;
      if (noiseGeneratedCount >= noiseAlertsNeeded) break;
    }
  }

  // 6. Chronological ordering & Opaque ID Assignment
  // Sort raw events by timestamp ascending
  stagedRawEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Assign opaque event IDs
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

  // Sort alerts by timestamp ascending (arrival order)
  stagedAlerts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Assign opaque alert IDs
  const alertIdMap = new Map<string, string>();
  const finalAlerts: SocAlert[] = stagedAlerts.map((alt, idx) => {
    const finalId = `alt-${(idx + 1).toString().padStart(3, "0")}`;
    alertIdMap.set(alt.tempId, finalId);

    // Map linked raw events to their final opaque IDs
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
        // Will update incidentId in mapping step below
      },
    };
  });

  // Assign opaque incident IDs and map alert references
  const incidentIdMap = new Map<string, string>();
  const finalIncidents: SocIncidentGroundTruth[] = incidentsGroundTruth.map((inc, idx) => {
    const finalIncId = `inc-${(idx + 1).toString().padStart(3, "0")}`;
    incidentIdMap.set(inc.id, finalIncId);

    const finalTpAlertIds = inc.truePositiveAlertIds
      .map((tempAltId) => alertIdMap.get(tempAltId)!)
      .filter(Boolean);

    // Extract sorted alert timestamps for incident timeline
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

  // Update groundTruth.incidentId on alerts with final opaque incident IDs
  for (let i = 0; i < finalAlerts.length; i++) {
    const origStaged = stagedAlerts[i];
    if (origStaged.tempIncidentId && incidentIdMap.has(origStaged.tempIncidentId)) {
      finalAlerts[i].groundTruth.incidentId = incidentIdMap.get(origStaged.tempIncidentId);
    }
  }

  // 7. Briefing & Debrief Synthesis
  const briefing = substituteTokens(family.debriefTemplates.overallBriefingTemplate, {
    orgName: org.name,
    alertCount: finalAlerts.length,
    incidentCount: finalIncidents.length,
  });

  const overallDebrief = substituteTokens(family.debriefTemplates.generalGuidanceTemplate, {
    orgName: org.name,
    alertCount: finalAlerts.length,
    incidentCount: finalIncidents.length,
  });

  // 8. Assemble SocScenario
  const scenario: SocScenario = {
    id: `${family.metadata.id}-${seed.slice(0, 8)}`,
    version: family.metadata.version,
    title: `${family.metadata.title} (Variant ${seed.slice(0, 6)})`,
    level: family.metadata.level,
    estimatedMinutes: family.metadata.estimatedMinutes.max,
    skillsTested: [...family.metadata.skillsTested],
    difficulty,
    briefing,
    seed,
    variantOf: family.metadata.id,
    generatorConfig: {
      generatorVersion: GENERATOR_VERSION,
      familyVersion: family.metadata.version,
      difficulty,
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

  return scenario;
}

/**
 * Compute SHA256 content hash of the generated scenario
 */
export function computeScenarioHash(scenario: SocScenario): string {
  // Hash structural data excluding the volatile seed/id strings
  const payload = {
    version: scenario.version,
    variantOf: scenario.variantOf,
    difficulty: scenario.difficulty,
    assets: scenario.environment.assets.map((a) => a.hostname).sort(),
    users: scenario.environment.users.map((u) => u.username).sort(),
    alerts: scenario.alerts.map((a) => ({
      rule: a.ruleName,
      time: a.timestamp,
      asset: a.relatedAsset,
      disposition: a.groundTruth.correctDisposition,
    })),
    incidents: scenario.groundTruth.incidents.map((i) => ({
      title: i.title,
      tpCount: i.truePositiveAlertIds.length,
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Variant Distance Metric:
 * Computes normalized distance between two variants in [0, 1].
 * 1.0 = completely distinct IOCs, assets, incidents, and noise.
 * 0.0 = identical scenarios.
 */
export function computeVariantDistance(a: SocScenario, b: SocScenario): number {
  // 1. Jaccard distance of IOCs
  const iocsA = new Set(a.alerts.flatMap((alt) => alt.relatedIocs.map((i) => i.value)));
  const iocsB = new Set(b.alerts.flatMap((alt) => alt.relatedIocs.map((i) => i.value)));
  const iocIntersection = [...iocsA].filter((x) => iocsB.has(x)).length;
  const iocUnion = new Set([...iocsA, ...iocsB]).size;
  const iocDist = iocUnion === 0 ? 0 : 1 - iocIntersection / iocUnion;

  // 2. Jaccard distance of victim assets
  const assetsA = new Set(a.environment.assets.map((x) => x.hostname));
  const assetsB = new Set(b.environment.assets.map((x) => x.hostname));
  const assetIntersection = [...assetsA].filter((x) => assetsB.has(x)).length;
  const assetUnion = new Set([...assetsA, ...assetsB]).size;
  const assetDist = assetUnion === 0 ? 0 : 1 - assetIntersection / assetUnion;

  // 3. Incident types distance
  const incsA = new Set(a.groundTruth.incidents.map((x) => x.category));
  const incsB = new Set(b.groundTruth.incidents.map((x) => x.category));
  const incIntersection = [...incsA].filter((x) => incsB.has(x)).length;
  const incUnion = new Set([...incsA, ...incsB]).size;
  const incDist = incUnion === 0 ? 0 : 1 - incIntersection / incUnion;

  // 4. Alert rule sequence distance
  const rulesA = a.alerts.map((x) => x.ruleName).join(",");
  const rulesB = b.alerts.map((x) => x.ruleName).join(",");
  const ruleDist = rulesA === rulesB ? 0 : 1;

  // Weighted composite distance
  return 0.35 * iocDist + 0.25 * assetDist + 0.25 * incDist + 0.15 * ruleDist;
}

export type VariantMetricsSummary = {
  sampleSize: number;
  distinctIocSets: number;
  distinctVictimAssets: number;
  distinctAnswerSets: number;
  minPairwiseDistance: number;
  meanPairwiseDistance: number;
  maxPairwiseDistance: number;
};

/**
 * Evaluates variation guarantees across a sample of generated variants
 */
export function computeVariantMetrics(variants: SocScenario[]): VariantMetricsSummary {
  if (variants.length < 2) {
    return {
      sampleSize: variants.length,
      distinctIocSets: variants.length,
      distinctVictimAssets: variants.length,
      distinctAnswerSets: variants.length,
      minPairwiseDistance: 1,
      meanPairwiseDistance: 1,
      maxPairwiseDistance: 1,
    };
  }

  const iocSetSignatures = new Set<string>();
  const assetSetSignatures = new Set<string>();
  const answerSetSignatures = new Set<string>();

  for (const v of variants) {
    const iocSig = v.alerts
      .flatMap((a) => a.relatedIocs.map((i) => i.value))
      .sort()
      .join("|");
    iocSetSignatures.add(iocSig);

    const assetSig = v.environment.assets.map((a) => a.hostname).sort().join("|");
    assetSetSignatures.add(assetSig);

    const answerSig = v.alerts.map((a) => `${a.id}:${a.groundTruth.correctDisposition}`).join("|");
    answerSetSignatures.add(answerSig);
  }

  let minDistance = 1;
  let maxDistance = 0;
  let totalDistance = 0;
  let pairCount = 0;

  // Sample up to 500 pairs for efficiency
  const step = Math.max(1, Math.floor(variants.length / 30));
  for (let i = 0; i < variants.length; i += step) {
    for (let j = i + 1; j < variants.length; j += step) {
      const dist = computeVariantDistance(variants[i], variants[j]);
      minDistance = Math.min(minDistance, dist);
      maxDistance = Math.max(maxDistance, dist);
      totalDistance += dist;
      pairCount++;
    }
  }

  return {
    sampleSize: variants.length,
    distinctIocSets: iocSetSignatures.size,
    distinctVictimAssets: assetSetSignatures.size,
    distinctAnswerSets: answerSetSignatures.size,
    minPairwiseDistance: Number(minDistance.toFixed(3)),
    meanPairwiseDistance: Number((totalDistance / Math.max(1, pairCount)).toFixed(3)),
    maxPairwiseDistance: Number(maxDistance.toFixed(3)),
  };
}
