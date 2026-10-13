import { z } from "zod";
import type { SocSeverity } from "../schema";

/**
 * Supported indicator types for Tier-1 SOC investigation
 */
export const ENTITY_TYPES = [
  "ip",
  "domain",
  "url",
  "hash",
  "email",
  "user",
  "host",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export const entityTypeSchema = z.enum(ENTITY_TYPES);

/**
 * Server-only hidden ground-truth role of an entity in the scenario.
 * Strictly stripped before returning to client.
 */
export const ENTITY_ROLES = [
  "attacker_infra",
  "victim",
  "benign_business",
  "shared_infra",
  "scanner",
  "partner",
] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];
export const entityRoleSchema = z.enum(ENTITY_ROLES);

/**
 * Supported simulated investigation tools
 */
export const ENRICHMENT_TOOLS = [
  "reputation",
  "whois",
  "pdns",
  "email_headers",
  "url_analysis",
  "sandbox",
  "pcap_flows",
  "endpoint_timeline",
  "cmdb",
  "tickets",
] as const;
export type EnrichmentTool = (typeof ENRICHMENT_TOOLS)[number];
export const enrichmentToolSchema = z.enum(ENRICHMENT_TOOLS);

// ---------------------------------------------------------------------------
// 1. Indicator Reputation & Context Panel Schemas
// ---------------------------------------------------------------------------
export const reputationSourceVerdictSchema = z.enum(["clean", "suspicious", "malicious", "unknown"]);
export type ReputationSourceVerdict = z.infer<typeof reputationSourceVerdictSchema>;

export const reputationSourceReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  verdict: reputationSourceVerdictSchema,
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  enginesFlagged: z.number().int().nonnegative().optional(),
  totalEngines: z.number().int().positive().optional(),
  notes: z.string(),
});
export type ReputationSourceReport = z.infer<typeof reputationSourceReportSchema>;

export const relatedEntitySchema = z.object({
  type: entityTypeSchema,
  value: z.string(),
  relationship: z.string(),
});
export type RelatedEntity = z.infer<typeof relatedEntitySchema>;

