/**
 * SOC exam tables on a real Postgres (PGlite, Supabase-like roles): the atomic start function,
 * the one-active-exam index, cooldown and retake caps, and answers frozen after submission.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createSupabaseLikeDb, refused, type Who } from "./supabase-emulation";

const U = "00000000-0000-4000-a000-0000000000e1";
const svc: Who = { role: "service_role" };
let db: PGlite;

const start = (format: string, cooldown = 60, max = 3, startedAt = "now()") =>
  `SELECT id FROM public.soc_start_exam_attempt('${U}','${format}',1,'v1',gen_random_uuid(),'seed','{}',${startedAt},${startedAt} + interval '1 hour',1,${cooldown},${max},7)`;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  await db.query(`INSERT INTO auth.users(id) VALUES ($1)`, [U]);
  await as(db, svc, (tx) => tx.query(`INSERT INTO public.operators(id, handle, rank, ethics_accepted_at) VALUES ($1,'op_exam',1,now())`, [U]), true);
}, 120_000);

describe("soc_start_exam_attempt", () => {
  it("starts one exam and refuses a second while it is active (second tab)", async () => {
    const r = await as(db, svc, (tx) => tx.query<{ id: string }>(start("knowledge")), true);
    expect(r.rows).toHaveLength(1);
    expect(await refused(db, svc, start("alert-queue"))).toMatch(/exam is active/);
  });

  it("the partial unique index blocks a second active row even without the function", async () => {
    expect(
      await refused(db, svc, `INSERT INTO public.soc_exam_attempts(user_id, format, config_version, variant_id, seed, deadline_at) VALUES ('${U}','investigation',1,'v','s', now())`),
    ).toMatch(/duplicate key|unique/);
  });

  it("answers are accepted while active and frozen after submission, for every role", async () => {
    const id = (await db.query<{ id: string }>(`SELECT id FROM public.soc_exam_attempts WHERE user_id=$1 AND status='active'`, [U])).rows[0].id;
    await as(db, svc, (tx) => tx.query(`INSERT INTO public.soc_exam_answers(exam_attempt_id, user_id, item_id, answer) VALUES ($1,$2,'k1','"a"')`, [id, U]), true);
    await as(db, svc, (tx) => tx.query(`UPDATE public.soc_exam_attempts SET status='submitted', submitted_at=now() WHERE id=$1`, [id]), true);
    expect(await refused(db, svc, `UPDATE public.soc_exam_answers SET answer='"b"' WHERE exam_attempt_id='${id}'`)).toMatch(/exam is closed/);
    expect(await refused(db, svc, `INSERT INTO public.soc_exam_answers(exam_attempt_id, user_id, item_id, answer) VALUES ('${id}','${U}','k2','"c"')`)).toMatch(/exam is closed/);
  });

  it("enforces the format cooldown after a submission", async () => {
    expect(await refused(db, svc, start("knowledge", 60))).toMatch(/cooling down/);
    // A different format is not affected by the knowledge cooldown.
    const r = await as(db, svc, (tx) => tx.query<{ id: string }>(start("mini-queue", 0, 10)), true);
    expect(r.rows).toHaveLength(1);
    await as(db, svc, (tx) => tx.query(`UPDATE public.soc_exam_attempts SET status='submitted', submitted_at=now() WHERE id=$1`, [r.rows[0].id]), true);
  });

  it("enforces the retake cap inside the window", async () => {
    // Two mini-queues already counted would need a cap of 1 to refuse.
    expect(await refused(db, svc, start("mini-queue", 0, 1))).toMatch(/retake limit/);
  });

  it("is not executable by learners or anon", async () => {
    expect(await refused(db, { role: "authenticated", uid: U }, start("investigation"))).toMatch(/permission denied/);
    expect(await refused(db, { role: "anon" }, start("investigation"))).toMatch(/permission denied/);
  });
});
