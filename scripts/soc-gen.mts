import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type DifficultyLevel } from "../lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "../lib/lab-engine/soc/generator";
import { toClientView } from "../lib/lab-engine/soc/schema";

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const familyId = getArg("--family");
  const seed = getArg("--seed");
  const difficulty = (getArg("--difficulty") ?? "intermediate") as DifficultyLevel;
  const outDir = getArg("--out");

  if (!familyId || !seed || !outDir) {
    console.error("Usage: npm run soc:gen -- --family <id> --seed <seed> [--difficulty <beginner|intermediate|advanced>] --out <dir>");
    return 1;
  }

  // Load family
  const familyPath = path.resolve(`content/soc/families/${familyId}.yaml`);
  let familyRaw: string;
  try {
    familyRaw = await fs.readFile(familyPath, "utf8");
  } catch {
    console.error(`✗ Family file not found: ${familyPath}`);
    return 1;
  }

  const parsedFamily = socFamilySchema.parse(parseYaml(familyRaw));

  // Generate variant
  console.log(`Generating SOC scenario variant for '${familyId}' (seed: ${seed}, difficulty: ${difficulty})...`);
  const result = generateSocVariant(parsedFamily, seed, difficulty);
  const scenario = result.scenario;
  const clientView = toClientView(scenario);

  // Prepare output directory
  const resolvedOutDir = path.resolve(outDir);
  await fs.mkdir(resolvedOutDir, { recursive: true });

  const clientPath = path.join(resolvedOutDir, "client-view.json");
  const gtPath = path.join(resolvedOutDir, "ground-truth.json");

  await fs.writeFile(clientPath, JSON.stringify(clientView, null, 2), "utf8");
  await fs.writeFile(gtPath, JSON.stringify(scenario, null, 2), "utf8");

  console.log("\n========================================================================");
  console.log("  [!] RESTRICTED / EVALUATION GROUND TRUTH EXPORT");
  console.log("  The output directory contains FULL SERVER-SIDE GROUND TRUTH & ANSWERS.");
  console.log("  NEVER commit these JSON files to source control or expose to learners.");
  console.log("========================================================================\n");
  console.log(`✓ Wrote client view (clean):     ${clientPath}`);
  console.log(`✓ Wrote full scenario (answers): ${gtPath}`);
  console.log(`✓ Scenario Hash:                 ${result.contentHash}`);
  console.log(`✓ Total alerts:                  ${scenario.alerts.length}`);
  console.log(`✓ Total incidents:               ${scenario.groundTruth.incidents.length}`);

  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
