import "server-only";
/**
 * SOC exam service (Stage 1). Server-authoritative: the deadline is stored at start and every
 * check uses the server clock; nothing is marked or revealed until the exam is submitted.
 * Scenario formats run on an ordinary SOC attempt whose scenarioId is "exam-<examId>", so the
 * existing engines do the work and the guards in ./guard enforce exam rules inside them.
 */
import type { Ctx } from "@/lib/progress/service";
import { examStartRefusal } from "@/lib/progress/repo";
import { isSocQueryEnabled, isSocWorkspaceEnabled } from "@/lib/config/env";
import { newSeed } from "@/lib/generators/rng";
import { loadSocFamily, loadSocShift, resolveScenarioForAttempt } from "../engine";
import { composeShiftScenario } from "../shift-composer";
import { generateSocVariant, computeScenarioHash, GENERATOR_VERSION } from "../generator";
import { evaluateSocAttempt } from "../evaluator";
import { generateScenarioQuestions } from "../query/questions";
import { markExamAnswers } from "../query/question-service";
import { submitSocReportGraded } from "../report-engine";
import type { SocAttemptRecord } from "../types";
import type { GradingResult } from "../reports/types";
import { loadExamConfig, type SocExamFormatConfig } from "./config";
import { EXAM_SCENARIO_PREFIX, examBudgetLimit, examBudgetUsed, examTimeIsOver } from "./guard";
import { drawKnowledgeItems, examItemKey, gradeKnowledgeAnswer, knowledgeItemReview, knowledgeItemView, loadKnowledgeBank, type KnowledgeAnswer, type KnowledgeItemView } from "./knowledge";
import { buildExamResult } from "./results";
import { SOC_EXAM_FORMATS, type SocExamAttemptRecord, type SocExamBudgetKind, type SocExamFormat, type SocExamResult } from "./types";

export const HANDOFF_ITEM_ID = "handoff";
export const HANDOFF_MAX_CHARS = 3000;
/** Exams submitted at or above this score earn the format's XP (once per exam). */
export const EXAM_XP_MIN_SCORE = 50;

export type ExamStateView = {
  examId: string;
  format: SocExamFormat;
  title: string;
  /** Withheld while the exam runs: it names the scenario family or shift (L1-A-02). */
  variantId: string | null;
  status: "active" | "submitted";
  startedAt: string;
  deadlineAt: string;
  /** Server clock at response time; the client only uses the difference for display. */
  serverNow: string;
  remainingSeconds: number;
  timeMultiplier: number;
  socAttemptId: string | null;
  searchEnabled: boolean;
  budgets: Partial<Record<SocExamBudgetKind, { used: number; limit: number }>>;
  knowledgeItems: Array<KnowledgeItemView & { savedAnswer: KnowledgeAnswer | null }> | null;
  handoffNote: string | null;
  /** Only after submission. */
  result: SocExamResult | null;
  /** Only after submission: the learner's own knowledge review. */
  knowledgeReview: Record<string, { correctOptionIds: string[]; explanation: string; correct: boolean }> | null;
};

const formatConfig = (format: SocExamFormat): SocExamFormatConfig => loadExamConfig().formats[format];
const isScenarioFormat = (format: SocExamFormat) => format !== "knowledge";

async function ownedExam(ctx: Ctx, userId: string, examId: string): Promise<SocExamAttemptRecord> {
  const exam = typeof examId === "string" ? await ctx.repo.getSocExamAttempt(examId) : null;
  if (!exam || exam.userId !== userId) throw new Error("Exam attempt not found");
  return exam;
}

