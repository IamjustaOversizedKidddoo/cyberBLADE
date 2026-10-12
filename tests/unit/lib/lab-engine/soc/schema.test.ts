import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { validateSocScenario } from "@/lib/lab-engine/soc/validator";
import { socScenarioSchema, toClientView, type SocScenario } from "@/lib/lab-engine/soc/schema";

describe("SOC Scenario Schema and Validator", () => {
  it("validates the demo scenario successfully", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    const result = validateSocScenario(parsed, "soc-l1-noisy-shift.yaml");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("catches schema errors on malformed scenarios", () => {
    const malformed = { id: "INVALID_CAPS", version: -1 };
    const result = validateSocScenario(malformed);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("catches unresolved alert references", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    parsed.alerts[0].relatedAsset = "non-existent-host.corp.internal";

    const result = validateSocScenario(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("references unknown asset"))).toBe(true);
  });

  it("catches non-documentation public IP addresses in IOCs or assets", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    parsed.environment.assets[0].ip = "8.8.8.8"; // Public Google DNS - not allowed

    const result = validateSocScenario(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not an RFC 1918 or RFC 5737"))).toBe(true);
  });

  it("catches unauthorized public domains in IOCs or users", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    parsed.alerts[0].relatedIocs.push({ type: "domain", value: "malicious-live-site.com" });

    const result = validateSocScenario(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not an approved reserved domain"))).toBe(true);
  });

  it("catches incidents with no true-positive alerts", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    parsed.groundTruth.incidents[0].truePositiveAlertIds = [];

    const result = validateSocScenario(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("truePositiveAlertIds") || e.includes("has no true positive"))).toBe(true);
  });

  it("catches incidents pointing to false-positive alerts", async () => {
    const raw = await fs.readFile("content/soc/scenarios/soc-l1-noisy-shift.yaml", "utf8");
    const parsed = parseYaml(raw);
    parsed.groundTruth.incidents[0].truePositiveAlertIds = ["alt-018"]; // alt-018 is benign_true_positive

    const result = validateSocScenario(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not kind 'true_positive'"))).toBe(true);
  });
});
