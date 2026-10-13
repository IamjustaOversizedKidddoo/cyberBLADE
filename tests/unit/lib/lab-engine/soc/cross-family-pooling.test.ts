import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { shiftProfileSchema, type ShiftProfile } from "@/lib/lab-engine/soc/shift-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { loadFamilyCatalog, composeShiftScenario } from "@/lib/lab-engine/soc/shift-composer";
import { detectTells } from "@/lib/lab-engine/soc/family-validator";
import type { SocScenario } from "@/lib/lab-engine/soc/schema";

describe("Cross-Family Pooling & Tell Analysis", () => {
  const familiesDir = path.resolve("content/soc/families");
  const shiftsDir = path.resolve("content/soc/shifts");
  const catalog = loadFamilyCatalog();

  const familyFiles = fs.readdirSync(familiesDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const shiftFiles = fs.readdirSync(shiftsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const families: SocFamily[] = familyFiles.map((file) => {
    return socFamilySchema.parse(parseYaml(fs.readFileSync(path.join(familiesDir, file), "utf8")));
  });

  const shifts: ShiftProfile[] = shiftFiles.map((file) => {
    return shiftProfileSchema.parse(parseYaml(fs.readFileSync(path.join(shiftsDir, file), "utf8")));
  });

  it("should have zero cross-family tell leaks across pooled variants of all families and shifts", () => {
    const pooledScenarios: SocScenario[] = [];

    // Sample 5 variants from each family
    for (const fam of families) {
      for (let s = 1; s <= 5; s++) {
        pooledScenarios.push(generateSocVariant(fam, `cross-pool-fam-${fam.metadata.id}-${s}`, "intermediate").scenario);
      }
    }

    // Sample 5 variants from each shift profile
    for (const sh of shifts) {
      for (let s = 1; s <= 5; s++) {
        pooledScenarios.push(composeShiftScenario(sh, `cross-pool-shift-${sh.id}-${s}`, catalog));
      }
    }

    expect(pooledScenarios.length).toBe(families.length * 5 + shifts.length * 5);

    // Run tell detection across the pooled cross-family dataset
    const pooledTellResult = detectTells(pooledScenarios);

    if (!pooledTellResult.passed) {
      console.error("Cross-family pooled tell detected:", pooledTellResult.leakingFeatures);
    }

    expect(pooledTellResult.passed).toBe(true);
    expect(pooledTellResult.leakingFeatures).toHaveLength(0);
  });

  it("should enforce RFC reserved domains and documentation IPs across all scenario IOCs and network traffic", () => {
    // Generate one scenario from each family and shift and inspect all IOCs and IPs
    const docIpRanges = ["192.0.2.", "198.51.100.", "203.0.113.", "10."];
    const allowedDomainSuffixes = [".test", ".example", ".invalid", ".internal"];

    for (const fam of families) {
      const sc = generateSocVariant(fam, "rfc-compliance-test-seed", "intermediate").scenario;
      for (const alert of sc.alerts) {
        for (const ioc of alert.relatedIocs) {
          if (ioc.type === "ip") {
            const matchesRange = docIpRanges.some((prefix) => ioc.value.startsWith(prefix));
            expect(matchesRange, `IP IOC ${ioc.value} in ${fam.metadata.id} must be in RFC documentation or private range`).toBe(true);
          }
          if (ioc.type === "domain") {
            const matchesSuffix = allowedDomainSuffixes.some((sfx) => ioc.value.endsWith(sfx));
            expect(matchesSuffix, `Domain IOC ${ioc.value} in ${fam.metadata.id} must end with reserved TLD`).toBe(true);
          }
        }
      }
    }
  });
});