function parseAnswer(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Least-used variant of this format for the learner; ties broken by the new seed. */
function pickVariant(variants: string[], previous: SocExamAttemptRecord[], seed: string): string {
  const uses = new Map(variants.map((v) => [v, 0]));
  for (const p of previous) if (uses.has(p.variantId)) uses.set(p.variantId, uses.get(p.variantId)! + 1);
  const least = Math.min(...uses.values());
  const candidates = variants.filter((v) => uses.get(v) === least);
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return candidates[h % candidates.length];
}

async function newExamSeed(ctx: Ctx, userId: string, format: SocExamFormat): Promise<string> {
  const used = new Set(await ctx.repo.listUsedSeeds(userId, `exam:${format}`));
  let seed = newSeed();
  for (let i = 0; i < 10 && used.has(seed); i++) seed = newSeed();
  if (used.has(seed)) throw new Error("Could not pick a fresh exam variant. Please try again.");
  return seed;
}

async function createExamSocAttempt(ctx: Ctx, exam: SocExamAttemptRecord): Promise<SocAttemptRecord> {
  const now = ctx.now().toISOString();
  const base = { userId: exam.userId, scenarioId: `${EXAM_SCENARIO_PREFIX}${exam.id}`, seed: exam.seed, status: "in_progress" as const, scoreSummary: null, startedAt: exam.startedAt, submittedAt: null, updatedAt: now, generatorVersion: GENERATOR_VERSION };
  if (exam.variantId.startsWith("shift-")) {
    const shift = await loadSocShift(exam.variantId);
    const scenario = composeShiftScenario(shift, exam.seed);
    return ctx.repo.createSocAttempt({ ...base, familyId: exam.variantId, familyVersion: shift.version, difficulty: shift.difficulty, scenarioHash: computeScenarioHash(scenario) });
  }
  const family = await loadSocFamily(exam.variantId);
  const difficulty = formatConfig(exam.format).difficulty ?? "intermediate";
  const { contentHash } = generateSocVariant(family, exam.seed, difficulty);
  return ctx.repo.createSocAttempt({ ...base, familyId: exam.variantId, familyVersion: family.metadata.version, difficulty, scenarioHash: contentHash });
}

/** Scenario exams get their SOC attempt at start; if that step failed, the next read retries it. */
async function ensureSocAttempt(ctx: Ctx, exam: SocExamAttemptRecord): Promise<SocExamAttemptRecord> {
  if (!isScenarioFormat(exam.format) || exam.socAttemptId || exam.status !== "active") return exam;
  const attempt = await createExamSocAttempt(ctx, exam);
  return (await ctx.repo.setSocExamSocAttempt(exam.id, attempt.id)) ?? exam;
}

export async function startExam(ctx: Ctx, userId: string, format: SocExamFormat): Promise<ExamStateView> {
  if (!SOC_EXAM_FORMATS.includes(format)) throw new Error("Unknown exam format");
  const config = loadExamConfig();
  const f = config.formats[format];
  const now = ctx.now();
  const previous = (await ctx.repo.listSocExamAttempts(userId)).filter((e) => e.format === format);
  const seed = await newExamSeed(ctx, userId, format);
  const accommodation = await ctx.repo.getSocExamAccommodation(userId);
  const multiplier = accommodation?.multiplier ?? 1;

  let variantId = "bank";
  let itemIds: string[] = [];
  if (format === "knowledge") {
    const seen = [...previous].reverse().flatMap((e) => e.itemIds);
    itemIds = drawKnowledgeItems(loadKnowledgeBank(), f.itemCount ?? 25, seed, seen);
  } else {
    variantId = pickVariant(f.variants ?? [], previous, seed);
  }

  const exam = await ctx.repo.createSocExamAttemptAtomic({
    attempt: {
      userId,
      format,
      configVersion: config.version,
      variantId,
      socAttemptId: null,
      seed,
      itemIds,
      status: "active",
      submitReason: null,
      startedAt: now.toISOString(),
      deadlineAt: new Date(now.getTime() + Math.round(f.durationMinutes * 60 * multiplier) * 1000).toISOString(),
      timeMultiplier: multiplier,
      submittedAt: null,
      result: null,
    },
    cooldownMinutes: f.cooldownMinutes,
    maxAttempts: f.maxAttempts.count,
    windowDays: f.maxAttempts.windowDays,
    now,
  });
  await ctx.repo.recordUsedSeed(userId, `exam:${format}`, seed);
  if (isScenarioFormat(format)) await ctx.repo.recordUsedSeed(userId, variantId, seed);
  await ensureSocAttempt(ctx, exam);
  return getExamState(ctx, userId, exam.id);
}

export async function getExamState(ctx: Ctx, userId: string, examId: string): Promise<ExamStateView> {
  let exam = await ownedExam(ctx, userId, examId);
  if (exam.status === "active" && examTimeIsOver(exam, ctx.now())) {
    await finalizeExam(ctx, exam, "deadline");
    exam = await ownedExam(ctx, userId, examId);
  }
  exam = await ensureSocAttempt(ctx, exam);
  const f = formatConfig(exam.format);
  const now = ctx.now();
  const answers = await ctx.repo.listSocExamAnswers(exam.id);
  const answerFor = (itemId: string) => {
    const a = answers.find((x) => x.itemId === itemId);
    return a ? parseAnswer(a.answer) : null;
  };

  const budgets: ExamStateView["budgets"] = {};
  if (exam.socAttemptId) {
    for (const kind of ["queries", "lookups", "questionAnswers"] as const) {
      const limit = examBudgetLimit(exam, kind);
      if (f.budgets[kind] !== undefined) budgets[kind] = { used: await examBudgetUsed(ctx, exam.socAttemptId, kind), limit };
    }
  }

  let knowledgeItems: ExamStateView["knowledgeItems"] = null;
  let knowledgeReview: ExamStateView["knowledgeReview"] = null;
  if (exam.format === "knowledge") {
    const bank = loadKnowledgeBank();
    const items = exam.itemIds.map((id) => bank.items.find((i) => i.id === id)).filter((i) => !!i);
    knowledgeItems = items.map((item) => {
      const saved = answerFor(examItemKey(exam.seed, item.id));
      return { ...knowledgeItemView(item, exam.seed), savedAnswer: Array.isArray(saved) ? (saved as string[]) : null };
    });
    if (exam.status === "submitted") {
      knowledgeReview = Object.fromEntries(
        items.map((item) => {
          const key = examItemKey(exam.seed, item.id);
          const saved = answerFor(key);
          return [key, { ...knowledgeItemReview(item, exam.seed), correct: gradeKnowledgeAnswer(item, exam.seed, Array.isArray(saved) ? (saved as string[]) : null) }];
        }),
      );
    }
  }

  const handoff = answerFor(HANDOFF_ITEM_ID);
  return {
    examId: exam.id,
    format: exam.format,
    title: f.title,
    variantId: exam.status === "active" ? null : exam.variantId,
    status: exam.status,
    startedAt: exam.startedAt,
    deadlineAt: exam.deadlineAt,
    serverNow: now.toISOString(),
    remainingSeconds: exam.status === "active" ? Math.max(0, Math.floor((Date.parse(exam.deadlineAt) - now.getTime()) / 1000)) : 0,
    timeMultiplier: exam.timeMultiplier,
    socAttemptId: exam.socAttemptId,
    searchEnabled: isSocQueryEnabled(),
    budgets,
    knowledgeItems,
    handoffNote: typeof handoff === "string" ? handoff : null,
    result: exam.status === "submitted" ? exam.result : null,
    knowledgeReview,
  };
}

async function assertAnswerable(ctx: Ctx, userId: string, examId: string): Promise<SocExamAttemptRecord> {
  const exam = await ownedExam(ctx, userId, examId);
  if (examTimeIsOver(exam, ctx.now())) throw new Error("Exam time is over. Your work has been saved for submission.");
  return exam;
}

/** Saves (or replaces) a knowledge answer. The response never says whether it is right. */
export async function saveKnowledgeAnswer(ctx: Ctx, userId: string, examId: string, itemKey: string, answer: KnowledgeAnswer): Promise<{ saved: true }> {
  const exam = await assertAnswerable(ctx, userId, examId);
  // The learner only knows the opaque per-exam key; the answer is stored under that key too.
  const itemId = exam.format === "knowledge" && exam.itemIds.some((id) => examItemKey(exam.seed, id) === itemKey) ? itemKey : null;
  if (!itemId) throw new Error("Unknown exam item");
  if (!Array.isArray(answer) || answer.length > 8 || answer.some((a) => typeof a !== "string" || a.length > 24)) throw new Error("Invalid answer");
  await ctx.repo.saveSocExamAnswer({ examAttemptId: exam.id, userId, itemId, answer: JSON.stringify(answer), answeredAt: ctx.now().toISOString() });
  return { saved: true };
}

/** Saves the alert-queue handoff note (latest save counts). */
export async function saveHandoffNote(ctx: Ctx, userId: string, examId: string, text: string): Promise<{ saved: true }> {
  const exam = await assertAnswerable(ctx, userId, examId);
  if (!("handoff" in formatConfig(exam.format).weights)) throw new Error("This exam has no handoff note");
  if (typeof text !== "string") throw new Error("Invalid handoff note");
  const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, HANDOFF_MAX_CHARS);
  await ctx.repo.saveSocExamAnswer({ examAttemptId: exam.id, userId, itemId: HANDOFF_ITEM_ID, answer: JSON.stringify(clean), answeredAt: ctx.now().toISOString() });
  return { saved: true };
}

