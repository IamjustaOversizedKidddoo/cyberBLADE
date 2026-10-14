/**
 * Asynchronous, table-backed AI grading.
 *   enqueueAiGrading: called after a report is submitted (and deterministically graded).
 *   processAiGradingJobs: worker; run via next/server after() and `npm run soc:ai:worker`.
 * Everything that can fail degrades to "Not graded: <reason>"; nothing guesses a score.
 */
import { toClientView, type SocScenario } from "../schema";
import type { ReportTemplate, SocReportData } from "../reports/types";
import type { SocAttemptRecord, SocReportSubmissionRecord } from "../types";
import { loadAiGradingConfig, loadAiRubric, type AiGradingConfig } from "./config";
import { resolveEffectiveMode, type EffectiveMode } from "./gate";
import { gradeCriterion, ProviderUnavailableError, type CriterionOutcome, type TokenBudget } from "./grade-criterion";
import { computeInputHash, sha256 } from "./prompt";
import type { AiCompletionProvider } from "./provider";
import { buildPrefilterContext, prepareSubmission, type PreparedSubmission } from "./session";
import type { AiGradingStore } from "./store/types";
import type { AiCriterionGradeRecord, AiCriterionId, AiGradingJobRecord, AiReviewReason, AiRubric, AiRubricCriterion, NotGradedReason } from "./types";

export interface AiPipelineDeps {
  store: AiGradingStore;
  getSubmission(id: string): Promise<SocReportSubmissionRecord | null>;
  getAttempt(id: string): Promise<SocAttemptRecord | null>;
  resolveScenario(attempt: SocAttemptRecord): Promise<SocScenario>;
  loadTemplate(templateId: string): Promise<Pick<ReportTemplate, "sections">>;
  learnerHandles(userId: string): Promise<string[]>;
  provider: AiCompletionProvider;
  now(): Date;
  env?: NodeJS.ProcessEnv;
  config?: AiGradingConfig;
  rubric?: AiRubric;
  gateDir?: string;
}

const GLOBAL = "__global__";
const day = (d: Date) => d.toISOString().slice(0, 10);
export const userUsageKey = (userId: string, d: Date) => `${userId}:${day(d)}`;
export const globalUsageKey = (d: Date) => `${GLOBAL}:${day(d)}`;
export const submissionUsageKey = (submissionId: string) => `sub:${submissionId}`;

function ctx(deps: AiPipelineDeps) {
  const config = deps.config ?? loadAiGradingConfig();
  const rubric = deps.rubric ?? loadAiRubric();
  const versions = { aiRubricVersion: rubric.version, promptVersion: config.promptVersion };
  return { config, rubric, versions };
}

/** Cache/idempotency key. Includes the user id so identical text from two learners never shares a result. */
export function aiCacheKey(parts: { userId: string; submissionId: string; criterionId: AiCriterionId; aiRubricVersion: string; promptVersion: string; graderVersion: string; modelId: string; inputHash: string }): string {
  return sha256([parts.userId, parts.submissionId, parts.criterionId, parts.aiRubricVersion, parts.promptVersion, parts.graderVersion, parts.modelId, parts.inputHash].join("|"));
}

/** The model id a job is keyed on before any call is made (the configured grading model). */
export function configuredModelId(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SOC_AI_PROVIDER === "mock-e2e") return "mock:content-heuristic";
  return env.SOC_AI_GRADING_MODEL_ID || `groq:${env.GROQ_MODEL || "llama-3.3-70b-versatile"}`;
}

async function prepareFor(deps: AiPipelineDeps, submission: SocReportSubmissionRecord, attempt: SocAttemptRecord): Promise<PreparedSubmission & { template: Pick<ReportTemplate, "sections"> }> {
  const scenario = await deps.resolveScenario(attempt);
  const client = toClientView(scenario); // learner-visible facts only
  const template = await deps.loadTemplate(submission.templateId);
  const handles = await deps.learnerHandles(submission.userId);
  return { ...prepareSubmission(submission.reportData as SocReportData, { title: client.title, briefing: client.briefing }, template, handles), template };
}

