import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import { generateScenarioDataset } from "@/lib/lab-engine/soc/query/dataset-generator";
import { executeBladeQL } from "@/lib/lab-engine/soc/query/engine";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = fs.readFileSync(filePath, "utf8");
  return socFamilySchema.parse(parseYaml(raw));
}

describe("BladeQL Part C: Scenario Dataset Generation, Schema & Consistency", () => {
  it("generates a 5,000+ record deterministic dataset with zero ground-truth leaks", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "seed-dataset-test-42", "beginner");

    const dataset = generateScenarioDataset(scenario, "seed-dataset-test-42", 5000);

    expect(dataset.eventCount).toBeGreaterThanOrEqual(5000);
    expect(dataset.events.length).toBe(dataset.eventCount);

    // 1. Check opaque ID format
    expect(dataset.events[0].id).toBe("evt-00001");
    expect(dataset.events[100].id).toBe("evt-00101");

    // 2. Check strict chronological ordering
    for (let i = 1; i < dataset.events.length; i++) {
      const prev = String(dataset.events[i - 1].timestamp);
      const curr = String(dataset.events[i].timestamp);
      expect(curr >= prev).toBe(true);
    }

    // 3. Check ground-truth leak prevention
    const BANNED_LEAK_KEYS = [
      "is_malicious",
      "ground_truth",
      "scenario_verdict",
      "incident_id",
      "alert_id",
      "root_cause",
      "rootCause",
      "attacker",
      "victim",
      "benign_twin",
    ];

    const allKeys = new Set<string>();
    for (const evt of dataset.events) {
      for (const key of Object.keys(evt)) {
        allKeys.add(key.toLowerCase());
      }
    }
    for (const key of allKeys) {
      for (const banned of BANNED_LEAK_KEYS) {
        expect(key).not.toContain(banned);
      }
    }

    // 4. Traceability: Verify scenario raw events are embedded in dataset
    const scenarioRawTimestamps = new Set(scenario.rawEvents.map((r) => r.timestamp));
    const datasetTimestamps = new Set(dataset.events.map((e) => e.timestamp));

    for (const ts of scenarioRawTimestamps) {
      expect(datasetTimestamps.has(ts)).toBe(true);
    }
  });

  it("executes BladeQL investigative pipelines across the generated log lake", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "seed-query-lake-01", "beginner");
    const dataset = generateScenarioDataset(scenario, "seed-query-lake-01", 5000);

    const q = "source=dns | stats count by domain | sort -count | head 5";
    const res = executeBladeQL(q, dataset.events);

    expect(res.events.length).toBeLessThanOrEqual(5);
    expect(res.fields).toContain("domain");
    expect(res.fields).toContain("count");
  });
});
