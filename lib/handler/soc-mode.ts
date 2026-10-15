import "server-only";
/**
 * Handler SOC mode (Stage 1). Reuses the P4 pipeline (abuse checks, quota, provider routing,
 * metering, output sanitiser) through askHandler, with three additions:
 *   1. a server-side context provider that reads only the learner's own work and the alert fields
 *      the learner can already see (never ground truth, debriefs or answer keys);
 *   2. an input guard that answers verdict/answer/report/IOC requests with a Socratic redirect
 *      without calling a model, and an output guard that replaces any reply asserting a verdict;
 *   3. a server-side exam lockout: any active exam, or an exam attempt, gets no assistance.
 */
import type { Ctx } from "@/lib/progress/service";
import { getSocHandlerContext } from "@/lib/lab-engine/soc/engine";
import { isExamSocAttempt } from "@/lib/lab-engine/soc/exam/guard";
import { getActiveExam } from "@/lib/lab-engine/soc/exam/service";
import { askHandler } from "./service";
import { detectCommand } from "./prompts";
import { classifySocRequest, socOutputLeaks, socRedirect } from "./soc-guard";
import type { HandlerProvider } from "./providers/types";
import type { HandlerMessage, HandlerResponse, SocPromptContext } from "./types";

export const SOC_EXAM_LOCKOUT_MESSAGE =
  "The Handler is offline while you have a practice exam in progress, so your result reflects your own work. It's available again after you submit.";

/** Builds the SOC prompt context from the learner's own records only. */
export async function buildSocPromptContext(ctx: Ctx, userId: string, attemptId: string, alertId?: string): Promise<SocPromptContext> {
  const base = await getSocHandlerContext(ctx, userId, attemptId, alertId);
  const [decisions, queries, lookups, reports] = await Promise.all([
    ctx.repo.listSocDecisions(attemptId),
    ctx.repo.listSocQueryLogs(attemptId),
    ctx.repo.listSocEnrichmentLookups(attemptId),
    ctx.repo.listSocReportSubmissions(attemptId),
  ]);
  const mine = alertId ? [...decisions].reverse().find((d) => d.alertId === alertId) : undefined;
  const report = reports.find((r) => r.userId === userId);
  return {
    scenarioTitle: base.scenarioTitle,
    totalAlerts: base.totalAlerts,
    decidedAlertsCount: base.decidedAlertsCount,
    currentAlert: base.currentAlert,
    myDecision: mine ? { disposition: mine.disposition, severity: mine.severity, escalate: mine.escalate, rationale: mine.rationale } : undefined,
    recentQueries: queries.filter((q) => q.userId === userId).slice(-5).map((q) => q.queryText),
    recentLookups: lookups.filter((l) => l.userId === userId).slice(-5).map((l) => `${l.tool} ${l.entityType} ${l.entityValue}`),
    reportExcerpt: report ? JSON.stringify(report.reportData).slice(0, 800) : undefined,
  };
}

// Practice hint tier per (learner, attempt), counted on the server: each hint request raises it,
// up to tier 3. shortcut: in-process; a restart resets to tier 1 (stricter, never looser).
const hintRequests = new Map<string, number>();

export type AskSocHandlerInput = {
  attemptId: string;
  alertId?: string;
  message: string;
  history?: HandlerMessage[];
  provider?: HandlerProvider;
};

export async function askSocHandler(ctx: Ctx, userId: string, input: AskSocHandlerInput): Promise<HandlerResponse> {
  const attempt = await ctx.repo.getSocAttempt(input.attemptId);
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");

  // Exam lockout before anything else: no context is read and no model is called.
  if (isExamSocAttempt(attempt) || (await getActiveExam(ctx, userId))) {
    return { reply: SOC_EXAM_LOCKOUT_MESSAGE, blocked: true, providerUsed: "heuristic", commandRecognized: detectCommand(input.message) };
  }

  const category = classifySocRequest(input.message);
  if (category) {
    return { reply: socRedirect(category, input.message), blocked: false, providerUsed: "heuristic", commandRecognized: detectCommand(input.message) };
  }

  const key = `${userId}:${attempt.id}`;
  if (detectCommand(input.message) === "hint") hintRequests.set(key, Math.min((hintRequests.get(key) ?? 0) + 1, 3));
  const tier = Math.max(1, hintRequests.get(key) ?? 1);

  const soc = await buildSocPromptContext(ctx, userId, attempt.id, input.alertId);
  // Client-supplied history is untrusted: only user/assistant turns, clipped.
  const history = (input.history ?? []).filter((m) => m.role !== "system").slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const res = await askHandler({ context: { kind: "soc", soc, activeTier: tier }, history, message: input.message, provider: input.provider, userId, tier });
  if (socOutputLeaks(res.reply)) {
    return { ...res, reply: socRedirect("verdict_confirmation", input.message), blocked: true };
  }
  return res;
}