function baseGrade(job: Pick<AiGradingJobRecord, "submissionId" | "attemptId" | "userId" | "criterionId">, extra: { inputHash: string; cacheKey: string; modelId: string }, c: ReturnType<typeof ctx>, rubricId: string) {
  return {
    submissionId: job.submissionId,
    attemptId: job.attemptId,
    userId: job.userId,
    criterionId: job.criterionId,
    aiRubricId: rubricId,
    aiRubricVersion: c.rubric.version,
    promptVersion: c.config.promptVersion,
    graderVersion: c.config.graderVersion,
    params: { temperature: c.config.sampling.temperature, samples: c.config.sampling.samples, maxOutputTokens: c.config.sampling.maxOutputTokens },
    source: "ai" as const,
    ...extra,
  };
}

async function saveNotGraded(deps: AiPipelineDeps, job: Pick<AiGradingJobRecord, "submissionId" | "attemptId" | "userId" | "criterionId">, reason: NotGradedReason, extra: { inputHash: string; cacheKey: string; modelId: string }, c: ReturnType<typeof ctx>) {
  return deps.store.saveGrade({
    ...baseGrade(job, extra, c, c.rubric.rubricId),
    status: "not_graded",
    notGradedReason: reason,
    eligibleToCount: false,
    feedback: { summary: "", strengths: [], improvements: [] },
    verifiedSpans: [],
    flags: [],
    inputTokens: 0,
    outputTokens: 0,
  });
}

export interface EnqueueResult {
  mode: EffectiveMode;
  enqueued: number;
  skippedReason?: NotGradedReason;
}

export async function enqueueAiGrading(deps: AiPipelineDeps, submissionId: string): Promise<EnqueueResult> {
  const c = ctx(deps);
  const mode = resolveEffectiveMode(deps.env ?? process.env, deps.gateDir);
  if (mode.mode === "off") return { mode, enqueued: 0, skippedReason: mode.killSwitch ? "kill_switch" : "mode_off" };

  const submission = await deps.getSubmission(submissionId);
  if (!submission || submission.status !== "submitted") throw new Error("Only submitted reports can be AI-graded");
  const attempt = await deps.getAttempt(submission.attemptId);
  if (!attempt || attempt.userId !== submission.userId) throw new Error("Attempt not found for submission");

  const now = deps.now();
  const prepared = await prepareFor(deps, submission, attempt);
  const modelId = configuredModelId(deps.env ?? process.env);
  const existing = await deps.store.listJobsForSubmission(submissionId);
  const fresh = existing.length === 0;

  // Per-user daily quota counts submissions, once.
  if (fresh) {
    const usage = await deps.store.getUsage(userUsageKey(submission.userId, now));
    if (usage.submissionsGraded >= c.config.budgets.perUserDailySubmissions) {
      for (const crit of c.rubric.criteria) {
        const inputHash = computeInputHash(crit, prepared.input, c.versions);
        await saveNotGraded(deps, { submissionId, attemptId: attempt.id, userId: submission.userId, criterionId: crit.id }, "user_quota", { inputHash, cacheKey: "", modelId: "" }, c);
      }
      return { mode, enqueued: 0, skippedReason: "user_quota" };
    }
    await deps.store.addUsage(userUsageKey(submission.userId, now), { submissionsGraded: 1 });
  }

  let enqueued = 0;
  for (const crit of c.rubric.criteria) {
    const inputHash = computeInputHash(crit, prepared.input, c.versions);
    const idempotencyKey = aiCacheKey({ userId: submission.userId, submissionId, criterionId: crit.id, ...c.versions, graderVersion: c.config.graderVersion, modelId, inputHash });
    const { created } = await deps.store.enqueueJob({
      submissionId,
      attemptId: attempt.id,
      userId: submission.userId,
      criterionId: crit.id,
      idempotencyKey,
      status: "pending",
      attempts: 0,
      nextRunAt: now.toISOString(),
    });
    if (created) enqueued++;
  }
  return { mode, enqueued };
}

