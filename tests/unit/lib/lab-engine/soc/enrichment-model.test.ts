import { describe, expect, it } from "vitest";
import { detectEntityType, defangIndicator, refangIndicator } from "@/lib/lab-engine/soc/enrichment/detector";
import { generateEnrichment, resolveEntityRole } from "@/lib/lab-engine/soc/enrichment/generator";
import {
  EnrichmentAwareReferenceSolver,
  LazyEnrichmentSolver,
  ScoreOnlySolver,
} from "@/lib/lab-engine/soc/enrichment/solvers";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = parseYaml(fs.readFileSync(filePath, "utf8"));
  return socFamilySchema.parse(raw);
}
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { toClientView } from "@/lib/lab-engine/soc/schema";
import { evaluateSocAttempt } from "@/lib/lab-engine/soc/evaluator";
import type { ReputationResult, WhoisResult, EmailHeaderAnalysisResult } from "@/lib/lab-engine/soc/enrichment/types";

describe("Enrichment Indicator Detector & Sanitizer", () => {
  it("accurately classifies diverse indicator types", () => {
    expect(detectEntityType("198.51.100.24")).toBe("ip");
    expect(detectEntityType("2001:db8::1")).toBe("ip");
    expect(detectEntityType("portal.example")).toBe("domain");
    expect(detectEntityType("login.corp.internal")).toBe("domain");
    expect(detectEntityType("https://portal.example/login?token=abc")).toBe("url");
    expect(detectEntityType("hxxps://malicious.example/download")).toBe("url");
    expect(detectEntityType("target.user@corp.internal")).toBe("email");
    expect(detectEntityType("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("hash");
    expect(detectEntityType("5d41402abc4b2a76b9719d911017c592")).toBe("hash");
    expect(detectEntityType("ws-fin-01.corp.internal")).toBe("host");
    expect(detectEntityType("srv-app-prod")).toBe("host");
    expect(detectEntityType("usr-jdoe")).toBe("user");
  });

  it("defangs and refangs indicators without data loss", () => {
    const rawUrl = "https://evil.example/download.exe";
    const defanged = defangIndicator(rawUrl);
    expect(defanged).toBe("hxxps://evil[.]example/download[.]exe");
    expect(refangIndicator(defanged)).toBe(rawUrl);

    const rawIp = "198.51.100.42";
    const defangedIp = defangIndicator(rawIp);
    expect(defangedIp).toBe("198[.]51[.]100[.]42");
    expect(refangIndicator(defangedIp)).toBe(rawIp);
  });
});

describe("Deterministic Enrichment Generation & Consistency", () => {
  it("generates byte-identical tool outputs across identical seeds", async () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "test-seed-42", "intermediate");

    const res1 = generateEnrichment(scenario, "test-seed-42", "reputation", "ip", "198.51.100.42");
    const res2 = generateEnrichment(scenario, "test-seed-42", "reputation", "ip", "198.51.100.42");
    expect(JSON.stringify(res1)).toBe(JSON.stringify(res2));

    const whois1 = generateEnrichment(scenario, "test-seed-42", "whois", "domain", "portal.example");
    const whois2 = generateEnrichment(scenario, "test-seed-42", "whois", "domain", "portal.example");
    expect(JSON.stringify(whois1)).toBe(JSON.stringify(whois2));
  });

  it("maintains cross-tool coherence for phishing emails", async () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "test-seed-coherence-99", "intermediate");

    const emailRes = generateEnrichment(scenario, "test-seed-coherence-99", "email_headers", "email", scenario.alerts[0].id);
    const data = emailRes.data as EmailHeaderAnalysisResult;

    expect(data.parsedHeaders.from).toBeDefined();
    expect(data.authentication.spf).toBeDefined();
    expect(data.receivedHops.length).toBeGreaterThan(0);
    // Received hop 1 client IP matches SPF explanation client IP
    expect(data.authentication.spf.clientIp).toBe(data.receivedHops[0].clientIp);
  });

  it("enforces Imperfect Truth: sources can disagree on ambiguous infrastructure", async () => {
    const family = loadFamily("soc-f-mixed-signal-01");
    const { scenario } = generateSocVariant(family, "test-seed-disagreement", "intermediate");

    const rep = generateEnrichment(scenario, "test-seed-disagreement", "reputation", "domain", "cloud-storage.example").data as ReputationResult;
    expect(rep.sources.length).toBeGreaterThan(0);
    // Shared infrastructure returns ambiguous scores and notes
    expect(rep.sources.some((s) => s.score < 80)).toBe(true);
  });
});

describe("Solver Hierarchy: Reference vs Lazy vs Score-Only Solvers", () => {
  function toDecisionRecords(map: Record<string, any>) {
    return Object.values(map).map((d) => ({
      ...d,
      id: d.alertId,
      attemptId: "test-attempt",
      createdAt: new Date().toISOString(),
    }));
  }

  it("proves Reference Solver achieves high accuracy while Naive solvers stay below ceiling", async () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "test-seed-solvers-101", "intermediate");
    const clientView = toClientView(scenario);

    // 1. Reference Solver
    const refResult = EnrichmentAwareReferenceSolver.solve(scenario, clientView, "test-seed-solvers-101");
    const refEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(refResult.decisions), []);

    expect(refEval.percentage).toBeGreaterThanOrEqual(80);
    expect(refResult.stats.totalLookups).toBeGreaterThan(0);
    expect(refResult.stats.totalLookups).toBeLessThanOrEqual(clientView.alerts.length * 2);

    // 2. Lazy Solver (single source)
    const lazyDecisions = LazyEnrichmentSolver.solve(scenario, clientView, "test-seed-solvers-101");
    const lazyEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(lazyDecisions), []);
    expect(lazyEval.percentage).toBeLessThanOrEqual(70);

    // 3. Score-Only Solver
    const scoreDecisions = ScoreOnlySolver.solve(scenario, clientView, "test-seed-solvers-101");
    const scoreEval = evaluateSocAttempt("test-attempt", scenario, toDecisionRecords(scoreDecisions), []);
    expect(scoreEval.percentage).toBeLessThanOrEqual(70);

    // 4. Margin: Reference must beat both naive solvers by at least +15%
    const bestNaiveAccuracy = Math.max(lazyEval.percentage, scoreEval.percentage);
    const margin = refEval.percentage - bestNaiveAccuracy;
    expect(margin).toBeGreaterThanOrEqual(15);
  });
});
