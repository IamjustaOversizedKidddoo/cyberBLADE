import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { generateEnrichment } from "@/lib/lab-engine/soc/enrichment/generator";
import type { EnrichmentTool, EntityType, WhoisResult, PdnsResult } from "@/lib/lab-engine/soc/enrichment/types";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = parseYaml(fs.readFileSync(filePath, "utf8"));
  return socFamilySchema.parse(raw);
}

describe("Security Guard: SOC Enrichment Zero Outbound Network Isolation", () => {
  let outboundNetworkCalls: Array<{ method: string; target: string }> = [];

  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalDnsLookup = dns.lookup;

  beforeEach(() => {
    outboundNetworkCalls = [];

    // Intercept fetch
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      outboundNetworkCalls.push({ method: "fetch", target });
      throw new Error(`CRITICAL SECURITY FAILURE: Outbound fetch intercepted to ${target}`);
    }) as unknown as typeof fetch;

    // Intercept http.request
    http.request = vi.fn((...args: unknown[]) => {
      const target = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
      outboundNetworkCalls.push({ method: "http.request", target });
      throw new Error(`CRITICAL SECURITY FAILURE: Outbound http.request intercepted to ${target}`);
    }) as unknown as typeof http.request;

    // Intercept https.request
    https.request = vi.fn((...args: unknown[]) => {
      const target = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
      outboundNetworkCalls.push({ method: "https.request", target });
      throw new Error(`CRITICAL SECURITY FAILURE: Outbound https.request intercepted to ${target}`);
    }) as unknown as typeof https.request;

    // Intercept net.Socket.prototype.connect
    net.Socket.prototype.connect = vi.fn((...args: unknown[]) => {
      outboundNetworkCalls.push({ method: "net.Socket.connect", target: JSON.stringify(args[0]) });
      throw new Error(`CRITICAL SECURITY FAILURE: Outbound socket connect intercepted`);
    }) as unknown as typeof net.Socket.prototype.connect;

    // Intercept dns.lookup
    dns.lookup = vi.fn((...args: unknown[]) => {
      outboundNetworkCalls.push({ method: "dns.lookup", target: String(args[0]) });
      throw new Error(`CRITICAL SECURITY FAILURE: Outbound dns.lookup intercepted for ${args[0]}`);
    }) as unknown as typeof dns.lookup;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    net.Socket.prototype.connect = originalSocketConnect;
    dns.lookup = originalDnsLookup;
  });

  const familiesToTest = [
    "soc-f-phishing-cred-01",
    "soc-f-brute-force-auth-01",
    "soc-f-alert-fatigue-01",
    "soc-f-mixed-signal-01",
    "soc-f-outbound-exfil-01",
  ];

  const toolsToTest: Array<{ tool: EnrichmentTool; entityType: EntityType; sample: string }> = [
    { tool: "reputation", entityType: "ip", sample: "198.51.100.24" },
    { tool: "reputation", entityType: "domain", sample: "portal-verify.example" },
    { tool: "reputation", entityType: "hash", sample: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0" },
    { tool: "whois", entityType: "domain", sample: "phishing-bank.example" },
    { tool: "whois", entityType: "ip", sample: "198.51.100.42" },
    { tool: "pdns", entityType: "domain", sample: "c2-control.example" },
    { tool: "pdns", entityType: "ip", sample: "192.0.2.88" },
    { tool: "email_headers", entityType: "email", sample: "alert-001" },
    { tool: "url_analysis", entityType: "url", sample: "https://portal-verify.example/login?token=test" },
    { tool: "sandbox", entityType: "hash", sample: "invoice_doc.vbs" },
    { tool: "pcap_flows", entityType: "ip", sample: "198.51.100.24" },
    { tool: "endpoint_timeline", entityType: "host", sample: "ws-fin-01.corp.internal" },
    { tool: "cmdb", entityType: "host", sample: "ws-fin-01" },
    { tool: "cmdb", entityType: "user", sample: "target.user" },
    { tool: "tickets", entityType: "host", sample: "ws-fin-01" },
    { tool: "tickets", entityType: "ip", sample: "198.51.100.24" },
  ];

  it("verifies zero outbound network, DNS, or socket requests during synthetic enrichment across all 10 tools", () => {
    for (const familyId of familiesToTest) {
      const family = loadFamily(familyId);
      const { scenario } = generateSocVariant(family, `seed-iso-${familyId}`, "intermediate");

      for (const { tool, entityType, sample } of toolsToTest) {
        // Execute generator
        const result = generateEnrichment(scenario, `seed-iso-${familyId}`, tool, entityType, sample);
        expect(result).toBeDefined();
        expect(result.tool).toBe(tool);
        expect(result.data).toBeDefined();

        // Enforce that zero outbound network calls occurred
        expect(outboundNetworkCalls).toHaveLength(0);
      }
    }
  });

  it("verifies synthetic safety: only reserved RFC domains and documentation IP ranges are generated", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "seed-synthetic-audit-42", "intermediate");

    const whoisRes = generateEnrichment(scenario, "seed-synthetic-audit-42", "whois", "domain", "secure-login.example");
    const data = whoisRes.data as WhoisResult;

    expect(data.entity.value).toMatch(/\.(example|test|invalid|corp\.internal|internal)$/i);
    expect(data.nameServers.every((ns: string) => ns.endsWith(".example") || ns.endsWith(".internal"))).toBe(true);

    const pdnsRes = generateEnrichment(scenario, "seed-synthetic-audit-42", "pdns", "domain", "secure-login.example");
    const pdnsData = pdnsRes.data as PdnsResult;
    for (const res of pdnsData.forwardResolutions) {
      // Must be in documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x) or private 10.x / 192.168.x
      expect(
        res.ip.startsWith("192.0.2.") ||
        res.ip.startsWith("198.51.100.") ||
        res.ip.startsWith("203.0.113.") ||
        res.ip.startsWith("10.") ||
        res.ip.startsWith("192.168.")
      ).toBe(true);
    }
  });

  it("verifies absence of real threat intel API keys in process environment", () => {
    const dangerousEnvKeys = [
      "VT_API_KEY",
      "VIRUSTOTAL_API_KEY",
      "ABUSEIPDB_API_KEY",
      "SHODAN_API_KEY",
      "ALIENVAULT_API_KEY",
      "GREYNOISE_API_KEY",
    ];

    for (const key of dangerousEnvKeys) {
      expect(process.env[key]).toBeUndefined();
    }
  });
});
