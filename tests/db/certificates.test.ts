/**
 * Certificates table on a real Postgres (PGlite, Supabase-like roles):
 * Two-user isolation under RLS, service-only mutation, unguessable credential_id,
 * public verify RPC (returns safe subset; never emails or internal ids),
 * revocation by service role only, and account deletion cascade.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createSupabaseLikeDb, refused, type Who } from "./supabase-emulation";

const A = "00000000-0000-4000-a000-0000000000c1";
const B = "00000000-0000-4000-a000-0000000000c2";
const svc: Who = { role: "service_role" };
const asA: Who = { role: "authenticated", uid: A };
const asB: Who = { role: "authenticated", uid: B };
const anon: Who = { role: "anon" };

const CRED_A = "cbl_0123456789abcdef0123456789abcdef";
const CRED_B = "cbl_fedcba9876543210fedcba9876543210";

let db: PGlite;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  for (const [id, h] of [[A, "learner_a"], [B, "learner_b"]]) {
    await db.query(`INSERT INTO auth.users(id, email) VALUES ($1, $2)`, [id, `${h}@example.com`]);
    await as(
      db,
      svc,
      (tx) => tx.query(`INSERT INTO public.operators(id, handle, rank, ethics_accepted_at) VALUES ($1,$2,1,now())`, [id, h]),
      true,
    );
  }
}, 120_000);

describe("certificates table RLS and two-user isolation", () => {
  it("service role can issue certificates with unguessable slugs", async () => {
    await as(
      db,
      svc,
      (tx) =>
        tx.query(
          `INSERT INTO public.certificates (user_id, track_id, level, name_as_chosen, credential_id, score_snapshot)
           VALUES ($1, 'core', 'Operator', 'Learner Alpha', $2, '{"rank": 1}'::jsonb)`,
          [A, CRED_A],
        ),
      true,
    );

    await as(
      db,
      svc,
      (tx) =>
        tx.query(
          `INSERT INTO public.certificates (user_id, track_id, level, name_as_chosen, credential_id, score_snapshot)
           VALUES ($1, 'soc', 'Tier 1 Analyst', 'Learner Bravo', $2, '{"score": 92}'::jsonb)`,
          [B, CRED_B],
        ),
      true,
    );

    const rowsA = await as(db, svc, (tx) => tx.query(`SELECT * FROM public.certificates WHERE user_id=$1`, [A]));
    expect(rowsA.rows).toHaveLength(1);
  });

  it("learner A can read their own certificate but NOT learner B's certificate", async () => {
    const mine = await as(db, asA, (tx) => tx.query<{ credential_id: string; name_as_chosen: string }>(`SELECT credential_id, name_as_chosen FROM public.certificates`));
    expect(mine.rows).toHaveLength(1);
    expect(mine.rows[0].credential_id).toBe(CRED_A);
    expect(mine.rows[0].name_as_chosen).toBe("Learner Alpha");

    // Attempting to select B's certificate returns nothing under RLS
    const others = await as(db, asA, (tx) => tx.query(`SELECT * FROM public.certificates WHERE user_id=$1`, [B]));
    expect(others.rows).toHaveLength(0);
  });

  it("anon cannot query the certificates table directly (denied by permissions / RLS)", async () => {
    const err = await refused(db, anon, `SELECT * FROM public.certificates`);
    expect(err).toMatch(/permission denied/);
  });

  it("unique constraint enforces idempotency per (user_id, track_id, level)", async () => {
    const duplicateErr = await refused(
      db,
      svc,
      `INSERT INTO public.certificates (user_id, track_id, level, name_as_chosen, credential_id)
       VALUES ('${A}', 'core', 'Operator', 'Learner Alpha Duplicate', 'cbl_duplicate1234567890123456789012')`,
    );
    expect(duplicateErr).toMatch(/unique|duplicate key/i);
  });
});

describe("verify_certificate RPC (public verification registry)", () => {
  it("anon can verify valid certificate and receives only safe public attributes", async () => {
    const res = await as(db, anon, (tx) =>
      tx.query<{
        credential_id: string;
        name_as_chosen: string;
        track_id: string;
        level: string;
        status: string;
        revoked_at: string | null;
        user_id?: string;
        id?: string;
      }>(`SELECT * FROM public.verify_certificate($1)`, [CRED_A]),
    );

    expect(res.rows).toHaveLength(1);
    const cert = res.rows[0];
    expect(cert.credential_id).toBe(CRED_A);
    expect(cert.name_as_chosen).toBe("Learner Alpha");
    expect(cert.track_id).toBe("core");
    expect(cert.level).toBe("Operator");
    expect(cert.status).toBe("valid");
    expect(cert.revoked_at).toBeNull();

    // Verify internal identifiers are NOT present
    expect(cert.user_id).toBeUndefined();
    expect(cert.id).toBeUndefined();
  });

  it("returns empty result set for non-existent credential_id", async () => {
    const res = await as(db, anon, (tx) => tx.query(`SELECT * FROM public.verify_certificate($1)`, ["cbl_nonexistent_credential_slug"]));
    expect(res.rows).toHaveLength(0);
  });
});

describe("revocation path and verification behavior", () => {
  it("learners and anon cannot call revoke_certificate", async () => {
    expect(await refused(db, asA, `SELECT public.revoke_certificate('${CRED_A}', 'cheating')`)).toMatch(/permission denied/);
    expect(await refused(db, anon, `SELECT public.revoke_certificate('${CRED_A}', 'cheating')`)).toMatch(/permission denied/);
  });

  it("service role can revoke a certificate, updating status to revoked in verify RPC", async () => {
    const res = await as(db, svc, (tx) => tx.query<{ revoke_certificate: boolean }>(`SELECT public.revoke_certificate($1, $2)`, [CRED_A, "honor_code_violation"]), true);
    expect(res.rows[0].revoke_certificate).toBe(true);

    const verified = await as(db, anon, (tx) =>
      tx.query<{
        status: string;
        revoked_at: string | null;
      }>(`SELECT status, revoked_at FROM public.verify_certificate($1)`, [CRED_A]),
    );

    expect(verified.rows[0].status).toBe("revoked");
    expect(verified.rows[0].revoked_at).not.toBeNull();
  });
});

describe("delete_user_account cascade erasure", () => {
  it("deleting user B deletes their certificate rows (GDPR Right to Erasure)", async () => {
    const before = await as(db, svc, (tx) => tx.query(`SELECT * FROM public.certificates WHERE user_id=$1`, [B]));
    expect(before.rows).toHaveLength(1);

    await as(db, asB, (tx) => tx.query(`SELECT public.delete_user_account($1)`, [B]), true);

    const after = await as(db, svc, (tx) => tx.query(`SELECT * FROM public.certificates WHERE user_id=$1`, [B]));
    expect(after.rows).toHaveLength(0);
  });
});
