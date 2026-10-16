/**
 * Data-isolation checks for `npm run staging:verify`, written against a tiny client interface so the
 * same code runs against a hosted Supabase project (supabase-js adapter, owner-run) and against
 * PGlite with the real migrations (tests/db/staging-checks.test.ts). Operator tooling only.
 *
 * Learner A gets one row in every learner table (seeded with the service role). Then:
 * learner B can read, insert, update or delete none of A's rows (and cannot delete A's account);
 * A cannot write platform-authored rows (scores, seeds, grades, XP, rank) even for themselves;
 * raw AI output, prompts, seeds and ground-truth columns stay unreadable to A; an active exam's
 * result is unmarked and unwritable; deleting A removes every row A owned.
 */
import crypto from "node:crypto";

export type Res = { rows: Record<string, unknown>[]; error: { code?: string; message: string } | null; count?: number };
export interface DbAs {
  select(table: string, columns: string, eq: [string, unknown]): Promise<Res>;
  insert(table: string, row: Record<string, unknown>): Promise<Res>;
  /** Must report how many rows changed in `count` (0 when RLS filtered them out). */
  update(table: string, patch: Record<string, unknown>, eq: [string, unknown]): Promise<Res>;
  delete(table: string, eq: [string, unknown]): Promise<Res>;
  rpc(fn: string, args: Record<string, unknown>): Promise<Res>;
}
export type Check = { name: string; ok: boolean; detail?: string };

type Entry = {
  table: string;
  /** Column + value that select exactly the seeded row(s). */
  key: [string, unknown];
  row: Record<string, unknown>;
  /** A harmless column to try to change. */
  patch: Record<string, unknown>;
  /** The owner may read it (has a SELECT policy). */
  ownerReads: boolean;
  /** Learners may write their own rows by design (profile, self-reported results, study cards). */
  learnerWrites?: boolean;
  /** Kept when the account is deleted (owner-side records, e.g. the invite itself). */
  survivesDeletion?: boolean;
  /** Kept but unlinked on deletion (security audit log: user_id ON DELETE SET NULL). */
  anonymizedOnDeletion?: boolean;
};

