/**
 * Runs the exact staging:verify isolation checks against PGlite + the real migrations, so the
 * checks (and the schema) are proven locally before the owner runs them against hosted staging.
 */
import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { as, createSupabaseLikeDb, type Who } from "./supabase-emulation";
import { runStagingChecks, type DbAs, type Res } from "@/lib/ops/staging-checks";

const q = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error(`bad identifier ${s}`);
  return `"${s}"`;
};
const cols = (c: string) => (c === "*" ? "*" : c.split(",").map((x) => q(x.trim())).join(", "));

function pgliteAs(db: PGlite, who: Who): DbAs {
  const run = async (sql: string, params: unknown[]): Promise<Res> => {
    try {
      const r = await as(db, who, (tx) => tx.query<Record<string, unknown>>(sql, params), true);
      return { rows: r.rows, error: null, count: r.affectedRows ?? 0 };
    } catch (e) {
      const err = e as { code?: string; message: string };
      return { rows: [], error: { code: err.code, message: err.message } };
    }
  };
  const val = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);
  return {
    select: (t, c, [k, v]) => run(`SELECT ${cols(c)} FROM public.${q(t)} WHERE ${q(k)} = $1`, [v]),
    insert: (t, row) => {
      const ks = Object.keys(row);
      return run(`INSERT INTO public.${q(t)} (${ks.map(q).join(", ")}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(", ")})`, ks.map((k) => val(row[k])));
    },
    update: (t, patch, [k, v]) => {
      const ks = Object.keys(patch);
      return run(`UPDATE public.${q(t)} SET ${ks.map((c, i) => `${q(c)} = $${i + 2}`).join(", ")} WHERE ${q(k)} = $1`, [v, ...ks.map((c) => val(patch[c]))]);
    },
    delete: (t, [k, v]) => run(`DELETE FROM public.${q(t)} WHERE ${q(k)} = $1`, [v]),
    rpc: (fn, args) => run(`SELECT public.${q(fn)}(${Object.keys(args).map((k, i) => `${q(k)} => $${i + 1}`).join(", ")})`, Object.values(args)),
  };
}

describe("staging isolation checks on PGlite", { timeout: 120_000 }, () => {
  it("every check passes against the migrated schema", async () => {
    const db = await createSupabaseLikeDb();
    const [A, B] = [crypto.randomUUID(), crypto.randomUUID()];
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a@example.test'), ($2, 'b@example.test')`, [A, B]);
    const checks = await runStagingChecks({
      svc: pgliteAs(db, { role: "service_role" }),
      a: pgliteAs(db, { role: "authenticated", uid: A }),
      b: pgliteAs(db, { role: "authenticated", uid: B }),
      uidA: A,
      uidB: B,
      deleteAuthUser: async (uid) => void (await db.query(`DELETE FROM auth.users WHERE id = $1`, [uid])),
    });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(8);
    await db.close();
  });

  it("catches a cross-learner read leak and a learner-writable score table", async () => {
    const db = await createSupabaseLikeDb();
    await db.exec(`
      CREATE POLICY leak_read ON public.lesson_progress FOR SELECT TO authenticated USING (true);
      GRANT INSERT ON public.xp_events TO authenticated;
      CREATE POLICY leak_xp ON public.xp_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());`);
    const [A, B] = [crypto.randomUUID(), crypto.randomUUID()];
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a@example.test'), ($2, 'b@example.test')`, [A, B]);
    const checks = await runStagingChecks({
      svc: pgliteAs(db, { role: "service_role" }),
      a: pgliteAs(db, { role: "authenticated", uid: A }),
      b: pgliteAs(db, { role: "authenticated", uid: B }),
      uidA: A,
      uidB: B,
      deleteAuthUser: async (uid) => void (await db.query(`DELETE FROM auth.users WHERE id = $1`, [uid])),
    });
    const failed = Object.fromEntries(checks.filter((c) => !c.ok).map((c) => [c.name, c.detail]));
    expect(failed["learner B cannot read, insert, update or delete learner A's rows"]).toContain("lesson_progress: read");
    expect(failed["learners cannot write scores, seeds, grades, XP, rank or exam results"]).toContain("xp_events: insert accepted");
    await db.close();
  });
});