// One finalisation at a time per exam in this process. Across instances the repo's conditional
// finalize keeps the stored result and the XP award single (XP source is unique per exam).
const finalizing = new Map<string, Promise<void>>();

async function finalizeExam(ctx: Ctx, exam: SocExamAttemptRecord, reason: "learner" | "deadline"): Promise<void> {
  const prev = finalizing.get(exam.id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => finalizeOnce(ctx, exam.id, reason));
  finalizing.set(exam.id, run);
  try {
    await run;
  } finally {
    if (finalizing.get(exam.id) === run) finalizing.delete(exam.id);
  }
}

async function finalizeOnce(ctx: Ctx, examId: string, reason: "learner" | "deadline"): Promise<void> {
  const exam = await ctx.repo.getSocExamAttempt(examId);
  if (!exam || exam.status !== "active") return;
  const f = formatConfig(exam.format);
  // A learner submission that arrives after the deadline counts as a deadline submission.
  const submittedAtDate = ctx.now();
  const submitReason = reason === "learner" && submittedAtDate.getTime() <= Date.parse(exam.deadlineAt) ? "learner" : "deadline";
  const submittedAt = submittedAtDate.toISOString();
  const answers = await ctx.repo.listSocExamAnswers(exam.id);

  let input: Parameters<typeof buildExamResult>[0] = {
    exam,
    config: f,
    submittedAt,
    submitReason,
    evaluation: null,
    alertSources: {},
    alertIds: [],
    decisions: [],
    activity: { queries: [], lookups: [], questionAnswers: [] },
    questionsTotal: null,
    report: null,
    reportState: "not_applicable",
    handoffText: null,
    knowledge: null,
  };

  if (exam.format === "knowledge") {
    const bank = loadKnowledgeBank();
    input.knowledge = exam.itemIds.flatMap((id) => {
      const item = bank.items.find((i) => i.id === id);
      if (!item) return [];
      const a = answers.find((x) => x.itemId === examItemKey(exam.seed, id));
      const parsed = a ? parseAnswer(a.answer) : null;
      return [{ item, correct: gradeKnowledgeAnswer(item, exam.seed, Array.isArray(parsed) ? (parsed as string[]) : null), answeredAt: a?.answeredAt ?? null }];
    });
  } else if (exam.socAttemptId) {
    const attempt = await ctx.repo.getSocAttempt(exam.socAttemptId);
    if (!attempt) throw new Error("Exam workspace not found");
    const scenario = await resolveScenarioForAttempt(attempt);
    const [decisions, cases, queries, lookups, questionAttempts] = await Promise.all([
      ctx.repo.listSocDecisions(attempt.id),
      ctx.repo.listSocCases(attempt.id),
      ctx.repo.listSocQueryLogs(attempt.id),
      ctx.repo.listSocEnrichmentLookups(attempt.id),
      ctx.repo.listSocQuestionAttempts(attempt.id),
    ]);
    // Only work done before the deadline counts.
    const inTime = <T extends { createdAt?: string }>(rows: T[]) => rows.filter((r) => !r.createdAt || Date.parse(r.createdAt) <= Date.parse(exam.deadlineAt));
    const timedDecisions = inTime(decisions);
    const evaluation = evaluateSocAttempt(attempt.id, scenario, timedDecisions, cases, submittedAt);
    if (attempt.status === "in_progress") await ctx.repo.updateSocAttempt(attempt.id, { status: "submitted", submittedAt, scoreSummary: evaluation });

    let report: GradingResult | null = null;
    let reportState: "graded" | "absent" | "not_applicable" = "not_applicable";
    if ("report" in f.weights) {
      const draft = (await ctx.repo.listSocReportSubmissions(attempt.id)).find((r) => r.templateId === "incident-report-l1");
      if (draft) {
        report = (await submitSocReportGraded(ctx, exam.userId, attempt, draft.reportData)).gradingResult;
        reportState = "graded";
      } else reportState = "absent";
    }

    const searchOn = isSocQueryEnabled() && (f.budgets.questionAnswers ?? 0) > 0;
    const questionSet = generateScenarioQuestions(scenario, attempt.seed, attempt.familyId ?? attempt.scenarioId);
    const questionsTotal = searchOn ? questionSet.learnerQuestions.length : null;
    // Answers were stored unmarked during the exam; mark them here, at submission.
    const markedAnswers = markExamAnswers(inTime(questionAttempts), questionSet.serverTruths);
    const handoff = answers.find((a) => a.itemId === HANDOFF_ITEM_ID);
    const handoffParsed = handoff ? parseAnswer(handoff.answer) : null;

    input = {
      ...input,
      evaluation,
      alertSources: Object.fromEntries(scenario.alerts.map((a) => [a.id, a.source])),
      alertIds: scenario.alerts.map((a) => a.id),
      decisions: timedDecisions,
      activity: {
        queries: inTime(queries).map((q) => q.createdAt!).filter(Boolean),
        lookups: inTime(lookups).map((l) => ({ at: l.createdAt!, entity: l.entityValue })),
        questionAnswers: markedAnswers.map((q) => ({ at: q.createdAt!, questionId: q.questionId, isCorrect: q.isCorrect })),
      },
      questionsTotal,
      report,
      reportState,
      handoffText: typeof handoffParsed === "string" ? handoffParsed : null,
    };
  }

  const result = buildExamResult(input);
  const { changed } = await ctx.repo.finalizeSocExamAttempt(exam.id, { submitReason, submittedAt, result });
  if (changed && result.scorePercent >= EXAM_XP_MIN_SCORE && f.xp > 0) await ctx.repo.awardXp(exam.userId, `soc_exam:${exam.id}`, f.xp);
}