export const reputationResultSchema = z.object({
  entity: z.object({
    type: entityTypeSchema,
    value: z.string(),
  }),
  hasData: z.boolean(),
  disagreement: z.boolean(),
  disagreementSummary: z.string().nullable(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  sources: z.array(reputationSourceReportSchema),
  relatedEntities: z.array(relatedEntitySchema),
  commentary: z.array(
    z.object({
      source: z.string(),
      author: z.string(),
      timestamp: z.string(),
      comment: z.string(),
    }),
  ),
});
export type ReputationResult = z.infer<typeof reputationResultSchema>;

// ---------------------------------------------------------------------------
// 2. WHOIS & Registration Record Schemas
// ---------------------------------------------------------------------------
export const whoisResultSchema = z.object({
  entity: z.object({
    type: z.enum(["domain", "ip"]),
    value: z.string(),
  }),
  hasData: z.boolean(),
  registered: z.boolean(),
  registrar: z.string(),
  registrationDate: z.string().nullable(),
  updatedDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  nameServers: z.array(z.string()),
  privacyProtected: z.boolean(),
  registrantOrg: z.string(),
  registrantCountry: z.string(),
  asn: z.string(),
  asnOrg: z.string(),
  cidr: z.string(),
  hostingProvider: z.string(),
  rawRecord: z.string(),
});
export type WhoisResult = z.infer<typeof whoisResultSchema>;

// ---------------------------------------------------------------------------
// 3. Passive DNS (pDNS) Resolution Schemas
// ---------------------------------------------------------------------------
export const pdnsForwardRecordSchema = z.object({
  domain: z.string(),
  ip: z.string(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  count: z.number().int().positive(),
  isShared: z.boolean(),
});
export type PdnsForwardRecord = z.infer<typeof pdnsForwardRecordSchema>;

export const pdnsReverseRecordSchema = z.object({
  ip: z.string(),
  domain: z.string(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  count: z.number().int().positive(),
});
export type PdnsReverseRecord = z.infer<typeof pdnsReverseRecordSchema>;

export const pdnsResultSchema = z.object({
  entity: z.object({
    type: z.enum(["domain", "ip"]),
    value: z.string(),
  }),
  hasData: z.boolean(),
  forwardResolutions: z.array(pdnsForwardRecordSchema),
  reverseResolutions: z.array(pdnsReverseRecordSchema),
  sharedHostingInference: z.string().nullable(),
});
export type PdnsResult = z.infer<typeof pdnsResultSchema>;

// ---------------------------------------------------------------------------
// 4. Email Header Analyzer Schemas
// ---------------------------------------------------------------------------
export const emailReceivedHopSchema = z.object({
  hopNumber: z.number().int().positive(),
  fromHost: z.string(),
  byHost: z.string(),
  clientIp: z.string(),
  timestamp: z.string(),
  delaySeconds: z.number().int().nonnegative(),
  rDnsMatch: z.boolean(),
});
export type EmailReceivedHop = z.infer<typeof emailReceivedHopSchema>;

export const emailAuthStatusSchema = z.enum(["pass", "fail", "softfail", "neutral", "none"]);
export type EmailAuthStatus = z.infer<typeof emailAuthStatusSchema>;

export const emailAuthResultSchema = z.object({
  spf: z.object({
    status: emailAuthStatusSchema,
    domain: z.string(),
    clientIp: z.string(),
    explanation: z.string(),
  }),
  dkim: z.object({
    status: emailAuthStatusSchema,
    domain: z.string(),
    selector: z.string(),
    explanation: z.string(),
  }),
  dmarc: z.object({
    status: emailAuthStatusSchema,
    policy: z.enum(["none", "quarantine", "reject", "none_policy"]),
    alignment: z.object({
      spfAligned: z.boolean(),
      dkimAligned: z.boolean(),
    }),
    explanation: z.string(),
  }),
});
export type EmailAuthResult = z.infer<typeof emailAuthResultSchema>;

export const emailHeaderMismatchSchema = z.object({
  field: z.string(),
  issue: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  explanation: z.string(),
});
export type EmailHeaderMismatch = z.infer<typeof emailHeaderMismatchSchema>;

export const emailBodyLinkSchema = z.object({
  visibleText: z.string(),
  actualUrl: z.string(),
  defangedUrl: z.string(),
  isMismatch: z.boolean(),
  riskNote: z.string().nullable(),
});
export type EmailBodyLink = z.infer<typeof emailBodyLinkSchema>;

export const emailAttachmentDescriptorSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  hashSha256: z.string(),
  extension: z.string(),
  riskCategory: z.enum(["script", "executable", "macro_document", "archive", "document_safe", "image"]),
});
export type EmailAttachmentDescriptor = z.infer<typeof emailAttachmentDescriptorSchema>;

export const emailHeaderAnalysisResultSchema = z.object({
  parsedHeaders: z.object({
    messageId: z.string(),
    date: z.string(),
    from: z.string(),
    fromDomain: z.string(),
    returnPath: z.string(),
    returnPathDomain: z.string(),
    replyTo: z.string().nullable(),
    replyToDomain: z.string().nullable(),
    to: z.string(),
    subject: z.string(),
    xHeaders: z.record(z.string(), z.string()),
  }),
  receivedHops: z.array(emailReceivedHopSchema),
  authentication: emailAuthResultSchema,
  mismatches: z.array(emailHeaderMismatchSchema),
  bodyLinks: z.array(emailBodyLinkSchema),
  attachments: z.array(emailAttachmentDescriptorSchema),
  rawHeaders: z.string(),
});
export type EmailHeaderAnalysisResult = z.infer<typeof emailHeaderAnalysisResultSchema>;

// ---------------------------------------------------------------------------
// 5. URL Analysis Schemas
// ---------------------------------------------------------------------------
export const urlRedirectHopSchema = z.object({
  step: z.number().int().positive(),
  status: z.number().int(),
  url: z.string(),
  defangedUrl: z.string(),
  location: z.string().nullable(),
});
export type UrlRedirectHop = z.infer<typeof urlRedirectHopSchema>;

export const urlAnalysisResultSchema = z.object({
  url: z.string(),
  defanged: z.string(),
  parsed: z.object({
    scheme: z.string(),
    host: z.string(),
    port: z.number().int(),
    path: z.string(),
    queryParams: z.record(z.string(), z.string()),
  }),
  redirectChain: z.array(urlRedirectHopSchema),
  pageBehavior: z.object({
    title: z.string(),
    hasLoginForm: boolean(),
    requestsCredentials: boolean(),
    triggersScriptDownload: boolean(),
    abstractSummary: z.string(),
    wireframePlaceholder: z.enum(["login_form", "cloud_download", "error_page", "blank_page", "corporate_portal"]),
  }),
  reputationVerdict: reputationSourceVerdictSchema,
  riskFactors: z.array(z.string()),
});
export type UrlAnalysisResult = z.infer<typeof urlAnalysisResultSchema>;

// ---------------------------------------------------------------------------
// 6. File & Dynamic Sandbox Detonation Report Schemas
// ---------------------------------------------------------------------------
export const sandboxBehaviorSummarySchema = z.object({
  processCreation: z.array(z.string()),
  fileWrites: z.array(z.string()),
  registryModifications: z.array(z.string()),
  networkConnections: z.array(
    z.object({
      proto: z.enum(["TCP", "UDP", "DNS", "HTTP"]),
      destination: z.string(),
      port: z.number().int(),
      summary: z.string(),
    }),
  ),
  persistenceMechanisms: z.array(z.string()),
});
export type SandboxBehaviorSummary = z.infer<typeof sandboxBehaviorSummarySchema>;

export const sandboxReportResultSchema = z.object({
  file: z.object({
    filename: z.string(),
    hashSha256: z.string(),
    hashMd5: z.string(),
    sizeBytes: z.number().int(),
    mimeType: z.string(),
    entropy: z.number().min(0).max(8),
    fileTypeDescription: z.string(),
  }),
  hasData: z.boolean(),
  verdict: reputationSourceVerdictSchema,
  threatScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  analysisDurationSeconds: z.number(),
  behavior: sandboxBehaviorSummarySchema,
  evasionDetected: z.boolean(),
  sandboxNotes: z.string(),
});
export type SandboxReportResult = z.infer<typeof sandboxReportResultSchema>;

// ---------------------------------------------------------------------------
// 7. Network Flow & Packet Evidence Schemas
// ---------------------------------------------------------------------------
export const flowRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  srcIp: z.string(),
  srcPort: z.number().int(),
  dstIp: z.string(),
  dstPort: z.number().int(),
  protocol: z.enum(["TCP", "UDP", "ICMP"]),
  bytesSent: z.number().int().nonnegative(),
  bytesReceived: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  packets: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  flags: z.string(),
  summary: z.string(),
});
export type FlowRecord = z.infer<typeof flowRecordSchema>;

