/**
 * Executes ALL migrations against a local Postgres (PGlite) with Supabase-like roles and checks
 * the learner access model with two real users. Closes S1/S2/S3/S5/S6 with runtime evidence.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigration, as, createSupabaseLikeDb, migrationFiles, refused, type Who } from "./supabase-emulation";

const A = "00000000-0000-4000-a000-00000000000a";
const B = "00000000-0000-4000-a000-00000000000b";
const asA: Who = { role: "authenticated", uid: A };
const svc: Who = { role: "service_role" };
const HARDENING = "20261014180000_phase_3_access_hardening.sql";

type Ids = Record<string, string>;

/** One row per learner table for `uid`, written the way the app writes them (service role). */
async function seedUser(db: PGlite, uid: string, tag: string): Promise<Ids> {
  const ids: Ids = {};
  await db.query(`INSERT INTO auth.users(id) VALUES ($1)`, [uid]); // the auth service owns this table
  await as(
    db,
    svc,
    async (tx) => {
      const one = async (key: string, sql: string, params: unknown[]) => {
        const r = await tx.query<{ id: string }>(sql, params);
        ids[key] = r.rows[0]?.id;
      };
      await tx.query(`INSERT INTO public.operators(id, handle, rank, ethics_accepted_at) VALUES ($1, $2, 0, now())`, [uid, `op_${tag}`]);
      await one("lesson", `INSERT INTO public.lesson_progress(user_id, lesson_id, status) VALUES ($1,'l1','in_progress') RETURNING id`, [uid]);
      await one("lab", `INSERT INTO public.lab_attempts(user_id, lab_id, seed, mode) VALUES ($1,'lab1','LABSEED_${tag}','practice') RETURNING id`, [uid]);
      await one("xp", `INSERT INTO public.xp_events(user_id, source, amount) VALUES ($1,'x',10) RETURNING id`, [uid]);
      await one("chal", `INSERT INTO public.rank_challenges(user_id, rank, lab_attempt_id, status) VALUES ($1, 1, $2, 'active') RETURNING id`, [uid, ids.lab]);
      await one("review", `INSERT INTO public.review_items(user_id, card_id, lesson_id) VALUES ($1,'c1','l1') RETURNING id`, [uid]);
      await one("exam", `INSERT INTO public.exam_reports(user_id, exam_type, score, max_score, passed) VALUES ($1,'secplus',700,900,true) RETURNING id`, [uid]);
      await one("att", `INSERT INTO public.soc_attempts(user_id, scenario_id, seed, scenario_hash) VALUES ($1,'soc-f-x','SOCSEED_${tag}','HASH_${tag}') RETURNING id`, [uid]);
      await one("dec", `INSERT INTO public.soc_decisions(attempt_id, alert_id, disposition, severity, escalate, rationale) VALUES ($1,'alt-1','true_positive','HIGH',false,'because evidence') RETURNING id`, [ids.att]);
      await one("case", `INSERT INTO public.soc_cases(attempt_id, title) VALUES ($1,'case') RETURNING id`, [ids.att]);
      await one("calert", `INSERT INTO public.soc_case_alerts(case_id, alert_id) VALUES ($1,'alt-1') RETURNING id`, [ids.case]);
      await one("used", `INSERT INTO public.soc_used_seeds(user_id, family_id, seed) VALUES ($1,'soc-f-x','SOCSEED_${tag}') RETURNING id`, [uid]);
      await one("lookup", `INSERT INTO public.soc_enrichment_lookups(attempt_id, user_id, tool, entity_type, entity_value, response_hash) VALUES ($1,$2,'whois','ip','198.51.100.1','h') RETURNING id`, [ids.att, uid]);
      await one("qlog", `INSERT INTO public.soc_query_logs(attempt_id, user_id, language_version, query_text) VALUES ($1,$2,'1','source=auth') RETURNING id`, [ids.att, uid]);
      await one("qatt", `INSERT INTO public.soc_question_attempts(attempt_id, user_id, question_id, submitted_answer, is_correct) VALUES ($1,$2,'q1','"x"',false) RETURNING id`, [ids.att, uid]);
      await one("draft", `INSERT INTO public.soc_report_submissions(attempt_id, user_id, status) VALUES ($1,$2,'draft') RETURNING id`, [ids.att, uid]);
      await one("sub", `INSERT INTO public.soc_report_submissions(attempt_id, user_id, template_id, status, report_data) VALUES ($1,$2,'t2','submitted','{"executiveSummary":"mine"}') RETURNING id`, [ids.att, uid]);
      await one("eval", `INSERT INTO public.soc_report_evaluations(submission_id, attempt_id, user_id, rubric_version, grader_version, scoring_version, total_score, version_label) VALUES ($1,$2,$3,'1','1','1',55,'v') RETURNING id`, [ids.sub, ids.att, uid]);
      await one("grade", `INSERT INTO public.soc_ai_criterion_grades(submission_id, attempt_id, user_id, criterion_id, status, ai_rubric_id, ai_rubric_version, prompt_version, grader_version, model_id, input_hash, cache_key) VALUES ($1,$2,$3,'coherence','graded','r','0.1.0','p1','0.1.0','m','h','k') RETURNING id`, [ids.sub, ids.att, uid]);
      await one("raw", `INSERT INTO public.soc_ai_raw_outputs(grade_id, user_id, sample_index, attempt, raw_text, prompt_hash) VALUES ($1,$2,0,1,'RAW_MODEL_TEXT_${tag}','PROMPTHASH_${tag}') RETURNING id`, [ids.grade, uid]);
      await one("job", `INSERT INTO public.soc_ai_grading_jobs(submission_id, attempt_id, user_id, criterion_id, idempotency_key) VALUES ($1,$2,$3,'coherence', repeat('${tag}', 64)) RETURNING id`, [ids.sub, ids.att, uid]);
      await one("ritem", `INSERT INTO public.soc_ai_review_items(grade_id, submission_id, user_id, criterion_id, reason) VALUES ($1,$2,$3,'coherence','random_sample') RETURNING id`, [ids.grade, ids.sub, uid]);
      await one("req", `INSERT INTO public.soc_ai_human_review_requests(submission_id, user_id) VALUES ($1,$2) RETURNING id`, [ids.sub, uid]);
      await tx.query(`INSERT INTO public.soc_ai_calibration_consent(user_id, granted, consent_version) VALUES ($1,true,'c1')`, [uid]);
      await tx.query(`INSERT INTO public.soc_ai_usage_daily(usage_key, submissions_graded) VALUES ($1, 1)`, [`${uid}:2026-10-14`]);
      // SOC exams (Stage 1); absent in the pre-hardening schema used by the regression test.
      const hasExams = (await tx.query<{ t: string | null }>(`SELECT to_regclass('public.soc_exam_attempts')::text AS t`)).rows[0].t;
      if (!hasExams) return;
      await one("exam_att", `INSERT INTO public.soc_exam_attempts(user_id, format, config_version, variant_id, soc_attempt_id, seed, deadline_at) VALUES ($1,'alert-queue',1,'shift-quiet-day',$2,'EXAMSEED_${tag}', now() + interval '1 hour') RETURNING id`, [uid, ids.att]);
      await one("exam_ans", `INSERT INTO public.soc_exam_answers(exam_attempt_id, user_id, item_id, answer) VALUES ($1,$2,'handoff','"my note"') RETURNING id`, [ids.exam_att, uid]);
      await one("exam_out", `INSERT INTO public.soc_exam_outcome_reports(user_id, cert_family, exam_date, passed, consent_version) VALUES ($1,'soc-analyst','2026-10-01',true,'c1') RETURNING id`, [uid]);
      await tx.query(`INSERT INTO public.soc_exam_accommodations(user_id, multiplier, reason, set_by) VALUES ($1, 1.5, 'documented need', 'admin-cli')`, [uid]);
    },
    true,
  );
  return ids;
}

