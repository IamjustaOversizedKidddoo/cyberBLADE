import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "../lib/lab-engine/soc/family-schema";
import { runFamilyProof } from "../lib/lab-engine/soc/family-validator";

async function main(): Promise<number> {
  const familiesDir = path.resolve("content/soc/families");
  let files: string[] = [];

  try {
    files = (await fs.readdir(familiesDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch (err) {
    console.error(`✗ Failed to read families directory ${familiesDir}:`, err);
    return 1;
  }

  if (files.length === 0) {
    console.error(`✗ No family files found in ${familiesDir}`);
    return 1;
  }

  // Parse CLI args: --seeds <n>
  const args = process.argv.slice(2);
  const seedsIdx = args.indexOf("--seeds");
  const seedCount = seedsIdx !== -1 && args[seedsIdx + 1] ? parseInt(args[seedsIdx + 1], 10) : 50;

  console.log(`Checking ${files.length} SOC scenario family/families with ${seedCount} seeds each...\n`);

  let totalErrors = 0;

  for (const file of files) {
    const fullPath = path.join(familiesDir, file);
    const content = await fs.readFile(fullPath, "utf8");
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (err) {
      console.error(`✗ YAML parse error in ${file}:`, (err as Error).message);
      totalErrors++;
      continue;
    }

    // 1. Zod schema validation
    const parsed = socFamilySchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ Schema errors in ${file}:`);
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      totalErrors++;
      continue;
    }

    const family = parsed.data as SocFamily;

    // 2. Run proof toolchain across seeds
    console.log(`Running proof toolchain for family '${family.metadata.id}' (${seedCount} seeds)...`);
    const t0 = performance.now();
    const report = runFamilyProof(family, seedCount, "intermediate");
    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

    console.log(`  - Structural Pass Rate: ${report.structuralPassRate}%`);
    console.log(`  - Semantic Pass Rate:   ${report.semanticPassRate}%`);
    console.log(`  - Tell Detection Pass:  ${report.tellDetectionPassRate}%`);
    console.log(`  - Leak Scan Pass:       ${report.leakScanPassRate}%`);
    console.log(`  - Reference Solver:     min=${report.referenceSolver.minScore}% mean=${report.referenceSolver.meanScore}%`);
    console.log(`  - Best Naive Solver:    max=${report.bestNaiveMaxScore}%`);
    console.log(`  - Ref-to-Naive Margin:  +${report.referenceToNaiveMargin}%`);
    console.log(`  - Pairwise Distance:    min=${report.variantDistance.minPairwiseDistance} mean=${report.variantDistance.meanPairwiseDistance}`);
    console.log(`  - Gen Timing (p50/p95): ${report.generationTimingsMs.p50}ms / ${report.generationTimingsMs.p95}ms`);
    console.log(`  - Completed in ${elapsed}s: Verdict = ${report.verdict}\n`);

    if (report.verdict !== "PASSED") {
      console.error(`✗ Family ${family.metadata.id} failed proof toolchain:`);
      for (const w of report.weakestAreas) {
        console.error(`  - ${w}`);
      }
      totalErrors++;
    } else {
      console.log(`✓ Family OK: ${file} [${family.metadata.title}]`);
    }
  }

  if (totalErrors > 0) {
    console.error(`\n✗ SOC family checks failed with ${totalErrors} error(s)`);
    return 1;
  }

  console.log(`\n✓ All ${files.length} SOC family/families passed the validation & proof toolchain.`);
  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
