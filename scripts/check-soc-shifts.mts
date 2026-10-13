import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { shiftProfileSchema, type ShiftProfile } from "../lib/lab-engine/soc/shift-schema";
import { loadFamilyCatalog, runShiftProof } from "../lib/lab-engine/soc/shift-composer";

async function main(): Promise<number> {
  const shiftsDir = path.resolve("content/soc/shifts");
  let files: string[] = [];

  try {
    files = (await fs.readdir(shiftsDir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch (err) {
    console.error(`✗ Failed to read shifts directory ${shiftsDir}:`, err);
    return 1;
  }

  if (files.length === 0) {
    console.error(`✗ No shift profile files found in ${shiftsDir}`);
    return 1;
  }

  const catalog = loadFamilyCatalog();

  const args = process.argv.slice(2);
  const seedsIdx = args.indexOf("--seeds");
  const seedCount = seedsIdx !== -1 && args[seedsIdx + 1] ? parseInt(args[seedsIdx + 1], 10) : 50;

  console.log(`Checking ${files.length} SOC shift profile(s) with ${seedCount} seeds each...\n`);

  let totalErrors = 0;

  for (const file of files) {
    const fullPath = path.join(shiftsDir, file);
    const content = await fs.readFile(fullPath, "utf8");
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (err) {
      console.error(`✗ YAML parse error in ${file}:`, (err as Error).message);
      totalErrors++;
      continue;
    }

    const parsed = shiftProfileSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ Schema errors in ${file}:`);
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      totalErrors++;
      continue;
    }

    const profile = parsed.data as ShiftProfile;

    console.log(`Running proof toolchain for shift '${profile.id}' (${seedCount} seeds)...`);
    const t0 = performance.now();
    const report = runShiftProof(profile, seedCount, catalog);
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
      console.error(`✗ Shift ${profile.id} failed proof toolchain:`);
      for (const w of report.weakestAreas) {
        console.error(`  - ${w}`);
      }
      totalErrors++;
    } else {
      console.log(`✓ Shift OK: ${file} [${profile.title}]`);
    }
  }

  if (totalErrors > 0) {
    console.error(`\n✗ SOC shift checks failed with ${totalErrors} error(s)`);
    return 1;
  }

  console.log(`\n✓ All ${files.length} SOC shift profile(s) passed the validation & proof toolchain.`);
  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
