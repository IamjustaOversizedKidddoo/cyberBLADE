import "server-only";
/**
 * Right-of-access export (S6). Every table is mapped through an explicit allowlist: the learner
 * gets what they did and their scores, never seeds, scenario hashes, ground truth (correct
 * dispositions, missed items, model reports, debriefs built from the answer key), raw AI outputs
 * or prompts. Adding a field here is a deliberate privacy decision.
 */
import type { Ctx } from "@/lib/progress/service";
import type { AiGradingExport } from "@/lib/lab-engine/soc/ai-grading/store/types";

export async function buildLearnerExport(ctx: Ctx, userId: string, aiFeedback: AiGradingExport) {
  const [lessons, labAttempts, xpEvents, socAttempts, reviewItems, examReports] = await Promise.all([
    ctx.repo.listLessonProgress(userId),
    ctx.repo.listAttempts(userId),
    ctx.repo.listXpEvents(userId),
    ctx.repo.listSocAttempts(userId),
    ctx.repo.listReviewItems(userId),
    ctx.repo.listExamReports(userId),
  ]);

  const soc = await Promise.all(
    socAttempts.map(async (a) => {
      const [decisions, cases, queries, questions, lookups, reports] = await Promise.all([
        ctx.repo.listSocDecisions(a.id),
        ctx.repo.listSocCases(a.id),
        ctx.repo.listSocQueryLogs(a.id),
        ctx.repo.listSocQuestionAttempts(a.id),
        ctx.repo.listSocEnrichmentLookups(a.id),
        ctx.repo.listSocReportSubmissions(a.id),
      ]);
      const evaluations = await Promise.all(reports.map((r) => ctx.repo.getSocReportEvaluation(r.id)));
      const s = a.scoreSummary;
      return {
        attemptId: a.id,
        scenarioId: a.scenarioId,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        difficulty: a.difficulty ?? null,
        score: s ? { totalScore: s.totalScore, maxScore: s.maxScore, percentage: s.percentage, passed: s.passed, alertsDecided: s.alertsDecided, alertsTotal: s.alertsTotal } : null,
        decisions: decisions.map((d) => ({ alertId: d.alertId, disposition: d.disposition, severity: d.severity, escalate: d.escalate, targetTier: d.targetTier ?? null, rationale: d.rationale, evidenceRefs: d.evidenceRefs ?? [], createdAt: d.createdAt })),
        cases: cases.map((c) => ({ title: c.title, status: c.status, notes: c.notes ?? "", alertIds: c.alertIds ?? [], createdAt: c.createdAt })),
        queries: queries.map((q) => ({ query: q.queryText, resultRowCount: q.resultRowCount, createdAt: q.createdAt })),
        questionAnswers: questions.map((q) => ({ questionId: q.questionId, answer: q.submittedAnswer, correct: q.isCorrect, createdAt: q.createdAt })),
        enrichmentLookups: lookups.map((l) => ({ tool: l.tool, entityType: l.entityType, entityValue: l.entityValue, createdAt: l.createdAt })),
        reports: reports.map((r, i) => {
          const ev = evaluations[i];
          return {
            templateId: r.templateId,
            status: r.status,
            report: r.reportData,
            updatedAt: r.updatedAt,
            evaluation: ev
              ? {
                  totalScore: ev.totalScore,
                  maxScore: ev.maxScore,
                  versionLabel: ev.versionLabel,
                  // Per-criterion scores only: missed items and annotations are derived from the answer key.
                  criteria: Object.fromEntries(Object.entries(ev.criterionResults).map(([k, v]) => [k, { score: v.score, maxScore: v.maxScore, status: v.status }])),
                }
              : null,
          };
        }),
      };
    }),
  );

  // SOC exam mode (Stage 1): no seed; results are the learner's own scores and diagnostics.
  const [examAttempts, examOutcomes, accommodation] = await Promise.all([
    ctx.repo.listSocExamAttempts(userId),
    ctx.repo.listSocExamOutcomeReports(userId),
    ctx.repo.getSocExamAccommodation(userId),
  ]);
  const socExams = await Promise.all(
    examAttempts.map(async (e) => ({
      examId: e.id,
      format: e.format,
      variantId: e.variantId,
      status: e.status,
      submitReason: e.submitReason,
      startedAt: e.startedAt,
      deadlineAt: e.deadlineAt,
      submittedAt: e.submittedAt,
      timeMultiplier: e.timeMultiplier,
      result: e.result
        ? { scorePercent: e.result.scorePercent, components: e.result.components, perSkill: e.result.perSkill, timeAnalysis: e.result.timeAnalysis, integrityFlags: e.result.integrityFlags }
        : null,
      answers: (await ctx.repo.listSocExamAnswers(e.id)).map((a) => ({ itemId: a.itemId, answer: a.answer, answeredAt: a.answeredAt })),
    })),
  );

  return {
    lessons,
    labAttempts: labAttempts.map((l) => ({ labId: l.labId, mode: l.mode, objectivesSolved: l.objectivesSolved, hintsUsed: l.hintsUsed, startedAt: l.startedAt, completedAt: l.completedAt, failedAt: l.failedAt })),
    xpEvents,
    reviewItems,
    examReports,
    soc,
    socExams,
    socExamOutcomeReports: examOutcomes.map((o) => ({ certFamily: o.certFamily, examDate: o.examDate, passed: o.passed, createdAt: o.createdAt })),
    socExamAccommodation: accommodation ? { multiplier: accommodation.multiplier, setAt: accommodation.setAt } : null,
    aiFeedback,
  };
}
