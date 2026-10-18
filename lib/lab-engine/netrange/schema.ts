import { z } from "zod";
import type { NetRangeScenario } from "./types";

export const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
export const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[12][0-9]|3[0-2])$/;
export const flagRegex = /^PENTEST\{[A-Za-z0-9_-]{6,}\}$/;

export const netRangeHttpEndpointSchema = z.object({
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  status: z.number().int().min(100).max(599).default(200),
  body: z.string(),
});

export const netRangeSmbShareSchema = z.object({
  name: z.string().min(1),
  comment: z.string().optional(),
  readOnly: z.boolean().default(true),
  files: z.record(z.string(), z.string()).optional(),
});

export const netRangeFtpDataSchema = z.object({
  anon: z.boolean().default(false),
  files: z.record(z.string(), z.string()).optional(),
});

export const netRangeServiceSchema = z.object({
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(["tcp", "udp"]).default("tcp"),
  name: z.string().min(1),
  version: z.string().optional(),
  banner: z.string().optional(),
  state: z.enum(["open", "closed", "filtered"]).default("open"),
  scripts: z.record(z.string(), z.string()).optional(),
  httpData: z.record(z.string(), netRangeHttpEndpointSchema).optional(),
  smbData: z.array(netRangeSmbShareSchema).optional(),
  ftpData: netRangeFtpDataSchema.optional(),
});

export const netRangeUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().optional(),
  hash: z.string().optional(),
  role: z.enum(["user", "root", "administrator"]).default("user"),
});

export const netRangeFileSchema = z.object({
  content: z.string(),
  owner: z.string().optional(),
  permissions: z.string().optional(),
  isSuid: z.boolean().optional(),
});

export const netRangeSudoRuleSchema = z.object({
  user: z.string().min(1),
  runAs: z.string().min(1).default("root"),
  command: z.string().min(1),
  nopasswd: z.boolean().default(true),
});

export const netRangeVulnEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("shell"),
    targetUser: z.string().min(1),
  }),
  z.object({
    type: z.literal("file_read"),
    revealedFile: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    type: z.literal("cred_disclosure"),
    credentials: z.array(
      z.object({
        user: z.string().min(1),
        pass: z.string().min(1),
      }),
    ),
  }),
]);

export const netRangeVulnerabilitySchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1),
  cve: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  service: z.string().optional(),
  preconditions: z
    .object({
      requiresCreds: z.boolean().optional(),
      requiresPort: z.number().int().min(1).max(65535).optional(),
      requiresPayloadKeyword: z.string().optional(),
    })
    .optional(),
  exploitPayload: z.string().optional(),
  searchsploitTitle: z.string().optional(),
  searchsploitPath: z.string().optional(),
  effect: netRangeVulnEffectSchema,
});

export const netRangeInterfaceSchema = z.object({
  ip: z.string().regex(ipv4Regex, "invalid IPv4 address"),
  subnet: z.string().regex(cidrRegex, "invalid CIDR subnet"),
  mac: z.string().optional(),
});

export const netRangeHostSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  hostname: z.string().min(1),
  os: z.enum(["linux", "windows"]),
  interfaces: z.array(netRangeInterfaceSchema).min(1),
  services: z.array(netRangeServiceSchema).default([]),
  users: z.array(netRangeUserSchema).default([]),
  filesystem: z.record(z.string(), netRangeFileSchema).optional(),
  sudoRules: z.array(netRangeSudoRuleSchema).optional(),
  vulnerabilities: z.array(netRangeVulnerabilitySchema).optional(),
});

export const netRangeSubnetSchema = z.object({
  cidr: z.string().regex(cidrRegex, "invalid CIDR subnet"),
  name: z.string().min(1),
  accessibleFromStart: z.boolean().default(true),
});

export const netRangePivotRuleSchema = z.object({
  targetSubnet: z.string().regex(cidrRegex, "invalid CIDR subnet"),
  viaHost: z.string().min(1),
  requiresCompromise: z.boolean().default(true),
});

export const netRangeFlagSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  flag: z.string().regex(flagRegex, "flag must match PENTEST{...}"),
  hostId: z.string().min(1),
  path: z.string().optional(),
  objectiveId: z.string().min(1),
});

export const netRangeScenarioSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    description: z.string().min(1),
    author: z.string().optional(),
    subnets: z.array(netRangeSubnetSchema).min(1),
    hosts: z.array(netRangeHostSchema).min(1),
    pivotRules: z.array(netRangePivotRuleSchema).optional(),
    flags: z.array(netRangeFlagSchema).min(1),
    attackerTools: z.array(z.string()).optional(),
    wordlists: z.record(z.string(), z.array(z.string())).optional(),
    randomizationPoints: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (s) => new Set(s.hosts.map((h) => h.id)).size === s.hosts.length,
    "host ids must be unique",
  )
  .refine(
    (s) => {
      const hostIds = new Set(s.hosts.map((h) => h.id));
      return s.flags.every((f) => hostIds.has(f.hostId));
    },
    "every flag must reference a valid hostId",
  );

export function parseNetRangeScenario(data: unknown): NetRangeScenario {
  return netRangeScenarioSchema.parse(data);
}
