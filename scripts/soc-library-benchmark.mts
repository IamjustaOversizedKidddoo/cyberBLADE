import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily, type DifficultyLevel } from "../lib/lab-engine/soc/family-schema";
import { shiftProfileSchema, type ShiftProfile } from "../lib/lab-engine/soc/shift-schema";
import { generateSocVariant } from "../lib/lab-engine/soc/generator";
import { loadFamilyCatalog, composeShiftScenario } from "../lib/lab-engine/soc/shift-composer";

type BenchmarkRow = {
  id: string;
  type: "Family" | "Shift";
  difficulty: string;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  minAlerts: number;
  meanAlerts: number;
  maxAlerts: number;
  sampleSize: number;
};

async function main(): Promise<number> {
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

  const sampleSize = 50;
  const rows: BenchmarkRow[] = [];

  console.log(`Running SOC library benchmark across ${families.length} families and ${shifts.length} shifts (${sampleSize} samples each)...\n`);

  // Benchmark Families
  for (const fam of families) {
    const diffs: DifficultyLevel[] = fam.metadata.difficultyRange;
    for (const diff of diffs) {
      const timings: number[] = [];
      const alertCounts: number[] = [];

      for (let i = 1; i <= sampleSize; i++) {
        const seed = `bench-fam-${fam.metadata.id}-${diff}-${i}`;
        const t0 = performance.now();
        const res = generateSocVariant(fam, seed, diff);
        const elapsed = performance.now() - t0;
        timings.push(elapsed);
        alertCounts.push(res.scenario.alerts.length);
      }

      timings.sort((a, b) => a - b);
      const p50 = Number(timings[Math.floor(timings.length * 0.5)].toFixed(2));
      const p95 = Number(timings[Math.floor(timings.length * 0.95)].toFixed(2));
      const max = Number(timings[timings.length - 1].toFixed(2));
      const minAlerts = Math.min(...alertCounts);
      const maxAlerts = Math.max(...alertCounts);
      const meanAlerts = Number((alertCounts.reduce((a, b) => a + b, 0) / sampleSize).toFixed(1));

      rows.push({
        id: fam.metadata.id,
        type: "Family",
        difficulty: diff,
        p50Ms: p50,
        p95Ms: p95,
        maxMs: max,
        minAlerts,
        meanAlerts,
        maxAlerts,
        sampleSize,
      });
    }
  }

  // Benchmark Shifts
  for (const sh of shifts) {
    const timings: number[] = [];
    const alertCounts: number[] = [];

    for (let i = 1; i <= sampleSize; i++) {
      const seed = `bench-shift-${sh.id}-${i}`;
      const t0 = performance.now();
      const sc = composeShiftScenario(sh, seed, catalog);
      const elapsed = performance.now() - t0;
      timings.push(elapsed);
      alertCounts.push(sc.alerts.length);
    }

    timings.sort((a, b) => a - b);
    const p50 = Number(timings[Math.floor(timings.length * 0.5)].toFixed(2));
    const p95 = Number(timings[Math.floor(timings.length * 0.95)].toFixed(2));
    const max = Number(timings[timings.length - 1].toFixed(2));
    const minAlerts = Math.min(...alertCounts);
    const maxAlerts = Math.max(...alertCounts);
    const meanAlerts = Number((alertCounts.reduce((a, b) => a + b, 0) / sampleSize).toFixed(1));

    rows.push({
      id: sh.id,
      type: "Shift",
      difficulty: sh.difficulty,
      p50Ms: p50,
      p95Ms: p95,
      maxMs: max,
      minAlerts,
      meanAlerts,
      maxAlerts,
      sampleSize,
    });
  }

  // Print Markdown Table
  console.log("| ID | Type | Difficulty | p50 (ms) | p95 (ms) | Max (ms) | Alerts (Min/Mean/Max) | Status |");
  console.log("|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|");
  for (const r of rows) {
    const status = r.p95Ms < 150 ? "PASS (<150ms)" : "FAIL";
    console.log(
      `| \`${r.id}\` | ${r.type} | ${r.difficulty} | ${r.p50Ms}ms | ${r.p95Ms}ms | ${r.maxMs}ms | ${r.minAlerts} / ${r.meanAlerts} / ${r.maxAlerts} | ${status} |`,
    );
  }
  console.log("");

  return 0;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
