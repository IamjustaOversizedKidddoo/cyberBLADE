import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type VocabOrganization = {
  id: string;
  name: string;
  sector: string;
  domain: string;
  workingHours: { startUtc: number; endUtc: number };
  timeZone: string;
  zones: Array<{ id: string; name: string; cidr: string; description: string }>;
};

export type VocabAssetArchetype = {
  role: string;
  osVariants: string[];
  criticalityDefault: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  zoneId: string;
  hostnamePrefix: string;
  tags: string[];
};

export type VocabDepartment = {
  name: string;
  code: string;
  roles: Array<{ title: string; baseRisk: number }>;
};

export type VocabUsers = {
  departments: VocabDepartment[];
  names: {
    firstNames: string[];
    lastNames: string[];
  };
};

export type VocabIocs = {
  externalIps: Record<string, string[]>;
  phishingDomains: string[];
  c2Domains: string[];
  fileHashes: {
    maliciousPayloader: string[];
    benignAdminTools: string[];
  };
  suspiciousProcesses: Array<{
    name: string;
    path: string;
    maliciousArgs: string;
    benignArgs: string;
  }>;
};

export type VocabNoiseArchetype = {
  id: string;
  category: string;
  name: string;
  actorType: string;
  timePattern: string;
  sources: string[];
  summaryTemplate: string;
  disposition: string;
  severity: string;
  escalate: boolean;
};

export type SocVocab = {
  organizations: VocabOrganization[];
  assetArchetypes: VocabAssetArchetype[];
  users: VocabUsers;
  iocs: VocabIocs;
  noiseArchetypes: VocabNoiseArchetype[];
};

let cachedVocab: SocVocab | null = null;

export function loadVocab(): SocVocab {
  if (cachedVocab) return cachedVocab;

  const vocabDir = path.resolve("content/soc/vocab");

  const orgsRaw = parseYaml(fs.readFileSync(path.join(vocabDir, "organizations.yaml"), "utf8"));
  const assetsRaw = parseYaml(fs.readFileSync(path.join(vocabDir, "assets.yaml"), "utf8"));
  const usersRaw = parseYaml(fs.readFileSync(path.join(vocabDir, "users.yaml"), "utf8"));
  const iocsRaw = parseYaml(fs.readFileSync(path.join(vocabDir, "iocs.yaml"), "utf8"));
  const noiseRaw = parseYaml(fs.readFileSync(path.join(vocabDir, "benign-catalog.yaml"), "utf8"));

  cachedVocab = {
    organizations: orgsRaw.organizations,
    assetArchetypes: assetsRaw.assetArchetypes,
    users: {
      departments: usersRaw.departments,
      names: usersRaw.names,
    },
    iocs: {
      externalIps: iocsRaw.externalIps,
      phishingDomains: iocsRaw.phishingDomains,
      c2Domains: iocsRaw.c2Domains,
      fileHashes: iocsRaw.fileHashes,
      suspiciousProcesses: iocsRaw.suspiciousProcesses,
    },
    noiseArchetypes: noiseRaw.noiseArchetypes,
  };

  return cachedVocab;
}
