/**
 * A local, account-free stand-in for a Supabase Postgres: PGlite plus the roles, auth schema,
 * auth.uid()/auth.role() helpers and default privileges that Supabase sets up. Migrations run
 * exactly as written; tests then act as `authenticated` (with a JWT subject) or `service_role`.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

import { SUPABASE_BOOTSTRAP_SQL as BOOTSTRAP } from "@/lib/db/supabase-bootstrap";

export const MIGRATIONS_DIR = path.resolve("supabase/migrations");

export function migrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

export async function createSupabaseLikeDb(opts: { upTo?: string } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(BOOTSTRAP);
  for (const f of migrationFiles()) {
    if (opts.upTo && f > opts.upTo) break;
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return db;
}

export async function applyMigration(db: PGlite, file: string): Promise<void> {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
}

export type Who = { role: "authenticated"; uid: string } | { role: "anon" } | { role: "service_role" };

/** Runs `fn` as a Supabase role inside a transaction that is always rolled back unless `commit`. */
export async function as<T>(db: PGlite, who: Who, fn: (tx: Transaction) => Promise<T>, commit = false): Promise<T> {
  let out!: T;
  await db
    .transaction(async (tx) => {
      await tx.query(`SELECT set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
        who.role,
        who.role === "authenticated" ? who.uid : "",
      ]);
      await tx.exec(`SET LOCAL ROLE ${who.role}`);
      out = await fn(tx);
      if (!commit) await tx.rollback();
    })
    .catch((e: unknown) => {
      // rollback() surfaces as a rejection in some versions; only rethrow real errors
      if (!(e instanceof Error && /rollback/i.test(e.message))) throw e;
    });
  return out;
}

/** Expect a statement to be refused (permission or RLS). Returns the error message. */
export async function refused(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await as(db, who, (tx) => tx.query(sql, params));
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "";
}
