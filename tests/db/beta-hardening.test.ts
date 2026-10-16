/**
 * Beta hardening tables on a real Postgres (PGlite, Supabase-like roles): atomic rate limits under
 * concurrency, Handler metering, invite redemption (limited use, expiry, revocation, uniform
 * failure), two-user isolation and service-only access, and account deletion.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createSupabaseLikeDb, refused, type Who } from "./supabase-emulation";

const A = "00000000-0000-4000-a000-0000000000b1";
const B = "00000000-0000-4000-a000-0000000000b2";
const C = "00000000-0000-4000-a000-0000000000b3";
const svc: Who = { role: "service_role" };
const asA: Who = { role: "authenticated", uid: A };
const asB: Who = { role: "authenticated", uid: B };
const KEY = "a".repeat(64);
const hash = (n: number) => String(n).padStart(64, "0");
let db: PGlite;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  for (const [id, h] of [[A, "op_beta_a"], [B, "op_beta_b"], [C, "op_beta_c"]]) {
    await db.query(`INSERT INTO auth.users(id) VALUES ($1)`, [id]);
    await as(db, svc, (tx) => tx.query(`INSERT INTO public.operators(id, handle, rank, ethics_accepted_at) VALUES ($1,$2,0,now())`, [id, h]), true);
  }
}, 120_000);

describe("rate_limit_hit", () => {
  it("counts atomically under concurrency: exactly max hits are allowed", async () => {
    const calls = Array.from({ length: 25 }, () => as(db, svc, (tx) => tx.query<{ allowed: boolean }>(`SELECT * FROM public.rate_limit_hit($1, 10, 60000)`, [KEY]), true));
    const rows = (await Promise.all(calls)).map((r) => r.rows[0]);
    expect(rows.filter((r) => r.allowed)).toHaveLength(10);
    const blocked = await as(db, svc, (tx) => tx.query<{ allowed: boolean; retry_after_ms: number }>(`SELECT * FROM public.rate_limit_hit($1, 10, 60000)`, [KEY]), true);
    expect(blocked.rows[0].allowed).toBe(false);
    expect(blocked.rows[0].retry_after_ms).toBeGreaterThan(0);
  });

  it("keys are isolated, inputs validated, and only the service role can call it", async () => {
    const other = await as(db, svc, (tx) => tx.query<{ allowed: boolean }>(`SELECT * FROM public.rate_limit_hit($1, 1, 60000)`, ["b".repeat(64)]), true);
    expect(other.rows[0].allowed).toBe(true);
    expect(await refused(db, svc, `SELECT * FROM public.rate_limit_hit('${"c".repeat(64)}', 0, 60000)`)).toMatch(/invalid rate limit/);
    expect(await refused(db, svc, `SELECT * FROM public.rate_limit_hit('short', 1, 60000)`)).toMatch(/check|violates/);
    expect(await refused(db, asA, `SELECT * FROM public.rate_limit_hit('${KEY}', 100, 60000)`)).toMatch(/permission denied/);
    expect(await refused(db, { role: "anon" }, `SELECT * FROM public.rate_limit_hit('${KEY}', 100, 60000)`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `SELECT * FROM public.rate_limit_buckets`)).toMatch(/permission denied/);
  });

  it("cleanup removes expired buckets (service only)", async () => {
    await as(db, svc, (tx) => tx.query(`INSERT INTO public.rate_limit_buckets(bucket_key, window_start, hits, expires_at) VALUES ($1, now() - interval '3 hours', 1, now() - interval '2 hours')`, ["d".repeat(64)]), true);
    const r = await as(db, svc, (tx) => tx.query<{ rate_limit_cleanup: number }>(`SELECT public.rate_limit_cleanup()`), true);
    expect(r.rows[0].rate_limit_cleanup).toBeGreaterThanOrEqual(1);
    expect(await refused(db, asA, `SELECT public.rate_limit_cleanup()`)).toMatch(/permission denied/);
  });
});

describe("handler_usage_add", () => {
  it("adds per-learner and global usage atomically; learners read only their own row", async () => {
    await Promise.all(Array.from({ length: 5 }, () => as(db, svc, (tx) => tx.query(`SELECT * FROM public.handler_usage_add($1, '2026-10-16', 100, 20)`, [A]), true)));
    const mine = await as(db, svc, (tx) => tx.query<{ requests_count: number; input_tokens: number }>(`SELECT requests_count, input_tokens FROM public.handler_usage WHERE user_id=$1`, [A]));
    expect(mine.rows[0]).toEqual({ requests_count: 5, input_tokens: 500 });
    const global = await as(db, svc, (tx) => tx.query<{ requests_count: number }>(`SELECT requests_count FROM public.handler_usage_global WHERE date='2026-10-16'`));
    expect(global.rows[0].requests_count).toBe(5);
    expect(await refused(db, asA, `SELECT * FROM public.handler_usage_global`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `SELECT * FROM public.handler_usage_add('${A}', '2026-10-16', 1, 1)`)).toMatch(/permission denied/);
  });
});

describe("beta invites", () => {
  beforeAll(async () => {
    await as(db, svc, (tx) => tx.query(`INSERT INTO public.beta_invites(code_hash, label, max_uses, expires_at, created_by) VALUES ($1,'two uses',2, now() + interval '1 day','cli'), ($2,'expired',5, now() - interval '1 minute','cli'), ($3,'revoked',5, now() + interval '1 day','cli')`, [hash(1), hash(2), hash(3)]), true);
    await as(db, svc, (tx) => tx.query(`UPDATE public.beta_invites SET revoked_at = now() WHERE code_hash = $1`, [hash(3)]), true);
  });
  const redeem = (code: string, user: string) => as(db, svc, (tx) => tx.query<{ beta_redeem_invite: boolean }>(`SELECT public.beta_redeem_invite($1, $2, now())`, [code, user]), true).then((r) => r.rows[0].beta_redeem_invite);

  it("limited use is enforced atomically; repeat redemption by the same learner is idempotent", async () => {
    const results = await Promise.all([redeem(hash(1), A), redeem(hash(1), B), redeem(hash(1), C)]);
    expect(results.filter(Boolean)).toHaveLength(2);
    const admitted = results[0] ? A : B;
    expect(await redeem(hash(1), admitted)).toBe(true);
    const row = await as(db, svc, (tx) => tx.query<{ uses: number }>(`SELECT uses FROM public.beta_invites WHERE code_hash=$1`, [hash(1)]));
    expect(row.rows[0].uses).toBe(2);
  });

  it("unknown, expired and revoked codes all fail the same way", async () => {
    expect(await redeem(hash(9), C)).toBe(false);
    expect(await redeem(hash(2), C)).toBe(false);
    expect(await redeem(hash(3), C)).toBe(false);
  });

  it("learners cannot read invites, call redemption, or read other learners' redemptions", async () => {
    expect(await refused(db, asA, `SELECT * FROM public.beta_invites`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `SELECT public.beta_redeem_invite('${hash(1)}', '${A}', now())`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `INSERT INTO public.beta_invites(code_hash, max_uses, expires_at, created_by) VALUES ('${hash(7)}',1,now(),'me')`)).toMatch(/permission denied/);
    const seen = await as(db, asA, (tx) => tx.query<{ user_id: string }>(`SELECT user_id FROM public.beta_invite_redemptions`));
    expect(seen.rows.every((r) => r.user_id === A)).toBe(true);
    expect(await refused(db, asA, `SELECT invite_id FROM public.beta_invite_redemptions`)).toMatch(/permission denied/);
  });
});

describe("beta notice acks and feedback: own rows only, server-written", () => {
  beforeAll(async () => {
    for (const u of [A, B]) {
      await as(db, svc, (tx) => tx.query(`INSERT INTO public.beta_notice_acks(user_id, notice_version) VALUES ($1,'beta-v1')`, [u]), true);
      await as(db, svc, (tx) => tx.query(`INSERT INTO public.learner_feedback(user_id, kind, content_id, route, message, request_id) VALUES ($1,'lesson_check','soc-l1-triage-loop-01:q1','/learn/x','typo in option b','req-00000001')`, [u]), true);
    }
  });

  it("each learner sees only their own rows and cannot write any", async () => {
    for (const [who, uid] of [[asA, A], [asB, B]] as const) {
      const fb = await as(db, who, (tx) => tx.query<{ user_id: string }>(`SELECT user_id FROM public.learner_feedback`));
      expect(fb.rows.map((r) => r.user_id)).toEqual([uid]);
      const acks = await as(db, who, (tx) => tx.query<{ user_id: string }>(`SELECT user_id FROM public.beta_notice_acks`));
      expect(acks.rows.map((r) => r.user_id)).toEqual([uid]);
    }
    expect(await refused(db, asA, `INSERT INTO public.learner_feedback(user_id, kind, message, request_id) VALUES ('${A}','general','x','req-00000002')`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `UPDATE public.learner_feedback SET message='edited'`)).toMatch(/permission denied/);
    expect(await refused(db, asA, `INSERT INTO public.beta_notice_acks(user_id, notice_version) VALUES ('${A}','beta-v2')`)).toMatch(/permission denied/);
    expect(await refused(db, svc, `INSERT INTO public.learner_feedback(user_id, kind, message, request_id) VALUES ('${A}','general','${"x".repeat(2001)}','req-00000003')`)).toMatch(/check/);
  });

  it("deletion removes the learner's beta rows and leaves other learners alone", async () => {
    await as(db, asB, (tx) => tx.query(`SELECT public.delete_user_account($1)`, [B]), true);
    for (const t of ["learner_feedback", "beta_notice_acks", "beta_invite_redemptions", "handler_usage"]) {
      const r = await as(db, svc, (tx) => tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t} WHERE user_id = $1`, [B]));
      expect(r.rows[0].n, t).toBe(0);
    }
    const a = await as(db, svc, (tx) => tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.learner_feedback WHERE user_id = $1`, [A]));
    expect(a.rows[0].n).toBe(1);
  });
});