export const syntheticPacketSchema = z.object({
  id: z.number().int().positive(),
  timestamp: z.string(),
  srcIp: z.string(),
  dstIp: z.string(),
  protocol: z.enum(["TCP", "UDP", "DNS", "HTTP", "TLS", "ICMP"]),
  length: z.number().int().positive(),
  info: z.string(),
  rawHex: z.string(),
  payloadAscii: z.string(),
});
export type SyntheticPacket = z.infer<typeof syntheticPacketSchema>;

export const pcapFlowsResultSchema = z.object({
  filterApplied: z.string().optional(),
  totalFlows: z.number().int().nonnegative(),
  flows: z.array(flowRecordSchema),
  packets: z.array(syntheticPacketSchema).optional(),
  analytics: z.object({
    topTalkers: z.array(z.object({ ip: z.string(), bytes: z.number().int() })),
    dnsQueries: z.array(z.object({ query: z.string(), count: z.number().int() })),
    periodicity: z.object({
      detected: z.boolean(),
      intervalSeconds: z.number().optional(),
      confidence: z.number().min(0).max(100).optional(),
      summary: z.string(),
    }),
  }),
});
export type PcapFlowsResult = z.infer<typeof pcapFlowsResultSchema>;

// ---------------------------------------------------------------------------
// 8. Endpoint Process Tree & Timeline Schemas
// ---------------------------------------------------------------------------
export type ProcessTreeNode = {
  pid: number;
  ppid: number;
  processName: string;
  commandLine: string;
  user: string;
  integrityLevel: "SYSTEM" | "High" | "Medium" | "Low";
  timestamp: string;
  hash?: string;
  isAnomalous?: boolean;
  children: ProcessTreeNode[];
};

export const processTreeNodeSchema: z.ZodType<ProcessTreeNode> = z.lazy(() =>
  z.object({
    pid: z.number().int(),
    ppid: z.number().int(),
    processName: z.string(),
    commandLine: z.string(),
    user: z.string(),
    integrityLevel: z.enum(["SYSTEM", "High", "Medium", "Low"]),
    timestamp: z.string(),
    hash: z.string().optional(),
    isAnomalous: z.boolean().optional(),
    children: z.array(processTreeNodeSchema),
  }),
);

export const endpointEventRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.enum(["process_start", "process_end", "file_create", "file_delete", "registry_write", "net_connect", "logon"]),
  user: z.string(),
  details: z.string(),
  pid: z.number().int().optional(),
  targetPath: z.string().optional(),
});
export type EndpointEventRecord = z.infer<typeof endpointEventRecordSchema>;

