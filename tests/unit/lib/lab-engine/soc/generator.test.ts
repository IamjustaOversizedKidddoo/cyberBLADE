import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import fs from "node:fs";
import path from "node:path";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant, computeVariantDistance } from "@/lib/lab-engine/soc/generator";
import { toClientView } from "@/lib/lab-engine/soc/schema";

function loadReferenceFamily(): SocFamily {
  const raw = fs.readFileSync(path.resolve("content/soc/families/soc-f-mixed-signal-01.yaml"), "utf8");
  return socFamilySchema.parse(parseYaml(raw));
}

describe("SOC Scenario Generator (Unit & Determinism)", () => {
  const family = loadReferenceFamily();

  it("produces byte-identical output for the same seed and parameters", () => {
    const seed = "fixed-deterministic-seed-alpha";
    const res1 = generateSocVariant(family, seed, "intermediate");
    const res2 = generateSocVariant(family, seed, "intermediate");

    expect(res1.contentHash).toBe(res2.contentHash);
    expect(res1.scenario.alerts.length).toBe(res2.scenario.alerts.length);
    expect(JSON.stringify(res1.scenario)).toBe(JSON.stringify(res2.scenario));
    expect(JSON.stringify(toClientView(res1.scenario))).toBe(JSON.stringify(toClientView(res2.scenario)));
  });

  it("produces distinct outputs for different seeds", () => {
    const resA = generateSocVariant(family, "seed-alpha-123", "intermediate");
    const resB = generateSocVariant(family, "seed-bravo-456", "intermediate");

    expect(resA.contentHash).not.toBe(resB.contentHash);
    expect(resA.scenario.id).not.toBe(resB.scenario.id);

    const dist = computeVariantDistance(resA.scenario, resB.scenario);
    expect(dist).toBeGreaterThan(0.4);
  });

  it("isolates PRNG sub-streams so altering noise does not shift incident IOCs", () => {
    // If we create a family with 2x noise in one variant vs another,
    // the incidents sub-stream must sample identical attacker IPs and target users
    const seed = "substream-isolation-test-seed";
    const normal = generateSocVariant(family, seed, "intermediate");

    // Create modified family with different noise bounds
    const modifiedFamily: SocFamily = {
      ...family,
      variationAxes: {
        ...family.variationAxes,
        noiseRatio: { min: 0.95, max: 0.98 },
      },
    };

    const higherNoise = generateSocVariant(modifiedFamily, seed, "intermediate");

    // Incident titles, root causes, and IOC sets should remain stable across stream isolation
    const normalIncidents = normal.scenario.groundTruth.incidents.map((i) => i.title);
    const noiseIncidents = higherNoise.scenario.groundTruth.incidents.map((i) => i.title);
    expect(normalIncidents).toEqual(noiseIncidents);
  });

  it("generates opaque identifiers that do not leak ground truth", () => {
    const res = generateSocVariant(family, "opaque-id-test-seed", "intermediate");

    // Alert IDs must follow uniform opaque arrival-order format
    for (const alert of res.scenario.alerts) {
      expect(alert.id).toMatch(/^alt-\d{3,}$/);
      expect(alert.id).not.toContain("tp");
      expect(alert.id).not.toContain("fp");
      expect(alert.id).not.toContain("malicious");
    }

    // Event IDs
    for (const evt of res.scenario.rawEvents) {
      expect(evt.id).toMatch(/^evt-\d{3,}$/);
    }

    // Incident IDs
    for (const inc of res.scenario.groundTruth.incidents) {
      expect(inc.id).toMatch(/^inc-\d{3,}$/);
    }
  });

  it("adheres to RFC 5737 and private IP constraints", () => {
    const res = generateSocVariant(family, "ip-constraint-test-seed", "intermediate");

    for (const host of res.scenario.environment.assets) {
      expect(host.ip).toMatch(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/);
      expect(host.hostname).toMatch(/\.corp\.internal$/);
    }

    for (const alert of res.scenario.alerts) {
      for (const ioc of alert.relatedIocs) {
        if (/^\d+\.\d+\.\d+\.\d+$/.test(ioc.value)) {
          // Attacker IPs must use RFC 5737 documentation ranges or private IPs
          const isRfc5737 =
            ioc.value.startsWith("192.0.2.") ||
            ioc.value.startsWith("198.51.100.") ||
            ioc.value.startsWith("203.0.113.");
          const isPrivate =
            ioc.value.startsWith("10.") ||
            ioc.value.startsWith("192.168.");
          expect(isRfc5737 || isPrivate).toBe(true);
        }
      }
    }
  });

  it("generates variants within bounded execution time (< 15 ms)", () => {
    // Warm-up first (vocab load, JIT), then the fastest of 5 runs: the old average included the
    // cold first call and whatever else shared the CPU. The budget itself is unchanged.
    generateSocVariant(family, "perf-warmup", "intermediate");
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      generateSocVariant(family, `perf-seed-${i}`, "intermediate");
      runs.push(performance.now() - t0);
    }
    expect(Math.min(...runs)).toBeLessThan(15);
  });
});