/** Tables a learner may read, with the predicate that finds a given user's rows. */
const READABLE: Array<[string, (uid: string) => string]> = [
  ["lesson_progress", (u) => `user_id = '${u}'`],
  ["lab_attempts", (u) => `user_id = '${u}'`],
  ["xp_events", (u) => `user_id = '${u}'`],
  ["rank_challenges", (u) => `user_id = '${u}'`],
  ["review_items", (u) => `user_id = '${u}'`],
  ["exam_reports", (u) => `user_id = '${u}'`],
  ["soc_attempts", (u) => `user_id = '${u}'`],
  ["soc_decisions", (u) => `attempt_id IN (SELECT id FROM public.soc_attempts WHERE user_id = '${u}')`],
  ["soc_cases", (u) => `attempt_id IN (SELECT id FROM public.soc_attempts WHERE user_id = '${u}')`],
  ["soc_enrichment_lookups", (u) => `user_id = '${u}'`],
  ["soc_query_logs", (u) => `user_id = '${u}'`],
  ["soc_question_attempts", (u) => `user_id = '${u}'`],
  ["soc_report_submissions", (u) => `user_id = '${u}'`],
  ["soc_report_evaluations", (u) => `user_id = '${u}'`],
  ["soc_ai_criterion_grades", (u) => `user_id = '${u}'`],
  ["soc_ai_human_review_requests", (u) => `user_id = '${u}'`],
  ["soc_ai_calibration_consent", (u) => `user_id = '${u}'`],
  ["soc_exam_attempts", (u) => `user_id = '${u}'`],
  ["soc_exam_answers", (u) => `user_id = '${u}'`],
];
const SERVICE_ONLY = [
  "soc_used_seeds",
  "soc_ai_raw_outputs",
  "soc_ai_grading_jobs",
  "soc_ai_review_items",
  "soc_ai_usage_daily",
  "soc_exam_outcome_reports",
  "soc_exam_accommodations",
];

