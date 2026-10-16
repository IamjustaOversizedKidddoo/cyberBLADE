/**
 * Independent encrypted logical backup of the hosted Supabase database (in addition to, not
 * instead of, Supabase's own backups). Run from the operator's machine, never from Vercel.
 *   SUPABASE_DB_URL=postgresql://...  BACKUP_ENCRYPTION_KEY=<base64 32 bytes>  BACKUP_DIR=<folder outside the repo>
 *   [BACKUP_KEEP=14]  npm run db:backup
 * Needs pg_dump on PATH with a major version >= the server's (Supabase currently runs Postgres 15/17).
 * The connection string is split into PG* environment variables for pg_dump and never printed or
 * put on a command line. Writes cyberblade-<UTC>.sql.gz.enc + .json manifest (mode 600), then
 * deletes backups beyond BACKUP_KEEP. Verify every new backup with: npm run db:restore-check -- --file <path>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { backupFileName, bundleDumps, encryptBackup, makeManifest, parseBackupKey, retentionPlan } from "../lib/ops/backup";

function fail(msg: string): never {
  console.error(`db:backup: ${msg}`);
  process.exit(1);
}

const url = process.env.SUPABASE_DB_URL;
if (!url) fail("set SUPABASE_DB_URL (Supabase dashboard > Connect > session pooler or direct connection string).");
const key = (() => {
  try {
    return parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  } catch (e) {
    return fail((e as Error).message);
  }
})();
const dir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : fail("set BACKUP_DIR to a folder outside the repository.");
if (dir === process.cwd() || dir.startsWith(process.cwd() + path.sep)) fail("BACKUP_DIR must be outside the repository so backups can never be committed.");
const keep = Number(process.env.BACKUP_KEEP ?? 14);

let parsed: URL;
try {
  parsed = new URL(url);
} catch {
  fail("SUPABASE_DB_URL is not a valid postgresql:// URL.");
}
const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.replace(/^\//, "") || "postgres",
  PGSSLMODE: process.env.PGSSLMODE ?? "require",
};
delete (pgEnv as Record<string, string | undefined>).SUPABASE_DB_URL;

function pgDump(args: string[]): string {
  const r = spawnSync("pg_dump", args, { env: pgEnv, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
  if (r.error) fail(`could not run pg_dump (${(r.error as NodeJS.ErrnoException).code}); install the PostgreSQL client tools.`);
  if (r.status !== 0) fail(`pg_dump exited ${r.status}: ${(r.stderr ?? "").replace(/password=\S+/gi, "password=[redacted]").slice(0, 500)}`);
  return r.stdout;
}

const version = spawnSync("pg_dump", ["--version"], { encoding: "utf8" }).stdout?.trim() ?? "unknown";
const started = performance.now();
const common = ["--no-owner", "--column-inserts", "--quote-all-identifiers"];
const authDump = pgDump([...common, "--data-only", "--table=auth.users"]);
// rate_limit_buckets is short-lived throttle state: schema kept, rows skipped.
const publicDump = pgDump([...common, "--schema=public", "--exclude-table-data=public.rate_limit_buckets"]);

const plain = Buffer.from(bundleDumps(authDump, publicDump), "utf8");
const encrypted = encryptBackup(plain, key);
const name = backupFileName(new Date());
const manifest = makeManifest(name, encrypted, plain, `pg_dump ${version}; host ${parsed.hostname}`);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, name), encrypted, { mode: 0o600 });
fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(manifest, null, 2), { mode: 0o600 });

for (const old of retentionPlan(fs.readdirSync(dir), keep)) {
  fs.rmSync(path.join(dir, old));
  fs.rmSync(path.join(dir, `${old}.json`), { force: true });
  console.log(`  retention: removed ${old}`);
}

const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
console.log(`db:backup: wrote ${name} (${encrypted.length} bytes, ${Object.keys(manifest.tables).length} tables, ${rows} rows) in ${Math.round(performance.now() - started)} ms`);
console.log(`  sha256 ${manifest.sha256Encrypted}`);
console.log(`  next: npm run db:restore-check -- --file "${path.join(dir, name)}"`);