export const endpointTimelineResultSchema = z.object({
  hostname: z.string(),
  os: z.string(),
  processTree: z.array(processTreeNodeSchema),
  timelineEvents: z.array(endpointEventRecordSchema),
  telemetryGaps: z.array(
    z.object({
      startTime: z.string(),
      endTime: z.string(),
      durationMinutes: z.number(),
      reason: z.string(),
    }),
  ),
});
export type EndpointTimelineResult = z.infer<typeof endpointTimelineResultSchema>;

// ---------------------------------------------------------------------------
// 9. Asset & Identity Directory (CMDB/IdP) Schemas
// ---------------------------------------------------------------------------
export const cmdbAssetCardSchema = z.object({
  kind: z.literal("asset"),
  id: z.string(),
  hostname: z.string(),
  ip: z.string(),
  os: z.string(),
  role: z.string(),
  owner: z.string(),
  department: z.string(),
  zone: z.string(),
  criticality: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  tags: z.array(z.string()),
  maintenanceWindows: z.array(z.string()),
  lastAudited: z.string(),
  isStale: z.boolean(),
  staleNotice: z.string().nullable(),
});
export type CmdbAssetCard = z.infer<typeof cmdbAssetCardSchema>;

export const cmdbUserCardSchema = z.object({
  kind: z.literal("user"),
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  department: z.string(),
  role: z.string(),
  manager: z.string(),
  workingHours: z.string(),
  privilegedGroups: z.array(z.string()),
  mfaEnforced: z.boolean(),
  mfaMethod: z.string(),
  riskScore: z.number().min(0).max(100),
  recentSignIns: z.array(
    z.object({
      timestamp: z.string(),
      ip: z.string(),
      location: z.string(),
      status: z.enum(["success", "failed"]),
      clientApp: z.string(),
    }),
  ),
  isStale: z.boolean(),
  staleNotice: z.string().nullable(),
});
export type CmdbUserCard = z.infer<typeof cmdbUserCardSchema>;

export const cmdbResultSchema = z.object({
  entity: z.object({
    type: entityTypeSchema,
    value: z.string(),
  }),
  hasData: z.boolean(),
  record: z.union([cmdbAssetCardSchema, cmdbUserCardSchema]).nullable(),
});
export type CmdbResult = z.infer<typeof cmdbResultSchema>;

// ---------------------------------------------------------------------------
// 10. Internal Case & Ticket History Schemas
// ---------------------------------------------------------------------------
export const serviceTicketRecordSchema = z.object({
  id: z.string(),
  category: z.enum(["change_request", "scheduled_maintenance", "incident", "access_request", "pen_test_notice"]),
  title: z.string(),
  submitter: z.string(),
  approver: z.string(),
  status: z.enum(["approved", "completed", "in_progress", "rejected", "closed"]),
  targetEntity: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  notes: z.string(),
  relevanceExplanation: z.string(),
});
export type ServiceTicketRecord = z.infer<typeof serviceTicketRecordSchema>;

export const ticketHistoryResultSchema = z.object({
  entity: z.object({
    type: entityTypeSchema,
    value: z.string(),
  }),
  hasData: z.boolean(),
  tickets: z.array(serviceTicketRecordSchema),
});
export type TicketHistoryResult = z.infer<typeof ticketHistoryResultSchema>;

// ---------------------------------------------------------------------------
// Unified Polymorphic Tool Result
// ---------------------------------------------------------------------------
export type EnrichmentResultPayload =
  | { tool: "reputation"; data: ReputationResult }
  | { tool: "whois"; data: WhoisResult }
  | { tool: "pdns"; data: PdnsResult }
  | { tool: "email_headers"; data: EmailHeaderAnalysisResult }
  | { tool: "url_analysis"; data: UrlAnalysisResult }
  | { tool: "sandbox"; data: SandboxReportResult }
  | { tool: "pcap_flows"; data: PcapFlowsResult }
  | { tool: "endpoint_timeline"; data: EndpointTimelineResult }
  | { tool: "cmdb"; data: CmdbResult }
  | { tool: "tickets"; data: TicketHistoryResult };

/** Client response format returned by API */
export const enrichmentLookupResponseSchema = z.object({
  lookupId: z.string(),
  attemptId: z.string(),
  tool: enrichmentToolSchema,
  entityType: entityTypeSchema,
  entityValue: z.string(),
  serverTimestamp: z.string(),
  executionTimeMs: z.number(),
  payload: z.unknown(), // polymorphic payload validated above
});
export type EnrichmentLookupResponse = z.infer<typeof enrichmentLookupResponseSchema>;

/** Database immutable lookup log record */
export type SocEnrichmentLookupRecord = {
  id: string;
  attemptId: string;
  tool: EnrichmentTool;
  entityType: EntityType;
  entityValue: string;
  responseHash: string;
  createdAt: string;
};
