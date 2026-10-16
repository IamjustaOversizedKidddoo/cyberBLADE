/**
 * Restores a CyberBLADE backup into a throwaway in-memory Postgres (PGlite, no Docker, nothing
 * hosted) and proves it is usable: checksums, authenticated decryption, per-table row counts,
 * RLS enabled on every public table, required functions present, anon sees nothing, and an
 * authenticated learner sees no other learner's rows. Operator scripts and tests only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { SUPABASE_BOOTSTRAP_SQL, SUPABASE_EXTRA_ROLES } from "@/lib/db/supabase-bootstrap";
import {
  authUserColumns,
  bundleDumps,
  countInserts,
  decryptBackup,
  sanitizeDump,
  sha256Hex,
  splitBundle,
  type BackupManifest,
} from "./backup";

export const REQUIRED_FUNCTIONS = ["delete_user_account", "rate_limit_hit", "beta_redeem_invite", "handler_usage_add"];

export type RestoreCheck = { name: string; ok: boolean; detail: string };
export type RestoreReport = {
  ok: boolean;
  checks: RestoreCheck[];
  rows: number;
  tables: number;
  timingsMs: { verifyDecrypt: number; load: number; checks: number; total: number };
};

type Who = { role: "anon" } | { role: "authenticated"; uid: string };

/** Rows visible to `who`, or "denied" when the role has no privilege at all. */
async function visibleCount(db: PGlite, who: Who, sql: string): Promise<number | "denied"> {
  let n: number | "denied" = "denied";
  await db
    .transaction(async (tx) => {
      await tx.query(`SELECT set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
        who.role,
        who.role === "authenticated" ? who.uid : "",
      ]);
      await tx.exec(`SET LOCAL ROLE ${who.role}`);
      try {
        n = Number((await tx.query<{ n: number }>(sql)).rows[0].n);
      } catch (e) {
        if (!(e instanceof Error && /permission denied/i.test(e.message))) throw e;
      }
      await tx.rollback();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && /rollback|permission denied/i.test(e.message))) throw e;
    });
  return n;
}

const ident = (s: string) => {
  if (!/^\w+$/.test(s)) throw new Error(`Unexpected identifier in backup: ${s.slice(0, 40)}`);
  return `"${s}"`;
};

export async function restoreAndCheck(file: Buffer, manifest: BackupManifest, key: Buffer): Promise<RestoreReport> {
  const checks: RestoreCheck[] = [];
  const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });
  const t0 = performance.now();

  add("encrypted checksum matches manifest", sha256Hex(file) === manifest.sha256Encrypted);
  const plain = decryptBackup(file, key);
  add("decrypted (AES-256-GCM authenticated)", true);
  add("plaintext checksum matches manifest", sha256Hex(plain) === manifest.sha256Plain);
  const sql = plain.toString("utf8");
  const { auth, pub } = splitBundle(sql);
  const t1 = performance.now();

  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
  try {
    await db.exec(SUPABASE_BOOTSTRAP_SQL);
    for (const r of SUPABASE_EXTRA_ROLES) await db.exec(`DO $$ BEGIN CREATE ROLE ${ident(r)} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
    // Real auth.users has many more columns than the emulation; widen it so the data loads as-is.
    for (const c of authUserColumns(auth).filter((c) => c !== "id" && c !== "email")) {
      await db.exec(`ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS ${ident(c)} text`);
    }
    await db.exec(sanitizeDump(auth));
    await db.exec(sanitizeDump(pub));
    await db.exec(`SET search_path = public; SET session_replication_role = origin;`);
    const t2 = performance.now();

    // 1. Every table in the manifest restored with exactly the backed-up row count.
    let rows = 0;
    const mismatched: string[] = [];
    for (const [qualified, expected] of Object.entries(manifest.tables)) {
      const [s, t] = qualified.split(".");
      const n = Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${ident(s)}.${ident(t)}`)).rows[0].n);
      rows += n;
      if (n !== expected) mismatched.push(`${qualified} ${n}/${expected}`);
    }
    add("row counts match manifest", mismatched.length === 0, mismatched.join(", "));
    const dumpCounts = countInserts(sql);
    add("manifest matches dump contents", JSON.stringify(sortKeys(dumpCounts)) === JSON.stringify(sortKeys(manifest.tables)));

    // 2. RLS on every public table, required functions present.
    const tables = (
      await db.query<{ t: string; rls: boolean }>(
        `SELECT c.relname AS t, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
      )
    ).rows;
    const noRls = tables.filter((r) => !r.rls).map((r) => r.t);
    add("RLS enabled on every public table", tables.length > 0 && noRls.length === 0, noRls.join(", ") || `${tables.length} tables`);
    const fns = new Set(
      (await db.query<{ f: string }>(`SELECT p.proname AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`)).rows.map((r) => r.f),
    );
    const missing = REQUIRED_FUNCTIONS.filter((f) => !fns.has(f));
    add("required functions present", missing.length === 0, missing.join(", "));

    // 3. anon reads nothing anywhere.
    const anonLeaks: string[] = [];
    for (const { t } of tables) {
      const n = await visibleCount(db, { role: "anon" }, `SELECT count(*)::int AS n FROM public.${ident(t)}`);
      if (n !== "denied" && n > 0) anonLeaks.push(t);
    }
    add("anon sees no rows", anonLeaks.length === 0, anonLeaks.join(", "));

    // 4. Two restored learners: each sees only their own rows in every table that has an owner column.
    const owned = (
      await db.query<{ t: string; c: string }>(
        `SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('user_id') UNION SELECT 'operators', 'id' ORDER BY 1`,
      )
    ).rows;
    const learners = (await db.query<{ id: string }>(`SELECT id::text AS id FROM public.operators ORDER BY id LIMIT 2`)).rows.map((r) => r.id);
    const crossLeaks: string[] = [];
    for (const uid of learners) {
      for (const { t, c } of owned) {
        const n = await visibleCount(db, { role: "authenticated", uid }, `SELECT count(*)::int AS n FROM public.${ident(t)} WHERE ${ident(c)} <> '${uid}'::uuid`);
        if (n !== "denied" && n > 0) crossLeaks.push(t);
      }
    }
    add("learners see no other learner's rows", learners.length > 0 && crossLeaks.length === 0, crossLeaks.join(", ") || `${learners.length} learners x ${owned.length} tables`);
    if (learners[0]) {
      const own = await visibleCount(db, { role: "authenticated", uid: learners[0] }, `SELECT count(*)::int AS n FROM public.operators WHERE id = '${learners[0]}'::uuid`);
      add("a learner can still read their own profile", own === 1);
    }
    const t3 = performance.now();

    return {
      ok: checks.every((c) => c.ok),
      checks,
      rows,
      tables: tables.length,
      timingsMs: { verifyDecrypt: Math.round(t1 - t0), load: Math.round(t2 - t1), checks: Math.round(t3 - t2), total: Math.round(t3 - t0) },
    };
  } finally {
    await db.close();
  }
}

function sortKeys(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

const lit = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const insert = (table: string, row: Record<string, string | number | null>) =>
  `INSERT INTO ${table} (${Object.keys(row).map((k) => `"${k}"`).join(", ")}) VALUES (${Object.values(row).map(lit).join(", ")});`;

/**
 * A synthetic backup bundle shaped like the real one: an auth.users data section and a public
 * section (schema from the migrations, then column-insert data with triggers disabled, as
 * pg_dump --disable-triggers would). Fake learners only (example.test addresses).
 */
export function buildSyntheticBundle(learners: number, migrationsDir = path.resolve("supabase/migrations")): string {
  const ids = Array.from({ length: learners }, () => crypto.randomUUID());
  const now = "2026-10-16T09:00:00Z";
  const auth = ids.map((id, i) => insert(`"auth"."users"`, { id, email: `learner-${i}@example.test`, created_at: now })).join("\n");
  const schema = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n");
  const data: string[] = ["SET session_replication_role = replica;"];
  ids.forEach((id, i) => {
    data.push(insert(`"public"."operators"`, { id, handle: `learner_${i}`, rank: i % 3, created_at: now }));
    for (const l of ["core-r0-01", "core-r0-02", "core-r1-net-dns-01"]) {
      data.push(insert(`"public"."lesson_progress"`, { id: crypto.randomUUID(), user_id: id, lesson_id: l, status: "completed" }));
    }
    data.push(insert(`"public"."handler_usage"`, { id: crypto.randomUUID(), user_id: id, date: "2026-10-16", requests_count: 3, input_tokens: 900, output_tokens: 400 }));
    data.push(insert(`"public"."beta_notice_acks"`, { user_id: id, notice_version: "beta-notice-v1", acked_at: now }));
    data.push(
      insert(`"public"."learner_feedback"`, {
        id: crypto.randomUUID(),
        user_id: id,
        kind: "lesson_check",
        content_id: "core-r0-01#q2",
        route: "/lessons/core-r0-01",
        message: `Synthetic note ${i}: option C's explanation looks off`,
        request_id: `req-synthetic-${i}`,
      }),
    );
  });
  data.push("SET session_replication_role = origin;");
  return bundleDumps(auth, `${schema}\n${data.join("\n")}`);
}
