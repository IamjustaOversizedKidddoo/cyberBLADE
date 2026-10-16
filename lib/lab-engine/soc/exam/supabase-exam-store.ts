/**
 * Hosted (Supabase) storage for SOC exam mode. Called through SupabaseProgressRepo with the
 * service-role client: learners have no write privileges on these tables (see migration
 * 20261015120000_phase_3_soc_exams.sql). The exam start is the atomic SQL function.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SocExamAccommodation,
  SocExamAnswerRecord,
  SocExamAttemptRecord,
  SocExamOutcomeReport,
  SocExamResult,
  SocDetectionRuleRecord,
} from "./types";

type Row = Record<string, unknown>;
// The generated Database type predates these tables; the store maps rows by hand.
type Client = SupabaseClient;

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`exam store: ${what} failed (${res.error.message})`);
  return res.data;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export const examFromRow = (r: Row): SocExamAttemptRecord => ({
  id: r.id as string,
  userId: r.user_id as string,
  format: r.format as SocExamAttemptRecord["format"],
  configVersion: r.config_version as number,
  variantId: r.variant_id as string,
  socAttemptId: (r.soc_attempt_id as string | null) ?? null,
  seed: r.seed as string,
  itemIds: (r.item_ids as string[] | null) ?? [],
  status: r.status as SocExamAttemptRecord["status"],
  submitReason: (r.submit_reason as SocExamAttemptRecord["submitReason"]) ?? null,
  startedAt: iso(r.started_at)!,
  deadlineAt: iso(r.deadline_at)!,
  timeMultiplier: Number(r.time_multiplier),
  submittedAt: iso(r.submitted_at),
  result: (r.result as SocExamResult | null) ?? null,
});

const answerFromRow = (r: Row): SocExamAnswerRecord => ({
  id: r.id as string,
  examAttemptId: r.exam_attempt_id as string,
  userId: r.user_id as string,
  itemId: r.item_id as string,
  answer: r.answer as string,
  answeredAt: iso(r.answered_at)!,
});

export async function createExamAtomic(
  c: Client,
  input: { attempt: Omit<SocExamAttemptRecord, "id">; cooldownMinutes: number; maxAttempts: number; windowDays: number },
): Promise<SocExamAttemptRecord> {
  const a = input.attempt;
  const res = await c.rpc("soc_start_exam_attempt", {
    p_user_id: a.userId,
    p_format: a.format,
    p_config_version: a.configVersion,
    p_variant_id: a.variantId,
    p_id: randomUUID(),
    p_seed: a.seed,
    p_item_ids: a.itemIds,
    p_started_at: a.startedAt,
    p_deadline_at: a.deadlineAt,
    p_time_multiplier: a.timeMultiplier,
    p_cooldown_minutes: input.cooldownMinutes,
    p_max_attempts: input.maxAttempts,
    p_window_days: input.windowDays,
  });
  if (res.error) {
    const m = /exam is active|exam is cooling down|exam retake limit reached/.exec(res.error.message);
    throw new Error(m ? m[0] : `exam store: start failed (${res.error.message})`);
  }
  const rows = res.data as Row[];
  return examFromRow(rows[0]);
}

export async function getExam(c: Client, id: string): Promise<SocExamAttemptRecord | null> {
  const row = check(await c.from("soc_exam_attempts").select("*").eq("id", id).maybeSingle(), "get exam");
  return row ? examFromRow(row as Row) : null;
}

export async function listExams(c: Client, userId: string): Promise<SocExamAttemptRecord[]> {
  const rows = check(await c.from("soc_exam_attempts").select("*").eq("user_id", userId).order("started_at", { ascending: false }), "list exams");
  return (rows as Row[]).map(examFromRow);
}

export async function findActiveExam(c: Client, userId: string): Promise<SocExamAttemptRecord | null> {
  const row = check(await c.from("soc_exam_attempts").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(), "find active exam");
  return row ? examFromRow(row as Row) : null;
}

export async function findExamBySocAttempt(c: Client, socAttemptId: string): Promise<SocExamAttemptRecord | null> {
  const row = check(await c.from("soc_exam_attempts").select("*").eq("soc_attempt_id", socAttemptId).maybeSingle(), "find exam by soc attempt");
  return row ? examFromRow(row as Row) : null;
}

export async function setExamSocAttempt(c: Client, id: string, socAttemptId: string): Promise<SocExamAttemptRecord> {
  const rows = check(
    await c.from("soc_exam_attempts").update({ soc_attempt_id: socAttemptId }).eq("id", id).eq("status", "active").is("soc_attempt_id", null).select("*"),
    "link soc attempt",
  ) as Row[];
  if (rows.length) return examFromRow(rows[0]);
  const cur = await getExam(c, id);
  if (!cur) throw new Error("Exam attempt not found");
  if (cur.status !== "active") throw new Error("exam is closed");
  return cur;
}

export async function finalizeExam(
  c: Client,
  id: string,
  patch: Pick<SocExamAttemptRecord, "submitReason" | "submittedAt" | "result">,
): Promise<{ record: SocExamAttemptRecord; changed: boolean }> {
  const rows = check(
    await c
      .from("soc_exam_attempts")
      .update({ status: "submitted", submit_reason: patch.submitReason, submitted_at: patch.submittedAt, result: patch.result })
      .eq("id", id)
      .eq("status", "active")
      .select("*"),
    "finalize exam",
  ) as Row[];
  if (rows.length) return { record: examFromRow(rows[0]), changed: true };
  const cur = await getExam(c, id);
  if (!cur) throw new Error("Exam attempt not found");
  return { record: cur, changed: false };
}

export async function saveAnswer(c: Client, a: Omit<SocExamAnswerRecord, "id">): Promise<SocExamAnswerRecord> {
  const res = await c
    .from("soc_exam_answers")
    .upsert(
      { exam_attempt_id: a.examAttemptId, user_id: a.userId, item_id: a.itemId, answer: a.answer, answered_at: a.answeredAt },
      { onConflict: "exam_attempt_id,item_id" },
    )
    .select("*")
    .single();
  if (res.error) throw new Error(/exam is closed/.test(res.error.message) ? "exam is closed" : `exam store: save answer failed (${res.error.message})`);
  return answerFromRow(res.data as Row);
}

export async function listAnswers(c: Client, examAttemptId: string): Promise<SocExamAnswerRecord[]> {
  return (check(await c.from("soc_exam_answers").select("*").eq("exam_attempt_id", examAttemptId), "list answers") as Row[]).map(answerFromRow);
}

export async function saveOutcome(c: Client, r: Omit<SocExamOutcomeReport, "id" | "createdAt">): Promise<SocExamOutcomeReport> {
  const row = check(
    await c
      .from("soc_exam_outcome_reports")
      .insert({ user_id: r.userId, cert_family: r.certFamily, exam_date: r.examDate, passed: r.passed, consent_version: r.consentVersion })
      .select("*")
      .single(),
    "save outcome",
  ) as Row;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    certFamily: row.cert_family as string,
    examDate: String(row.exam_date).slice(0, 10),
    passed: row.passed as boolean,
    consentVersion: row.consent_version as string,
    createdAt: iso(row.created_at)!,
  };
}

export async function listOutcomes(c: Client, userId?: string): Promise<SocExamOutcomeReport[]> {
  let q = c.from("soc_exam_outcome_reports").select("*");
  if (userId) q = q.eq("user_id", userId);
  return (check(await q, "list outcomes") as Row[]).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    certFamily: row.cert_family as string,
    examDate: String(row.exam_date).slice(0, 10),
    passed: row.passed as boolean,
    consentVersion: row.consent_version as string,
    createdAt: iso(row.created_at)!,
  }));
}

export async function getAccommodation(c: Client, userId: string): Promise<SocExamAccommodation | null> {
  const row = check(await c.from("soc_exam_accommodations").select("*").eq("user_id", userId).maybeSingle(), "get accommodation") as Row | null;
  return row
    ? { userId: row.user_id as string, multiplier: Number(row.multiplier), reason: row.reason as string, setBy: row.set_by as string, setAt: iso(row.set_at)! }
    : null;
}

export async function setAccommodation(c: Client, rec: SocExamAccommodation): Promise<SocExamAccommodation> {
  check(
    await c
      .from("soc_exam_accommodations")
      .upsert({ user_id: rec.userId, multiplier: rec.multiplier, reason: rec.reason, set_by: rec.setBy, set_at: rec.setAt }, { onConflict: "user_id" }),
    "set accommodation",
  );
  return rec;
}

export const detectionRuleFromRow = (r: Row): SocDetectionRuleRecord => ({
  id: r.id as string,
  examAttemptId: (r.exam_attempt_id as string | null) ?? null,
  userId: r.user_id as string,
  title: r.title as string,
  description: (r.description as string) ?? "",
  severity: r.severity as SocDetectionRuleRecord["severity"],
  tactic: (r.tactic as string) ?? "",
  technique: (r.technique as string) ?? "",
  query: r.query as string,
  testResults: (r.test_results as SocDetectionRuleRecord["testResults"]) ?? null,
  submittedAt: iso(r.submitted_at)!,
});

export async function saveDetectionRule(
  c: Client,
  rule: Omit<SocDetectionRuleRecord, "id" | "submittedAt">,
): Promise<SocDetectionRuleRecord> {
  const row = check(
    await c
      .from("soc_detection_rules")
      .insert({
        exam_attempt_id: rule.examAttemptId,
        user_id: rule.userId,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        tactic: rule.tactic,
        technique: rule.technique,
        query: rule.query,
        test_results: rule.testResults,
      })
      .select()
      .single(),
    "save detection rule",
  );
  return detectionRuleFromRow(row as Row);
}

export async function listDetectionRules(c: Client, userId: string, examAttemptId?: string): Promise<SocDetectionRuleRecord[]> {
  let q = c.from("soc_detection_rules").select("*").eq("user_id", userId).order("submitted_at", { ascending: false });
  if (examAttemptId) q = q.eq("exam_attempt_id", examAttemptId);
  return (check(await q, "list detection rules") as Row[]).map(detectionRuleFromRow);
}
