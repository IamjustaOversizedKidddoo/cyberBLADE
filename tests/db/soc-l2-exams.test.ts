/**
 * SOC L2 exam tables on a real Postgres (PGlite, Supabase-like roles):
 * - soc_exam_attempts format constraint expansion (investigation-l2, detection-rule, knowledge-l2)
 * - soc_detection_rules table with two-user RLS isolation
 * - delete_user_account() cleans up detection rules cleanly
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createSupabaseLikeDb, refused, type Who } from "./supabase-emulation";

const U1 = "00000000-0000-4000-a000-0000000000f1";
const U2 = "00000000-0000-4000-a000-0000000000f2";
const svc: Who = { role: "service_role" };
const user1: Who = { role: "authenticated", uid: U1 };
const user2: Who = { role: "authenticated", uid: U2 };
const anon: Who = { role: "anon" };

let db: PGlite;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  await db.query(`INSERT INTO auth.users(id) VALUES ($1), ($2)`, [U1, U2]);
  await as(
    db,
    svc,
    async (tx) => {
      await tx.query(
        `INSERT INTO public.operators(id, handle, rank, ethics_accepted_at) VALUES ($1,'op_l2_1',1,now()), ($2,'op_l2_2',1,now())`,
        [U1, U2],
      );
    },
    true,
  );
}, 120_000);

describe("SOC L2 exam format constraint", () => {
  it("accepts new L2 exam formats (investigation-l2, detection-rule, knowledge-l2)", async () => {
    for (const fmt of ["investigation-l2", "detection-rule", "knowledge-l2"]) {
      const res = await as(
        db,
        svc,
        (tx) =>
          tx.query<{ id: string }>(
            `INSERT INTO public.soc_exam_attempts(user_id, format, config_version, variant_id, seed, deadline_at)
             VALUES ($1, $2, 1, 'v1', 'seed123', now() + interval '1 hour')
             RETURNING id`,
            [U1, fmt],
          ),
        false, // transaction rollback so active exam constraint won't block next insert
      );
      expect(res.rows).toHaveLength(1);
    }
  });

  it("refuses unapproved exam formats", async () => {
    expect(
      await refused(
        db,
        svc,
        `INSERT INTO public.soc_exam_attempts(user_id, format, config_version, variant_id, seed, deadline_at)
         VALUES ('${U1}', 'invalid-format', 1, 'v1', 'seed123', now() + interval '1 hour')`,
      ),
    ).toMatch(/soc_exam_attempts_format_check/);
  });
});

describe("soc_detection_rules two-user RLS", () => {
  let rule1Id: string;
  let rule2Id: string;

  it("service_role can insert detection rules for learners", async () => {
    const res1 = await as(
      db,
      svc,
      (tx) =>
        tx.query<{ id: string }>(
          `INSERT INTO public.soc_detection_rules(user_id, title, description, severity, tactic, technique, query)
           VALUES ($1, 'Suspicious PS Rule', 'Detects encoded commands', 'high', 'Execution', 'T1059.001', 'search -EncodedCommand')
           RETURNING id`,
          [U1],
        ),
      true,
    );
    expect(res1.rows).toHaveLength(1);
    rule1Id = res1.rows[0].id;

    const res2 = await as(
      db,
      svc,
      (tx) =>
        tx.query<{ id: string }>(
          `INSERT INTO public.soc_detection_rules(user_id, title, description, severity, tactic, technique, query)
           VALUES ($1, 'RDP Brute Force', 'Detects rapid logon failures', 'medium', 'Credential Access', 'T1110', 'stats count by src_ip | where count > 10')
           RETURNING id`,
          [U2],
        ),
      true,
    );
    expect(res2.rows).toHaveLength(1);
    rule2Id = res2.rows[0].id;
  });

  it("learners cannot write directly to soc_detection_rules", async () => {
    expect(
      await refused(
        db,
        user1,
        `INSERT INTO public.soc_detection_rules(user_id, title, query)
         VALUES ('${U1}', 'Direct Insert', 'search test')`,
      ),
    ).toMatch(/permission denied/);

    expect(
      await refused(
        db,
        anon,
        `INSERT INTO public.soc_detection_rules(user_id, title, query)
         VALUES ('${U1}', 'Direct Insert', 'search test')`,
      ),
    ).toMatch(/permission denied/);
  });

  it("user 1 reads own detection rules but cannot see user 2's rules", async () => {
    const res = await as(
      db,
      user1,
      (tx) => tx.query<{ id: string; title: string }>(`SELECT id, title FROM public.soc_detection_rules`),
      false,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe(rule1Id);
    expect(res.rows[0].title).toBe("Suspicious PS Rule");
  });

  it("user 2 reads own detection rules but cannot see user 1's rules", async () => {
    const res = await as(
      db,
      user2,
      (tx) => tx.query<{ id: string; title: string }>(`SELECT id, title FROM public.soc_detection_rules`),
      false,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe(rule2Id);
    expect(res.rows[0].title).toBe("RDP Brute Force");
  });

  it("anon cannot read soc_detection_rules", async () => {
    expect(
      await refused(db, anon, `SELECT * FROM public.soc_detection_rules`),
    ).toMatch(/permission denied/);
  });

  it("delete_user_account removes detection rules for target user only", async () => {
    // Delete user 1
    await as(
      db,
      user1,
      (tx) => tx.query(`SELECT public.delete_user_account($1)`, [U1]),
      true,
    );

    // Verify user 1 rules are gone
    const svcCheck1 = await as(
      db,
      svc,
      (tx) => tx.query(`SELECT * FROM public.soc_detection_rules WHERE user_id = $1`, [U1]),
      false,
    );
    expect(svcCheck1.rows).toHaveLength(0);

    // Verify user 2 rules still exist intact
    const svcCheck2 = await as(
      db,
      svc,
      (tx) => tx.query(`SELECT * FROM public.soc_detection_rules WHERE user_id = $1`, [U2]),
      false,
    );
    expect(svcCheck2.rows).toHaveLength(1);
    expect((svcCheck2.rows[0] as { id: string }).id).toBe(rule2Id);
  });
});