function makeBudget(deps: AiPipelineDeps, c: ReturnType<typeof ctx>, submissionId: string, start: { submission: number; global: number }): TokenBudget {
  let spent = 0;
  return {
    allow: (estimate) => {
      if (start.global + spent + estimate > c.config.budgets.globalDailyTokenCeiling) return "global_ceiling";
      if (start.submission + spent + estimate > c.config.budgets.perSubmissionTokenCap) return "submission_token_cap";
      return null;
    },
    consume: (i, o) => {
      spent += i + o;
    },
  };
}

/** Deterministic sampling: the same submission+criterion is always in or out of the sample. */
export function inRandomReviewSample(submissionId: string, criterionId: string, rate: number): boolean {
  const n = parseInt(sha256(`review|${submissionId}|${criterionId}`).slice(0, 8), 16) / 0xffffffff;
  return n < rate;
}

function reviewReasons(o: CriterionOutcome, submissionId: string, criterionId: string, rate: number): AiReviewReason[] {
  const reasons: AiReviewReason[] = [];
  if (o.flags.includes("injection_signals") || o.flags.includes("canary_leak")) reasons.push("injection_flagged");
  else if (o.status === "needs_review") reasons.push("needs_review");
  if (o.status === "graded" && o.confidence === "low") reasons.push("low_confidence");
  if (o.status !== "not_graded" && inRandomReviewSample(submissionId, criterionId, rate)) reasons.push("random_sample");
  return reasons;
}

export interface ProcessSummary {
  claimed: number;
  graded: number;
  notGraded: number;
  cacheHits: number;
  retried: number;
  dead: number;
}

export async function processAiGradingJobs(deps: AiPipelineDeps, opts: { limit?: number; submissionId?: string } = {}): Promise<ProcessSummary> {
  const c = ctx(deps);
  const summary: ProcessSummary = { claimed: 0, graded: 0, notGraded: 0, cacheHits: 0, retried: 0, dead: 0 };
  const now = deps.now();
  const jobs = (await deps.store.claimDueJobs(now.toISOString(), opts.limit ?? 24, c.config.jobs.leaseMs)).filter(
    (j) => !opts.submissionId || j.submissionId === opts.submissionId,
  );
  summary.claimed = jobs.length;
  const mode = resolveEffectiveMode(deps.env ?? process.env, deps.gateDir);

  for (const job of jobs) {
    const crit = c.rubric.criteria.find((x) => x.id === job.criterionId);
    try {
      if (!crit) throw new Error("unknown criterion");
      const submission = await deps.getSubmission(job.submissionId);
      const attempt = submission ? await deps.getAttempt(submission.attemptId) : null;
      if (!submission || !attempt || submission.userId !== job.userId) {
        await deps.store.updateJob(job.id, { status: "dead", lastErrorCode: "missing_submission", leaseUntil: undefined });
        summary.dead++;
        continue;
      }
      await runJob(deps, c, mode, job, crit, submission, attempt, summary, now);
    } catch (err) {
      const attempts = job.attempts + 1;
      const code = err instanceof ProviderUnavailableError ? "provider_unavailable" : "internal_error";
      if (attempts >= c.config.jobs.maxAttempts) {
        await deps.store.updateJob(job.id, { status: "dead", attempts, lastErrorCode: code, leaseUntil: undefined });
        if (crit) {
          await saveNotGraded(deps, job, "provider_unavailable", { inputHash: "", cacheKey: job.idempotencyKey, modelId: "" }, c);
        }
        summary.dead++;
      } else {
        const backoff = c.config.jobs.baseBackoffMs * 2 ** (attempts - 1);
        await deps.store.updateJob(job.id, { status: "pending", attempts, lastErrorCode: code, nextRunAt: new Date(now.getTime() + backoff).toISOString(), leaseUntil: undefined });
        summary.retried++;
      }
    }
  }
  return summary;
}

