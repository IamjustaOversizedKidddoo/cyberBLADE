/** Backup file format: authenticated encryption, checksums, retention, dump sanitising. */
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authUserColumns,
  backupFileName,
  bundleDumps,
  decryptBackup,
  encryptBackup,
  makeManifest,
  parseBackupKey,
  retentionPlan,
  sanitizeDump,
  splitBundle,
} from "@/lib/ops/backup";

const key = crypto.randomBytes(32);

describe("backup encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const plain = Buffer.from("INSERT INTO \"public\".\"operators\" (\"handle\") VALUES ('ghost');");
    const enc = encryptBackup(plain, key);
    expect(enc.includes(Buffer.from("ghost"))).toBe(false);
    expect(decryptBackup(enc, key).equals(plain)).toBe(true);
  });

  it("rejects a wrong key, a flipped byte and a non-backup file", () => {
    const enc = encryptBackup(Buffer.from("x".repeat(100)), key);
    expect(() => decryptBackup(enc, crypto.randomBytes(32))).toThrow(/authentication/);
    const flipped = Buffer.from(enc);
    flipped[flipped.length - 1] ^= 1;
    expect(() => decryptBackup(flipped, key)).toThrow(/authentication/);
    expect(() => decryptBackup(Buffer.from("PGDMP...."), key)).toThrow(/Not a CyberBLADE backup/);
  });

  it("requires a 32-byte key", () => {
    expect(() => parseBackupKey(undefined)).toThrow();
    expect(() => parseBackupKey(Buffer.alloc(16).toString("base64"))).toThrow();
    expect(parseBackupKey(key.toString("base64")).equals(key)).toBe(true);
  });
});

describe("manifest and bundle", () => {
  const auth = `SET x = 1;\nINSERT INTO "auth"."users" ("instance_id", "id", "email") VALUES (NULL, 'a', 'e');\n`;
  const pub = `\\restrict abc\nSET transaction_timeout = 0;\nCREATE SCHEMA public;\nINSERT INTO "public"."operators" ("id") VALUES ('a');\nINSERT INTO public.operators ("id") VALUES ('b');\n\\unrestrict abc\n`;

  it("counts rows per table and records both checksums", () => {
    const plain = Buffer.from(bundleDumps(auth, pub));
    const m = makeManifest("f", encryptBackup(plain, key), plain, "test");
    expect(m.tables).toEqual({ "auth.users": 1, "public.operators": 2 });
    expect(m.sha256Plain).toMatch(/^[0-9a-f]{64}$/);
    expect(m.sha256Encrypted).not.toBe(m.sha256Plain);
  });

  it("splits sections and reads auth.users columns", () => {
    const s = splitBundle(bundleDumps(auth, pub));
    expect(authUserColumns(s.auth)).toEqual(["instance_id", "id", "email"]);
    expect(s.pub).toContain("public.operators");
    expect(() => splitBundle("garbage")).toThrow();
  });

  it("strips psql meta-commands and tolerates an existing public schema", () => {
    const out = sanitizeDump(pub);
    expect(out).not.toMatch(/^\\/m);
    expect(out).not.toContain("transaction_timeout");
    expect(out).toContain("CREATE SCHEMA IF NOT EXISTS public;");
  });
});

describe("retention", () => {
  it("keeps the newest N backups and ignores unrelated files", () => {
    const files = [
      backupFileName(new Date("2026-10-01T03:00:00Z")),
      backupFileName(new Date("2026-10-03T03:00:00Z")),
      backupFileName(new Date("2026-10-02T03:00:00Z")),
      "notes.txt",
      "cyberblade-20261001T030000Z.sql.gz.enc.json",
    ];
    expect(files[0]).toBe("cyberblade-20261001T030000Z.sql.gz.enc");
    expect(retentionPlan(files, 2)).toEqual(["cyberblade-20261001T030000Z.sql.gz.enc"]);
    expect(retentionPlan(files, 5)).toEqual([]);
    expect(() => retentionPlan(files, 0)).toThrow();
  });
});