/** Column used for row counting (avoids SELECT * on column-granted tables). */
const idCol = (t: string) => (t === "soc_ai_calibration_consent" ? "user_id" : "id");

let db: PGlite;
let a: Ids;
let b: Ids;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  a = await seedUser(db, A, "a");
  b = await seedUser(db, B, "b");
}, 120_000);

async function count(who: Who, table: string, where: string): Promise<number> {
  const r = await as(db, who, (tx) => tx.query<{ n: number }>(`SELECT count(${idCol(table)})::int AS n FROM public.${table} WHERE ${where}`));
  return r.rows[0].n;
}

describe("migrations execute on a real Postgres", () => {
  it("every migration applies in order (done in beforeAll) and the post-Phase-2 ones re-run cleanly", async () => {
    // 20261010000000 (Phase 2 initial schema) predates the idempotency rule and may already be
    // applied in a hosted project, so it is not edited; every later migration must re-run.
    for (const f of migrationFiles().filter((x) => x > "20261010000000_phase_2g_initial_schema.sql")) {
      await expect(applyMigration(db, f), f).resolves.toBeUndefined();
    }
  });
});

describe("two-user isolation", () => {
  it.each(READABLE)("%s: A reads own rows and none of B's", async (table, mine) => {
    expect(await count(asA, table, mine(A))).toBeGreaterThan(0);
    expect(await count(asA, table, mine(B))).toBe(0);
  });

  it.each(SERVICE_ONLY)("%s: learners cannot read it at all", async (table) => {
    expect(await refused(db, asA, `SELECT count(*) FROM public.${table}`)).toMatch(/permission denied/);
  });

  it("anon reads nothing", async () => {
    for (const [table] of READABLE) {
      const msg = await refused(db, { role: "anon" }, `SELECT count(${idCol(table)}) FROM public.${table}`);
      if (!msg) expect(await count({ role: "anon" }, table, "true")).toBe(0);
    }
  });
});