/** Idempotent: submitting twice (or from two tabs) returns the same stored result. */
export async function submitExam(ctx: Ctx, userId: string, examId: string): Promise<ExamStateView> {
  const exam = await ownedExam(ctx, userId, examId);
  if (exam.status === "active") await finalizeExam(ctx, exam, "learner");
  return getExamState(ctx, userId, examId);
}

/** The learner's active exam, finalising it first if its time ran out. */
export async function getActiveExam(ctx: Ctx, userId: string): Promise<SocExamAttemptRecord | null> {
  const active = await ctx.repo.findActiveSocExam(userId);
  if (!active) return null;
  if (examTimeIsOver(active, ctx.now())) {
    await finalizeExam(ctx, active, "deadline");
    return null;
  }
  return active;
}

export type ExamLobbyView = {
  provisional: boolean;
  activeExamId: string | null;
  timeMultiplier: number;
  formats: Array<{
    format: SocExamFormat;
    title: string;
    summary: string;
    durationMinutes: number;
    budgets: SocExamFormatConfig["budgets"];
    itemCount: number | null;
    variantCount: number;
    cooldownMinutes: number;
    maxAttempts: SocExamFormatConfig["maxAttempts"];
    weights: Record<string, number>;
    countsForReadiness: boolean;
    available: boolean;
    unavailableReason: string | null;
  }>;
  history: Array<{ examId: string; format: SocExamFormat; title: string; status: "active" | "submitted"; scorePercent: number | null; startedAt: string; submittedAt: string | null; submitReason: string | null }>;
};