async function runJob(
  deps: AiPipelineDeps,
  c: ReturnType<typeof ctx>,
  mode: EffectiveMode,
  job: AiGradingJobRecord,
  crit: AiRubricCriterion,
  submission: SocReportSubmissionRecord,
  attempt: SocAttemptRecord,
  summary: ProcessSummary,
  now: Date,
): Promise<void> {
  const prepared = await prepareFor(deps, submission, attempt);
  const inputHash = computeInputHash(crit, prepared.input, c.versions);
  const keyExtra = { inputHash, cacheKey: job.idempotencyKey, modelId: "" };

  // Cache: an earlier run of this exact (user, submission, criterion, versions, model, input).
  const cached = await deps.store.findGradeByCacheKey(job.userId, job.idempotencyKey);
  if (cached) {
    await deps.store.updateJob(job.id, { status: "succeeded", leaseUntil: undefined });
    summary.cacheHits++;
    return;
  }

  if (mode.mode === "off") {
    await saveNotGraded(deps, job, mode.killSwitch ? "kill_switch" : "mode_off", keyExtra, c);
    await deps.store.updateJob(job.id, { status: "succeeded", leaseUntil: undefined });
    summary.notGraded++;
    return;
  }

  const [subUsage, globalUsage] = await Promise.all([
    deps.store.getUsage(submissionUsageKey(job.submissionId)),
    deps.store.getUsage(globalUsageKey(now)),
  ]);
  const budget = makeBudget(deps, c, job.submissionId, {
    submission: subUsage.inputTokens + subUsage.outputTokens,
    global: globalUsage.inputTokens + globalUsage.outputTokens,
  });

  const outcome = await gradeCriterion({
    criterion: crit,
    input: prepared.input,
    injection: prepared.injection,
    prefilter: buildPrefilterContext(crit, prepared.template),
    provider: deps.provider,
    config: c.config,
    versions: c.versions,
    budget,
  });

  const tokens = { inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens };
  if (tokens.inputTokens + tokens.outputTokens > 0) {
    await Promise.all([
      deps.store.addUsage(submissionUsageKey(job.submissionId), tokens),
      deps.store.addUsage(globalUsageKey(now), tokens),
      deps.store.addUsage(userUsageKey(job.userId, now), tokens),
    ]);
  }

  const grade: AiCriterionGradeRecord = await deps.store.saveGrade({
    ...baseGrade(job, { inputHash, cacheKey: job.idempotencyKey, modelId: outcome.modelId }, c, c.rubric.rubricId),
    status: outcome.status,
    notGradedReason: outcome.notGradedReason,
    band: outcome.band,
    confidence: outcome.confidence,
    eligibleToCount: outcome.eligibleToCount,
    feedback: outcome.feedback,
    verifiedSpans: outcome.verifiedSpans,
    flags: outcome.flags,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
  });
  await deps.store.saveRawOutputs(
    outcome.rawSamples.map((s) => ({ gradeId: grade.id, userId: job.userId, sampleIndex: s.sampleIndex, attempt: s.attempt, rawText: s.text, promptHash: s.promptHash })),
  );
  for (const reason of reviewReasons(outcome, job.submissionId, job.criterionId, c.config.review.randomSampleRate)) {
    await deps.store.addReviewItem({ gradeId: grade.id, submissionId: job.submissionId, userId: job.userId, criterionId: job.criterionId, reason });
  }
  await deps.store.updateJob(job.id, { status: "succeeded", leaseUntil: undefined });
  if (outcome.status === "not_graded") summary.notGraded++;
  else summary.graded++;
}