describe("learners cannot write grading data (S1/S3)", () => {
  const writes: Array<[string, (ids: Ids) => string]> = [
    ["soc_attempts status/score", (i) => `UPDATE public.soc_attempts SET status='submitted', score_summary='{"score":100}' WHERE id='${i.att}'`],
    ["soc_attempts seed", (i) => `UPDATE public.soc_attempts SET seed='chosen' WHERE id='${i.att}'`],
    ["soc_attempts insert", () => `INSERT INTO public.soc_attempts(user_id, scenario_id, seed) VALUES ('${A}','x','y')`],
    ["soc_decisions insert", (i) => `INSERT INTO public.soc_decisions(attempt_id, alert_id, disposition, severity, escalate, rationale) VALUES ('${i.att}','alt-9','true_positive','LOW',false,'rationale here')`],
    ["soc_decisions update", (i) => `UPDATE public.soc_decisions SET disposition='false_positive' WHERE id='${i.dec}'`],
    ["soc_question_attempts mark correct", (i) => `INSERT INTO public.soc_question_attempts(attempt_id, user_id, question_id, submitted_answer, is_correct) VALUES ('${i.att}','${A}','q1','"x"',true)`],
    ["soc_question_attempts flip", (i) => `UPDATE public.soc_question_attempts SET is_correct=true WHERE id='${i.qatt}'`],
    ["soc_report_submissions content", (i) => `UPDATE public.soc_report_submissions SET report_data='{"executiveSummary":"edited"}' WHERE id='${i.sub}'`],
    ["soc_report_submissions insert submitted", (i) => `INSERT INTO public.soc_report_submissions(attempt_id, user_id, template_id, status) VALUES ('${i.att}','${A}','t9','submitted')`],
    ["soc_report_evaluations score", (i) => `UPDATE public.soc_report_evaluations SET total_score=100 WHERE id='${i.eval}'`],
    ["soc_ai_criterion_grades band", (i) => `UPDATE public.soc_ai_criterion_grades SET band=3 WHERE id='${i.grade}'`],
    ["lab_attempts objectives", (i) => `UPDATE public.lab_attempts SET objectives_solved='{o1,o2}' WHERE id='${i.lab}'`],
    ["lesson_progress completion", (i) => `UPDATE public.lesson_progress SET status='completed' WHERE id='${i.lesson}'`],
    ["xp_events insert", () => `INSERT INTO public.xp_events(user_id, source, amount) VALUES ('${A}','cheat',9999)`],
    ["rank_challenges insert", (i) => `INSERT INTO public.rank_challenges(user_id, rank, lab_attempt_id, status) VALUES ('${A}',3,'${i.lab}','passed')`],
    ["soc_used_seeds insert", () => `INSERT INTO public.soc_used_seeds(user_id, family_id, seed) VALUES ('${A}','f','s')`],
    ["delete own evidence", (i) => `DELETE FROM public.soc_query_logs WHERE id='${i.qlog}'`],
    // SOC exams: learners cannot write score, status, deadline, budget-relevant or seed columns
    ["soc_exam_attempts score", (i) => `UPDATE public.soc_exam_attempts SET result='{"scorePercent":100}' WHERE id='${i.exam_att}'`],
    ["soc_exam_attempts status", (i) => `UPDATE public.soc_exam_attempts SET status='submitted' WHERE id='${i.exam_att}'`],
    ["soc_exam_attempts deadline", (i) => `UPDATE public.soc_exam_attempts SET deadline_at = now() + interval '9 hours' WHERE id='${i.exam_att}'`],
    ["soc_exam_attempts time multiplier", (i) => `UPDATE public.soc_exam_attempts SET time_multiplier = 3 WHERE id='${i.exam_att}'`],
    ["soc_exam_attempts insert", () => `INSERT INTO public.soc_exam_attempts(user_id, format, config_version, variant_id, seed, deadline_at) VALUES ('${A}','knowledge',1,'bank','s', now())`],
    ["soc_exam_answers insert", (i) => `INSERT INTO public.soc_exam_answers(exam_attempt_id, user_id, item_id, answer) VALUES ('${i.exam_att}','${A}','k1','"x"')`],
    ["soc_exam_answers update", (i) => `UPDATE public.soc_exam_answers SET answer='"y"' WHERE id='${i.exam_ans}'`],
    ["soc_exam_outcome_reports insert", () => `INSERT INTO public.soc_exam_outcome_reports(user_id, cert_family, exam_date, passed, consent_version) VALUES ('${A}','x','2026-10-01',true,'c')`],
    ["soc_exam_accommodations self-grant", () => `INSERT INTO public.soc_exam_accommodations(user_id, multiplier, reason, set_by) VALUES ('${A}', 3, 'me', 'me')`],
    ["soc_start_exam_attempt from a learner", () => `SELECT public.soc_start_exam_attempt('${A}','knowledge',1,'bank',gen_random_uuid(),'s','{}',now(),now(),1,0,99,1)`],
  ];

  it.each(writes)("refuses: %s", async (_label, sql) => {
    expect(await refused(db, asA, sql(a))).toMatch(/permission denied|row-level security/);
  });

  it("cannot touch another user's rows either", async () => {
    expect(await refused(db, asA, `UPDATE public.soc_attempts SET status='abandoned' WHERE id='${b.att}'`)).toMatch(/permission denied/);
  });

  it("submitted reports are immutable even for the service role; drafts still update", async () => {
    expect(await refused(db, svc, `UPDATE public.soc_report_submissions SET report_data='{}' WHERE id='${a.sub}'`)).toMatch(/immutable/);
    await expect(as(db, svc, (tx) => tx.query(`UPDATE public.soc_report_submissions SET report_data='{"x":1}' WHERE id=$1`, [a.draft]))).resolves.toBeDefined();
  });
});