/** One row per learner table, all owned by `uid`. `v` makes unique values distinct per call. */
export function seedPlan(uid: string, v: string): Entry[] {
  const id = () => crypto.randomUUID();
  const [lab, soc, kase, sub, grade, exam, invite] = [id(), id(), id(), id(), id(), id(), id()];
  const later = new Date(Date.now() + 3_600_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const own = (table: string, row: Record<string, unknown>, patch: Record<string, unknown>, ownerReads: boolean, extra: Partial<Entry> = {}): Entry => {
    const rid = id();
    return { table, key: ["id", rid], row: { id: rid, user_id: uid, ...row }, patch, ownerReads, ...extra };
  };
  return [
    { table: "operators", key: ["id", uid], row: { id: uid, handle: `verify_${v}_${uid.slice(0, 8)}`, rank: 0, ethics_accepted_at: new Date().toISOString() }, patch: { rank: 7 }, ownerReads: true, learnerWrites: true },
    own("lesson_progress", { lesson_id: `verify-${v}`, status: "in_progress" }, { status: "completed" }, true),
    { ...own("lab_attempts", { lab_id: `verify-lab-${v}`, seed: "verify-secret-seed", mode: "practice" }, { hints_used: 0 }, true), key: ["id", lab], row: { id: lab, user_id: uid, lab_id: `verify-lab-${v}`, seed: "verify-secret-seed", mode: "practice" } },
    own("rank_challenges", { rank: 1, lab_attempt_id: lab, status: "active" }, { status: "passed" }, true),
    own("xp_events", { source: `verify-${v}`, amount: 10 }, { amount: 100000 }, true),
    own("handler_usage", { date: today }, { requests_count: 0 }, true),
    own("attempt_lockouts", { action_type: `verify-${v}`, locked_until: later }, { locked_until: new Date(0).toISOString() }, true),
    own("audit_events", { event_type: `verify-${v}` }, { event_type: "tampered" }, true, { anonymizedOnDeletion: true }),
    own("exam_reports", { exam_type: `verify-${v}`, score: 1, max_score: 2, passed: false }, { notes: "edited" }, true, { learnerWrites: true }),
    own("review_items", { card_id: `card-${v}`, lesson_id: "verify" }, { lapses: 0 }, true, { learnerWrites: true }),
    own("review_events", { card_id: `card-${v}`, grade: 3 }, { grade: 4 }, true, { learnerWrites: true }),
    own("learning_events", { event_type: `verify-${v}` }, { event_type: "tampered" }, true, { learnerWrites: true }),
    { table: "soc_attempts", key: ["id", soc], row: { id: soc, user_id: uid, scenario_id: `verify-${v}` }, patch: { status: "submitted" }, ownerReads: true },
    { table: "soc_cases", key: ["id", kase], row: { id: kase, attempt_id: soc, title: "verify case" }, patch: { title: "tampered" }, ownerReads: true },
    { table: "soc_case_alerts", key: ["case_id", kase], row: { case_id: kase, alert_id: `A-${v}` }, patch: { alert_id: "A-x" }, ownerReads: true },
    { table: "soc_decisions", key: ["attempt_id", soc], row: { id: id(), attempt_id: soc, alert_id: `A-${v}`, disposition: "true_positive", severity: "HIGH", rationale: "verify" }, patch: { disposition: "false_positive" }, ownerReads: true },
    own("soc_enrichment_lookups", { attempt_id: soc, tool: "whois", entity_type: "ip", entity_value: "203.0.113.5", response_hash: "h" }, { entity_value: "198.51.100.1" }, true),
    own("soc_query_logs", { attempt_id: soc, query_text: "verify" }, { query_text: "tampered" }, true),
    own("soc_question_attempts", { attempt_id: soc, question_id: `q-${v}`, submitted_answer: "a" }, { submitted_answer: "b" }, true),
    { table: "soc_report_submissions", key: ["id", sub], row: { id: sub, attempt_id: soc, user_id: uid }, patch: { status: "submitted" }, ownerReads: true },
    own("soc_report_evaluations", { submission_id: sub, attempt_id: soc, rubric_version: "v", grader_version: "v", scoring_version: "v", total_score: 1, version_label: "v" }, { total_score: 100 }, true),
    { table: "soc_ai_criterion_grades", key: ["id", grade], row: { id: grade, submission_id: sub, attempt_id: soc, user_id: uid, criterion_id: "c", status: "graded", ai_rubric_id: "r", ai_rubric_version: "v", prompt_version: "v", grader_version: "v", model_id: "m", input_hash: `h-${v}`, cache_key: `k-${v}` }, patch: { status: "not_graded" }, ownerReads: true },
    own("soc_ai_grading_jobs", { submission_id: sub, attempt_id: soc, criterion_id: "c", idempotency_key: crypto.createHash("sha256").update(`verify-${v}-${uid}`).digest("hex") }, { status: "dead" }, false),
    own("soc_ai_raw_outputs", { grade_id: grade, sample_index: 0, attempt: 1, raw_text: "RAW MODEL OUTPUT", prompt_hash: "p" }, { raw_text: "x" }, false),
    own("soc_ai_review_items", { grade_id: grade, submission_id: sub, criterion_id: "c", reason: "random_sample" }, { status: "resolved" }, false),
    own("soc_ai_human_review_requests", { submission_id: sub }, { status: "resolved" }, true),
    { table: "soc_ai_calibration_consent", key: ["user_id", uid], row: { user_id: uid, consent_version: "v1" }, patch: { consent_version: "v2" }, ownerReads: true },
    { table: "soc_exam_attempts", key: ["id", exam], row: { id: exam, user_id: uid, format: "knowledge", config_version: 1, variant_id: "verify", seed: "verify-exam-seed", deadline_at: later }, patch: { result: { passed: true, score: 100 } }, ownerReads: true },
    own("soc_exam_answers", { exam_attempt_id: exam, item_id: `i-${v}`, answer: "a" }, { answer: "b" }, true),
    own("soc_exam_outcome_reports", { cert_family: "verify", exam_date: today, passed: true, consent_version: "v1" }, { passed: false }, false),
    { table: "soc_exam_accommodations", key: ["user_id", uid], row: { user_id: uid, multiplier: 1.5, reason: "verify", set_by: "staging-verify" }, patch: { multiplier: 2 }, ownerReads: false },
    own("soc_used_seeds", { family_id: `verify-${v}`, seed: "s" }, { seed: "t" }, false),
    { table: "beta_notice_acks", key: ["user_id", uid], row: { user_id: uid, notice_version: `verify-${v}` }, patch: { notice_version: "x" }, ownerReads: true },
    own("learner_feedback", { kind: "general", message: "verify", request_id: `req-verify-${v}` }, { message: "tampered" }, true),
    { table: "beta_invites", key: ["id", invite], row: { id: invite, code_hash: crypto.randomBytes(32).toString("hex"), max_uses: 1, expires_at: later, created_by: "staging-verify" }, patch: { max_uses: 999 }, ownerReads: false, survivesDeletion: true },
    own("beta_invite_redemptions", { invite_id: invite }, { invite_id: invite }, true),
  ];
}

/** Columns that must stay unreadable to the owner (seeds, ground truth, answer keys, raw prompts). */
export const HIDDEN_COLUMNS: Record<string, string[]> = {
  lab_attempts: ["seed"],
  soc_attempts: ["seed", "family_id"],
  soc_exam_attempts: ["seed", "variant_id", "item_ids"],
  beta_invite_redemptions: ["invite_id"],
};

const refusedCode = (e: Res["error"]) => !!e && (e.code === "42501" || /permission denied|row-level security|Unauthorized/i.test(e.message));

export async function runStagingChecks(p: {
  svc: DbAs;
  a: DbAs;
  b: DbAs;
  uidA: string;
  uidB: string;
  /** Removes the auth user (admin API / DELETE FROM auth.users), as the app's deletion flow does. */
  deleteAuthUser: (uid: string) => Promise<void>;
}): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail: detail || undefined });
  const plan = seedPlan(p.uidA, "a");

  // Seed A's rows and B's profile with the service role.
  const seedErrors: string[] = [];
  for (const e of plan) {
    const r = await p.svc.insert(e.table, e.row);
    if (r.error) seedErrors.push(`${e.table}: ${r.error.message.slice(0, 80)}`);
  }
  const bProfile = seedPlan(p.uidB, "b")[0];
  const rb = await p.svc.insert(bProfile.table, bProfile.row);
  if (rb.error) seedErrors.push(`operators(B): ${rb.error.message.slice(0, 80)}`);
  add(`seeded ${plan.length} learner tables for A`, seedErrors.length === 0, seedErrors.join("; "));
  if (seedErrors.length) return checks;

  const snapshot = async () => {
    const out: Record<string, string> = {};
    for (const e of plan) out[e.table] = JSON.stringify((await p.svc.select(e.table, "*", e.key)).rows);
    return out;
  };
  const before = await snapshot();

  // A reads own rows where a policy allows; service-only tables stay closed even to the owner.
  const ownRead: string[] = [];
  for (const e of plan) {
    const r = await p.a.select(e.table, e.key[0], e.key);
    const sees = !r.error && r.rows.length > 0;
    if (sees !== e.ownerReads) ownRead.push(`${e.table} (${sees ? "readable" : "unreadable"})`);
  }
  add("owner reads exactly the tables meant for them (raw AI output, jobs, seeds, accommodations, invites closed)", ownRead.length === 0, ownRead.join(", "));

  // B: no reads, inserts, updates or deletes on A's rows.
  const leaks: string[] = [];
  const bCopies = seedPlan(p.uidA, "b");
  for (const [i, e] of plan.entries()) {
    const r = await p.b.select(e.table, e.key[0], e.key);
    if (!r.error && r.rows.length > 0) leaks.push(`${e.table}: read`);
    const ins = await p.b.insert(e.table, bCopies[i].row);
    if (!refusedCode(ins.error)) leaks.push(`${e.table}: insert ${ins.error ? `inconclusive (${ins.error.message.slice(0, 60)})` : "accepted"}`);
    const up = await p.b.update(e.table, e.patch, e.key);
    if (!up.error && (up.count ?? 0) > 0) leaks.push(`${e.table}: update`);
    const del = await p.b.delete(e.table, e.key);
    if (!del.error && (del.count ?? 0) > 0) leaks.push(`${e.table}: delete`);
  }
  const bDel = await p.b.rpc("delete_user_account", { target_user_id: p.uidA });
  if (!refusedCode(bDel.error)) leaks.push("delete_user_account(A) as B not refused");
  add("learner B cannot read, insert, update or delete learner A's rows", leaks.length === 0, leaks.join(", "));

  // A cannot write platform-authored rows, even their own (scores, seeds, grades, XP, rank, exam result).
  const writes: string[] = [];
  const aCopies = seedPlan(p.uidA, "a2");
  for (const [i, e] of plan.entries()) {
    if (e.learnerWrites) continue;
    const ins = await p.a.insert(e.table, aCopies[i].row);
    if (!refusedCode(ins.error)) writes.push(`${e.table}: insert ${ins.error ? `inconclusive (${ins.error.message.slice(0, 60)})` : "accepted"}`);
    const up = await p.a.update(e.table, e.patch, e.key);
    if (!up.error && (up.count ?? 0) > 0) writes.push(`${e.table}: update`);
    const del = await p.a.delete(e.table, e.key);
    if (!del.error && (del.count ?? 0) > 0) writes.push(`${e.table}: delete`);
  }
  const rank = await p.a.update("operators", { rank: 7 }, ["id", p.uidA]);
  if (!rank.error && (rank.count ?? 0) > 0) writes.push("operators.rank raised");
  add("learners cannot write scores, seeds, grades, XP, rank or exam results", writes.length === 0, writes.join(", "));

  const after = await snapshot();
  const changed = plan.filter((e) => before[e.table] !== after[e.table]).map((e) => e.table);
  add("A's rows unchanged after every refused write (service-role snapshot)", changed.length === 0, changed.join(", "));

  // Ground truth columns closed; exam result unmarked while active.
  const visibleHidden: string[] = [];
  for (const [table, cols] of Object.entries(HIDDEN_COLUMNS)) {
    const key = plan.find((e) => e.table === table)!.key;
    for (const c of cols) if (!refusedCode((await p.a.select(table, c, key)).error)) visibleHidden.push(`${table}.${c}`);
  }
  add("seeds, ground truth and answer keys unreadable to the owner", visibleHidden.length === 0, visibleHidden.join(", "));
  const examKey = plan.find((e) => e.table === "soc_exam_attempts")!.key;
  const exam = await p.a.select("soc_exam_attempts", "status, result", examKey);
  add("an active exam attempt is unmarked (result null) to the learner", !exam.error && exam.rows.length === 1 && exam.rows[0].result === null && exam.rows[0].status === "active", exam.error?.message);

  // Deletion: A deletes their account; nothing A owned remains.
  const del = await p.a.rpc("delete_user_account", { target_user_id: p.uidA });
  await p.deleteAuthUser(p.uidA);
  const remaining: string[] = [];
  for (const e of plan) {
    if (e.survivesDeletion) continue;
    if (e.anonymizedOnDeletion) {
      const r = await p.svc.select(e.table, "user_id", e.key);
      if (r.rows.some((row) => row.user_id !== null)) remaining.push(`${e.table} (still linked)`);
      continue;
    }
    const r = await p.svc.select(e.table, e.key[0], e.key);
    if (r.rows.length > 0) remaining.push(e.table);
  }
  add("account deletion removes every row the learner owned", !del.error && remaining.length === 0, del.error?.message ?? remaining.join(", "));
  return checks;
}
