/**
 * CyberBLADE Investigation Query Language: BladeQL
 * Deterministic Scenario Event Dataset Generator
 *
 * Expands scenario raw events into a high-fidelity 5,000-60,000 record
 * synthetic SIEM log lake matching enterprise volume curves.
 */

import { createRng, type Rng } from "@/lib/generators/rng";
import type { SocScenario } from "../schema";
import type { BladeQLEvent } from "./types";

export interface ScenarioDataset {
  scenarioId: string;
  seed: string;
  eventCount: number;
  events: BladeQLEvent[];
  sources: string[];
  fields: string[];
}

// In-memory LRU-style cache per attempt / scenario variant
const DATASET_CACHE = new Map<string, ScenarioDataset>();

const COMMON_BENIGN_PROCESSES = [
  { process: "explorer.exe", cmd: "C:\\Windows\\explorer.exe", parent: "userinit.exe" },
  { process: "chrome.exe", cmd: "\"C:\\Program Files\\Google\\Chrome\\chrome.exe\" --type=renderer", parent: "chrome.exe" },
  { process: "outlook.exe", cmd: "\"C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE\"", parent: "explorer.exe" },
  { process: "teams.exe", cmd: "\"C:\\Users\\{user}\\AppData\\Local\\Microsoft\\Teams\\Teams.exe\" --process-name Teams.exe", parent: "explorer.exe" },
  { process: "svchost.exe", cmd: "C:\\Windows\\system32\\svchost.exe -k LocalServiceNetworkRestricted -p", parent: "services.exe" },
  { process: "SearchHost.exe", cmd: "C:\\Windows\\SystemApps\\Microsoft.Windows.Search_cw5n1h2txyewy\\SearchHost.exe", parent: "svchost.exe" },
  { process: "OneDrive.exe", cmd: "\"C:\\Users\\{user}\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe\" /background", parent: "explorer.exe" },
];

const COMMON_BENIGN_DOMAINS = [
  "login.microsoftonline.example",
  "portal.office.example",
  "api.github.example",
  "cdn.cloudflare.example",
  "clients2.google.example",
  "telemetry.microsoft.example",
  "s3.dualstack.us-east-1.amazonaws.example",
  "slack-edge.example",
  "zoom.us.example",
];

function pickWeighted<T>(rng: Rng, items: Array<{ item: T; weight: number }>): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = rng.float(0, total);
  for (const entry of items) {
    if (r < entry.weight) return entry.item;
    r -= entry.weight;
  }
  return items[items.length - 1].item;
}

const randBool = (rng: Rng, prob = 0.5) => rng.next() < prob;