describe("secrets are not readable (S2)", () => {
  it.each([
    ["soc_attempts.seed", `SELECT seed FROM public.soc_attempts`],
    ["soc_attempts.scenario_hash", `SELECT scenario_hash FROM public.soc_attempts`],
    ["soc_attempts SELECT *", `SELECT * FROM public.soc_attempts`],
    ["lab_attempts.seed", `SELECT seed FROM public.lab_attempts`],
    ["soc_used_seeds", `SELECT seed FROM public.soc_used_seeds`],
    ["raw AI outputs", `SELECT raw_text FROM public.soc_ai_raw_outputs`],
    ["prompt hashes", `SELECT prompt_hash FROM public.soc_ai_raw_outputs`],
    ["soc_exam_attempts.seed", `SELECT seed FROM public.soc_exam_attempts`],
    ["soc_exam_attempts SELECT *", `SELECT * FROM public.soc_exam_attempts`],
    // L1-A-04 / L1-A-02: no correctness oracle or scenario identity during an exam
    ["soc_question_attempts.is_correct", `SELECT is_correct FROM public.soc_question_attempts`],
    ["soc_question_attempts SELECT *", `SELECT * FROM public.soc_question_attempts`],
    ["soc_attempts.family_id", `SELECT family_id FROM public.soc_attempts`],
    ["soc_exam_attempts.variant_id", `SELECT variant_id FROM public.soc_exam_attempts`],
    ["soc_exam_attempts.item_ids", `SELECT item_ids FROM public.soc_exam_attempts`],
  ])("%s is refused", async (_l, sql) => {
    expect(await refused(db, asA, sql)).toMatch(/permission denied/);
  });

  it("no learner-readable column holds seeds, truth, answers, raw outputs or prompts", async () => {
    const r = await db.query<{ t: string; c: string }>(
      `SELECT table_name AS t, column_name AS c FROM information_schema.column_privileges
        WHERE grantee IN ('authenticated','anon','PUBLIC') AND privilege_type = 'SELECT' AND table_schema = 'public'`,
    );
    const risky = r.rows
      .filter((x) => /seed|truth|answer|raw_text|prompt|model_report|scenario_hash|reference/.test(x.c))
      .filter((x) => !(x.t === "soc_question_attempts" && x.c === "submitted_answer")) // the learner's own answer
      .filter((x) => !(x.t === "soc_exam_answers" && (x.c === "answer" || x.c === "answered_at"))) // the learner's own exam answer and its time
      .filter((x) => x.c !== "prompt_version") // a version label such as "p1", not prompt text
      .map((x) => `${x.t}.${x.c}`);
    expect(risky).toEqual([]);
  });
});

