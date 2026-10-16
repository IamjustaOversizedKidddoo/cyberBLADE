/**
 * Logical backup format (operator scripts only; never imported by the app).
 *   plaintext = a bundle of two pg_dump outputs (auth.users data, then the public schema + data)
 *   file      = "CBBK1" | iv(12) | tag(16) | AES-256-GCM(gzip(plaintext)), AAD = "CBBK1"
 * A JSON manifest next to each file records both SHA-256 checksums and per-table row counts, so a
 * restore can prove the file is intact and complete. The key (BACKUP_ENCRYPTION_KEY, base64 of 32
 * random bytes) lives only with the operator, never in the repo or in Vercel.
 */
import crypto from "node:crypto";
import zlib from "node:zlib";

export const BACKUP_MAGIC = Buffer.from("CBBK1");
export const BUNDLE_HEADER = "-- CYBERBLADE BACKUP v1";
export const SECTION_AUTH = "-- CYBERBLADE SECTION: auth_users";
export const SECTION_PUBLIC = "-- CYBERBLADE SECTION: public";
export const BACKUP_FILE_RE = /^cyberblade-(\d{8}T\d{6}Z)\.sql\.gz\.enc$/;

export type BackupManifest = {
  format: "cyberblade-backup-v1";
  file: string;
  createdAt: string;
  sha256Encrypted: string;
  sha256Plain: string;
  /** Rows per table as counted from the dump's INSERT statements ("auth.users", "public.operators", ...). */
  tables: Record<string, number>;
  source: string;
};

export function parseBackupKey(b64: string | undefined): Buffer {
  const key = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be base64 of exactly 32 random bytes.");
  return key;
}

export const sha256Hex = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");

export function encryptBackup(plain: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(BACKUP_MAGIC);
  const ct = Buffer.concat([c.update(zlib.gzipSync(plain)), c.final()]);
  return Buffer.concat([BACKUP_MAGIC, iv, c.getAuthTag(), ct]);
}

/** Throws if the file is not a backup, the key is wrong, or a single byte was changed. */
export function decryptBackup(file: Buffer, key: Buffer): Buffer {
  if (file.length < 33 || !file.subarray(0, 5).equals(BACKUP_MAGIC)) throw new Error("Not a CyberBLADE backup file.");
  const d = crypto.createDecipheriv("aes-256-gcm", key, file.subarray(5, 17));
  d.setAAD(BACKUP_MAGIC);
  d.setAuthTag(file.subarray(17, 33));
  try {
    return zlib.gunzipSync(Buffer.concat([d.update(file.subarray(33)), d.final()]));
  } catch {
    throw new Error("Backup failed authentication: wrong key or the file was modified.");
  }
}

export function makeManifest(file: string, encrypted: Buffer, plain: Buffer, source: string, now = new Date()): BackupManifest {
  return {
    format: "cyberblade-backup-v1",
    file,
    createdAt: now.toISOString(),
    sha256Encrypted: sha256Hex(encrypted),
    sha256Plain: sha256Hex(plain),
    tables: countInserts(plain.toString("utf8")),
    source,
  };
}

export function backupFileName(now: Date): string {
  return `cyberblade-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}.sql.gz.enc`;
}

/** Files to delete so only the newest `keep` backups remain (other files in the folder are never touched). */
export function retentionPlan(files: string[], keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("Retention must keep at least one backup.");
  const backups = files.filter((f) => BACKUP_FILE_RE.test(f)).sort().reverse();
  return backups.slice(keep);
}

export function bundleDumps(authUsersDump: string, publicDump: string): string {
  return `${BUNDLE_HEADER}\n${SECTION_AUTH}\n${authUsersDump}\n${SECTION_PUBLIC}\n${publicDump}\n`;
}

export function splitBundle(sql: string): { auth: string; pub: string } {
  const a = sql.indexOf(SECTION_AUTH);
  const p = sql.indexOf(SECTION_PUBLIC);
  if (!sql.startsWith(BUNDLE_HEADER) || a < 0 || p < a) throw new Error("Backup bundle is missing its sections.");
  return { auth: sql.slice(a + SECTION_AUTH.length, p), pub: sql.slice(p + SECTION_PUBLIC.length) };
}

const INSERT_RE = /^INSERT INTO ("?)(\w+)\1\.("?)(\w+)\3[ (]/;

/** Rows per table, counted from statement-leading INSERT lines (pg_dump --column-inserts). */
export function countInserts(sql: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of sql.split("\n")) {
    const m = INSERT_RE.exec(line);
    if (m) out[`${m[2]}.${m[4]}`] = (out[`${m[2]}.${m[4]}`] ?? 0) + 1;
  }
  return out;
}

/** Column names of the first auth.users INSERT, so the restore can widen the emulated table. */
export function authUserColumns(authDump: string): string[] {
  const m = /^INSERT INTO "?auth"?\."?users"? \(([^)]*)\)/m.exec(authDump);
  return m ? m[1].split(",").map((c) => c.trim().replace(/^"|"$/g, "")) : [];
}

/**
 * Makes a pg_dump script loadable by PGlite: drops psql meta-commands (e.g. \restrict, which
 * PGlite cannot run) and settings older servers reject, and tolerates the public schema existing.
 */
export function sanitizeDump(sql: string): string {
  return sql
    .split("\n")
    .filter((l) => !l.startsWith("\\") && !/^SET transaction_timeout\b/.test(l))
    .join("\n")
    .replace(/^CREATE SCHEMA public;$/m, "CREATE SCHEMA IF NOT EXISTS public;");
}
