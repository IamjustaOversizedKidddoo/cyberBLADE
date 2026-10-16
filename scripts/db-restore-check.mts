/**
 * Loads a backup into a throwaway in-memory Postgres (PGlite; no Docker, nothing hosted) and runs
 * the integrity and RLS checks in lib/ops/restore.ts. Nothing is written anywhere.
 *   BACKUP_ENCRYPTION_KEY=... npm run db:restore-check -- --file <backup.sql.gz.enc> [--manifest <file.json>]
 *   npm run db:restore-check -- --synthetic [--learners 100]   (fake data, random in-memory key)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { encryptBackup, makeManifest, parseBackupKey, type BackupManifest } from "../lib/ops/backup";
import { buildSyntheticBundle, restoreAndCheck } from "../lib/ops/restore";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  let file: Buffer, manifest: BackupManifest, key: Buffer;
  if (process.argv.includes("--synthetic")) {
    const learners = Number(arg("learners") ?? 100);
    key = crypto.randomBytes(32);
    const plain = Buffer.from(buildSyntheticBundle(learners), "utf8");
    file = encryptBackup(plain, key);
    manifest = makeManifest("synthetic", file, plain, `synthetic, ${learners} fake learners`);
    console.log(`synthetic backup: ${learners} learners, ${file.length} bytes encrypted`);
  } else {
    const p = arg("file");
    if (!p) throw new Error("pass --file <backup> or --synthetic");
    key = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
    file = fs.readFileSync(p);
    manifest = JSON.parse(fs.readFileSync(arg("manifest") ?? `${p}.json`, "utf8"));
  }
  const report = await restoreAndCheck(file, manifest, key);
  for (const c of report.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  const t = report.timingsMs;
  console.log(`restored ${report.tables} tables, ${report.rows} rows; verify+decrypt ${t.verifyDecrypt} ms, load ${t.load} ms, checks ${t.checks} ms, total ${t.total} ms`);
  if (!report.ok) {
    console.error("RESTORE CHECK FAILED");
    process.exit(1);
  }
  console.log("RESTORE CHECK PASSED");
}

main().catch((e) => {
  console.error(`db:restore-check: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