describe("erasure (S6)", () => {
  it("a learner cannot erase someone else; anon cannot call it", async () => {
    expect(await refused(db, asA, `SELECT public.delete_user_account($1)`, [B])).toMatch(/Unauthorized/);
    expect(await refused(db, { role: "anon" }, `SELECT public.delete_user_account($1)`, [A])).toMatch(/permission denied/);
  });

  it("delete_user_account removes every row of the user across all tables and nothing of B", async () => {
    await as(db, asA, (tx) => tx.query(`SELECT public.delete_user_account($1)`, [A]), true);
    const tables = await db.query<{ t: string }>(
      `SELECT DISTINCT table_name AS t FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id'`,
    );
    const leftovers: string[] = [];
    for (const { t } of tables.rows) {
      if (t === "audit_events") continue; // anonymized deletion record by design
      const n = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t} WHERE user_id = $1`, [A]);
      if (n.rows[0].n > 0) leftovers.push(`${t}:${n.rows[0].n}`);
    }
    expect(leftovers).toEqual([]);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.soc_ai_usage_daily WHERE usage_key LIKE $1`, [`${A}:%`])).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.operators WHERE id = $1`, [A])).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.soc_attempts WHERE user_id = $1`, [B])).rows[0].n).toBe(1);
  });
});

describe("SQL functions (S4, runtime)", () => {
  it("every public function pins search_path; only allowlisted ones are SECURITY DEFINER", async () => {
    const r = await db.query<{ name: string; definer: boolean; config: string[] | null }>(
      `SELECT p.proname AS name, p.prosecdef AS definer, p.proconfig AS config
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`, // skip pgcrypto etc.
    );
    for (const f of r.rows) expect((f.config ?? []).some((c) => c.startsWith("search_path=")), f.name).toBe(true);
    expect(r.rows.filter((f) => f.definer).map((f) => f.name).sort()).toEqual(["delete_user_account", "prevent_operator_rank_escalation"]);
  });
});

describe("the holes existed before the hardening migration (regression proof)", () => {
  it("pre-hardening schema let a learner read seeds and rewrite scores", async () => {
    const old = await createSupabaseLikeDb({ upTo: migrationFiles().filter((f) => f < HARDENING).pop() });
    const ids = await seedUser(old, A, "o");
    const seed = await as(old, asA, (tx) => tx.query<{ seed: string }>(`SELECT seed FROM public.soc_attempts`));
    expect(seed.rows[0].seed).toBe("SOCSEED_o");
    const upd = await as(old, asA, (tx) => tx.query(`UPDATE public.soc_attempts SET score_summary='{"score":100}' WHERE id=$1 RETURNING id`, [ids.att]));
    expect(upd.rows).toHaveLength(1);
    const qa = await as(old, asA, (tx) => tx.query(`INSERT INTO public.soc_question_attempts(attempt_id, user_id, question_id, submitted_answer, is_correct) VALUES ($1,$2,'q1','"x"',true) RETURNING id`, [ids.att, A]));
    expect(qa.rows).toHaveLength(1);
  }, 120_000);
});