const REFUSAL_TEXT: Record<string, string> = {
  "exam is active": "Finish your current exam first.",
  "exam is cooling down": "Cooling down after your last attempt of this format.",
  "exam retake limit reached": "Attempt limit for this period reached.",
  "not open": "Not open yet.",
};

export async function getExamLobby(ctx: Ctx, userId: string): Promise<ExamLobbyView> {
  const config = loadExamConfig();
  await getActiveExam(ctx, userId);
  const exams = await ctx.repo.listSocExamAttempts(userId);
  const accommodation = await ctx.repo.getSocExamAccommodation(userId);
  const now = ctx.now();
  return {
    provisional: config.provisional,
    activeExamId: exams.find((e) => e.status === "active")?.id ?? null,
    timeMultiplier: accommodation?.multiplier ?? 1,
    formats: SOC_EXAM_FORMATS.map((format) => {
      const f = config.formats[format];
      // Scenario formats run in the SOC workspace; with it switched off they are "not open yet"
      // instead of a Start button that fails (L1-A-07).
      const closed = format !== "knowledge" && !isSocWorkspaceEnabled();
      const refusal = closed ? "not open" : examStartRefusal(exams, { attempt: { userId, format }, cooldownMinutes: f.cooldownMinutes, maxAttempts: f.maxAttempts.count, windowDays: f.maxAttempts.windowDays, now });
      return {
        format,
        title: f.title,
        summary: f.summary,
        durationMinutes: Math.round(f.durationMinutes * (accommodation?.multiplier ?? 1)),
        budgets: f.budgets,
        itemCount: f.itemCount ?? null,
        variantCount: f.variants?.length ?? 0,
        cooldownMinutes: f.cooldownMinutes,
        maxAttempts: f.maxAttempts,
        weights: f.weights,
        countsForReadiness: f.countsForReadiness,
        available: refusal === null,
        unavailableReason: refusal ? (REFUSAL_TEXT[refusal] ?? refusal) : null,
      };
    }),
    history: exams.map((e) => ({ examId: e.id, format: e.format, title: config.formats[e.format].title, status: e.status, scorePercent: e.result?.scorePercent ?? null, startedAt: e.startedAt, submittedAt: e.submittedAt, submitReason: e.submitReason })),
  };
}