export function generateScenarioDataset(
  scenario: SocScenario,
  seed: string,
  targetCountOverride?: number,
): ScenarioDataset {
  const cacheKey = `${scenario.id}:${seed}:${targetCountOverride ?? "auto"}`;
  const cached = DATASET_CACHE.get(cacheKey);
  if (cached) return cached;

  const rng = createRng(`${seed}:bladeql:dataset`);

  // Target event count based on difficulty
  let targetCount = 10000;
  if (targetCountOverride) {
    targetCount = targetCountOverride;
  } else if (scenario.difficulty === "beginner") {
    targetCount = rng.int(5000, 8000);
  } else if (scenario.difficulty === "intermediate") {
    targetCount = rng.int(15000, 25000);
  } else if (scenario.difficulty === "advanced") {
    targetCount = rng.int(35000, 50000);
  }

  const baseShiftEpoch = new Date(
    scenario.rawEvents[0]?.timestamp ?? "2026-10-12T08:00:00Z",
  ).getTime();

  const shiftDurationMs = 8 * 60 * 60 * 1000; // 8-hour shift window
  const assets = scenario.environment.assets;
  const users = scenario.environment.users;

  const datasetEvents: BladeQLEvent[] = [];

  // 1. Incorporate ALL scenario raw events (the ground truth and planted noise)
  // These MUST be preserved with 100% fidelity to match alerts and enrichment views!
  for (const rawEvt of scenario.rawEvents) {
    const norm = normalizeScenarioRawEvent(rawEvt);
    datasetEvents.push(norm);
  }

  // 2. Synthesize background noise stream to reach target count
  const noiseCountNeeded = Math.max(0, targetCount - datasetEvents.length);

  for (let i = 0; i < noiseCountNeeded; i++) {
    // Generate realistic diurnal timing curve (peak during midday)
    const timeRatio = rng.float(0, 1);
    // Beta-like weighting towards middle of shift
    const weightedRatio = 0.5 * timeRatio + 0.5 * Math.sin(timeRatio * Math.PI);
    const eventTime = baseShiftEpoch + Math.floor(weightedRatio * shiftDurationMs);
    const tsIso = new Date(eventTime).toISOString();

    const asset = rng.pick(assets);
    const user = rng.pick(users);

    const streamCategory = pickWeighted(rng, [
      { item: "dns", weight: 35 },
      { item: "firewall", weight: 25 },
      { item: "endpoint", weight: 20 },
      { item: "proxy", weight: 12 },
      { item: "auth", weight: 8 },
    ]);

    let event: BladeQLEvent;

    switch (streamCategory) {
      case "dns": {
        const domain = rng.pick(COMMON_BENIGN_DOMAINS);
        const destIp = `198.51.100.${rng.int(10, 240)}`;
        const queryId = rng.int(1000, 65535);
        event = {
          timestamp: tsIso,
          source: "dns",
          host: asset.hostname,
          user: user.username,
          src_ip: asset.ip,
          dest_ip: "192.0.2.1", // Internal resolver
          src_port: rng.int(49152, 65535),
          dest_port: 53,
          action: "query",
          outcome: "success",
          domain,
          resolved_ip: destIp,
          query_type: "A",
          response_code: "NOERROR",
          _raw: `${tsIso} dns01 named[${rng.int(800, 999)}]: client @0x${rng.hex(6)} ${asset.ip}#${rng.int(40000, 60000)} (${domain}): query: ${domain} IN A + (${destIp}) id=${queryId}`,
        };
        break;
      }

      case "firewall": {
        const isOutbound = randBool(rng, 0.8);
        const srcIp = isOutbound ? asset.ip : `198.51.100.${rng.int(1, 250)}`;
        const destIp = isOutbound ? `198.51.100.${rng.int(1, 250)}` : asset.ip;
        const port = rng.pick([443, 80, 53, 8080, 22]);
        const bytesIn = rng.int(500, 15000);
        const bytesOut = rng.int(200, 50000);
        const action = randBool(rng, 0.98) ? "allow" : "deny";

        event = {
          timestamp: tsIso,
          source: "firewall",
          host: "fw-edge-01.corp.internal",
          user: user.username,
          src_ip: srcIp,
          dest_ip: destIp,
          src: srcIp, // source-native alias
          dst: destIp,
          src_port: rng.int(49152, 65535),
          dest_port: port,
          protocol: "TCP",
          action,
          outcome: action === "allow" ? "permitted" : "blocked",
          bytes_in: bytesIn,
          bytes_out: bytesOut,
          _raw: `${tsIso} fw-edge-01 ASA: %ASA-6-302013: Built outbound TCP connection ${rng.int(100000, 999999)} for outside:${destIp}/${port} (${destIp}/${port}) to inside:${srcIp}/${rng.int(40000, 65000)} (${srcIp}) action=${action}`,
        };
        break;
      }

      case "endpoint": {
        const procTemplate = rng.pick(COMMON_BENIGN_PROCESSES);
        const cmd = procTemplate.cmd.replace("{user}", user.username);
        const pid = rng.int(1000, 9999);
        const ppid = rng.int(400, 2000);

        event = {
          timestamp: tsIso,
          source: "endpoint",
          host: asset.hostname,
          user: user.username,
          process: procTemplate.process,
          command_line: cmd,
          parent_process: procTemplate.parent,
          action: "process_create",
          outcome: "success",
          pid,
          ppid,
          EventCode: 4688, // native Windows Security Event Code
          _raw: `Microsoft-Windows-Security-Auditing: EventId=4688 TimeGenerated=${tsIso} ComputerName=${asset.hostname} SubjectUserName=${user.username} NewProcessName=${procTemplate.process} CommandLine=${cmd} ParentProcessName=${procTemplate.parent}`,
        };
        break;
      }

      case "proxy": {
        const domain = rng.pick(COMMON_BENIGN_DOMAINS);
        const method = rng.pick(["GET", "POST", "CONNECT"]);
        const statusCode = rng.pick([200, 200, 200, 304, 204]);
        const bytes = rng.int(800, 64000);
        const url = `https://${domain}/api/v1/sync?client=workstation`;

        event = {
          timestamp: tsIso,
          source: "proxy",
          host: "proxy01.corp.internal",
          user: user.username,
          client_ip: asset.ip, // source-native alias
          src_ip: asset.ip,
          dest_ip: `198.51.100.${rng.int(10, 250)}`,
          dest_port: 443,
          http_method: method,
          cs_method: method, // native alias
          domain,
          url,
          status_code: statusCode,
          bytes_out: bytes,
          bytes_in: Math.floor(bytes / 3),
          action: "allow",
          outcome: "success",
          user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          _raw: `${tsIso} 192.0.2.10 proxy01 ${asset.ip} ${user.username} ${method} ${url} ${statusCode} ${bytes} bytes_in=${Math.floor(bytes / 3)} action=allow`,
        };
        break;
      }

      case "auth":
      default: {
        const isSuccess = randBool(rng, 0.95);
        const action = "logon";
        const outcome = isSuccess ? "success" : "failure";
        const eventCode = isSuccess ? 4624 : 4625;

        event = {
          timestamp: tsIso,
          source: "auth",
          host: asset.hostname,
          user: user.username,
          src_ip: asset.ip,
          dest_ip: "192.0.2.5", // Domain Controller
          action,
          outcome,
          logon_type: 2, // Interactive
          EventCode: eventCode,
          auth_protocol: "Kerberos",
          _raw: `Microsoft-Windows-Security-Auditing: EventId=${eventCode} TimeGenerated=${tsIso} ComputerName=${asset.hostname} TargetUserName=${user.username} WorkstationName=${asset.hostname} IpAddress=${asset.ip} Status=${outcome}`,
        };
        break;
      }
    }

    datasetEvents.push(event);
  }

  // 3. Chronological sorting (CRITICAL: never sort by generation order!)
  datasetEvents.sort((a, b) => {
    const tA = String(a.timestamp);
    const tB = String(b.timestamp);
    return tA < tB ? -1 : tA > tB ? 1 : 0;
  });

  // 4. Assign uniform opaque IDs
  for (let idx = 0; idx < datasetEvents.length; idx++) {
    datasetEvents[idx].id = `evt-${(idx + 1).toString().padStart(5, "0")}`;
  }

  // Extract source & field catalogs
  const sourceSet = new Set<string>();
  const fieldSet = new Set<string>();

  for (const evt of datasetEvents) {
    if (evt.source) sourceSet.add(String(evt.source));
    for (const k of Object.keys(evt)) {
      if (!k.startsWith("__")) fieldSet.add(k);
    }
  }

  const result: ScenarioDataset = {
    scenarioId: scenario.id,
    seed,
    eventCount: datasetEvents.length,
    events: datasetEvents,
    sources: Array.from(sourceSet),
    fields: Array.from(fieldSet),
  };

  DATASET_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Normalizes scenario raw events from generator into uniform BladeQLEvent shape
 */
type RawScenarioEvent = SocScenario["rawEvents"][number];

function normalizeScenarioRawEvent(rawEvt: RawScenarioEvent): BladeQLEvent {
  const norm: BladeQLEvent = {
    id: rawEvt.id,
    timestamp: rawEvt.timestamp,
    source: rawEvt.source,
    action: rawEvt.action,
    message: rawEvt.message,
    _raw: rawEvt.raw ?? `${rawEvt.timestamp} [${rawEvt.source}] ${rawEvt.action}: ${rawEvt.message}`,
  };

  // Flatten structured fields
  if (rawEvt.fields && typeof rawEvt.fields === "object") {
    for (const [k, v] of Object.entries(rawEvt.fields)) {
      norm[k] = v as BladeQLEvent[string];
    }
  }

  return norm;
}
