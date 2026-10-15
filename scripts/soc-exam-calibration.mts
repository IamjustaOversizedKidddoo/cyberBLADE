/**
 * Offline, owner-run calibration of the provisional readiness gate against self-reported real
 * exam outcomes. Reads a local progress store (default .data/progress.json) or an owner export
 * with the same socExamAttempts / socExamOutcomeReports maps. Prints aggregate counts only.
 * Never run against a hosted database from here.
 *
 *   npx tsx scripts/soc-exam-calibration.mts [path/to/progress.json]
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { ProgressData } from "../lib/progress/types.js";
import { loadExamConfig, loadReadinessConfig } from "../lib/lab-engine/soc/exam/config.js";
import { calibrationTable } from "../lib/lab-engine/soc/exam/calibration.js";

async function main() {
  const file = process.argv[2] ?? path.join(process.cwd(), ".data", "progress.json");
  let data: ProgressData;
  try {
    data = JSON.parse(await fs.readFile(file, "utf8")) as ProgressData;
  } catch {
    console.log(`No readable progress store at ${file}. Nothing to calibrate.`);
    return;
  }
  const config = loadExamConfig();
  const t = calibrationTable(
    Object.values(data.socExamAttempts ?? {}),
    Object.values(data.socExamOutcomeReports ?? {}),
    loadReadinessConfig(),
    (f) => config.formats[f as keyof typeof config.formats]?.countsForReadiness ?? false,
    new Date(),
  );
  console.log("SOC readiness gate calibration (PROVISIONAL gate; self-reported, untrusted outcomes)");
  console.log(`usable reports: ${t.rows}  skipped (malformed or future-dated): ${t.skipped}`);
  for (const [state, v] of Object.entries(t.byState)) {
    const n = v.passed + v.failed;
    console.log(`${state.padEnd(10)} passed ${String(v.passed).padStart(4)}  failed ${String(v.failed).padStart(4)}  pass rate ${n ? Math.round((v.passed / n) * 100) + "%" : "n/a"}`);
  }
  if (t.rows < 30) console.log("Fewer than 30 usable reports: too few to change thresholds.");
}

main();
