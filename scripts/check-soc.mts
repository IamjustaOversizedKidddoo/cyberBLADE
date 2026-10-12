import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { validateSocScenario } from "../lib/lab-engine/soc/validator";
import type { SocScenario } from "../lib/lab-engine/soc/schema";

async function main(): Promise<number> {
  const dir = path.resolve("content/soc/scenarios");
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch (err) {
    console.error(`✗ failed to read scenarios directory ${dir}:`, err);
    return 1;
  }

  if (files.length === 0) {
    console.error(`✗ no scenario files found in ${dir}`);
    return 1;
  }

  let totalErrors = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const content = await fs.readFile(fullPath, "utf8");
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (err) {
      console.error(`✗ YAML parse error in ${file}:`, (err as Error).message);
      totalErrors++;
      continue;
    }

    const result = validateSocScenario(raw, file);
    for (const w of result.warnings) console.warn(`warning: ${w}`);
    for (const e of result.errors) console.error(`error: ${e}`);

    if (result.valid) {
      const scenario = raw as SocScenario;
      const totalAlerts = scenario.alerts.length;
      const fpAndNoise = scenario.alerts.filter((a) =>
        ["false_positive", "benign_true_positive", "duplicate", "informational"].includes(a.groundTruth?.kind),
      ).length;
      const noisePercent = ((fpAndNoise / totalAlerts) * 100).toFixed(1);
      const incidentsCount = scenario.groundTruth?.incidents?.length ?? 0;
      const ambiguousCount = scenario.alerts.filter((a) => (a.groundTruth?.acceptableAlternatives?.length ?? 0) > 0).length;

      console.log(
        `✓ SOC scenario OK: ${file} (${totalAlerts} alerts, ${noisePercent}% noise, ${incidentsCount} incidents, ${ambiguousCount} ambiguous)`,
      );
    } else {
      totalErrors += result.errors.length;
    }
  }

  if (totalErrors > 0) {
    console.error(`\n✗ SOC check failed with ${totalErrors} error(s)`);
    return 1;
  }

  console.log(`\n✓ All ${files.length} SOC scenario(s) passed validation.`);
  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
