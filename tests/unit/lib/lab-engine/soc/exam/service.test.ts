import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 60_000 });

import { makeCtx } from "../ai-grading/pipeline-harness";
import { abandonSocAttempt, getSocSession, recordSocDecision, startSocSession, submitSocAttempt } from "@/lib/lab-engine/soc/engine";
import { getQueryWorkspace, submitInvestigationAnswer } from "@/lib/lab-engine/soc/query/question-service";
import { executeInvestigationQuery } from "@/lib/lab-engine/soc/query/pipeline";
import { executeEnrichmentLookup } from "@/lib/lab-engine/soc/enrichment/pipeline";
import { getSocReportModelReveal, saveSocReportDraft, submitSocReport } from "@/lib/lab-engine/soc/report-engine";
import { getExamState, saveHandoffNote, saveKnowledgeAnswer, startExam, submitExam } from "@/lib/lab-engine/soc/exam/service";
import { knowledgeItemReview, loadKnowledgeBank } from "@/lib/lab-engine/soc/exam/knowledge";
import { sampleReport } from "../ai-grading/helpers";
import type { Ctx } from "@/lib/progress/service";

const U = "u-exam";
const T0 = new Date("2026-10-15T09:00:00Z");
const later = (clock: { t: Date }, minutes: number) => (clock.t = new Date(clock.t.getTime() + minutes * 60_000));
const decision = { disposition: "true_positive" as const, severity: "HIGH" as const, escalate: true, rationale: "Evidence in the raw fields supports this decision." };

async function examSession(ctx: Ctx, userId: string, socAttemptId: string) {
  return getSocSession(ctx, userId, socAttemptId);
}

describe("exam timer is server-authoritative", () => {
  it("stores the deadline at start; refresh does not move it; work after it is refused and the exam auto-submits", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "mini-queue");
    expect(s.remainingSeconds).toBe(600);
    later(clock, 3);
    const again = await getExamState(ctx, U, s.examId);
    expect(again.deadlineAt).toBe(s.deadlineAt);
    expect(again.remainingSeconds).toBe(420);

    const session = await examSession(ctx, U, s.socAttemptId!);
    const alertId = session.scenario.alerts[0].id;
    await recordSocDecision(ctx, U, s.socAttemptId!, alertId, decision);
    later(clock, 8); // past the 10-minute deadline
    await expect(recordSocDecision(ctx, U, s.socAttemptId!, session.scenario.alerts[1].id, decision)).rejects.toThrow("Exam time is over");

    const after = await getExamState(ctx, U, s.examId);
    expect(after.status).toBe("submitted");
    expect(after.result?.submitReason).toBe("deadline");
    expect(after.result?.integrityFlags.map((f) => f.code)).toContain("auto_submitted");
  });

  it("a learner submit that arrives after the deadline counts as a deadline submission", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "knowledge");
    later(clock, 41);
    const done = await submitExam(ctx, U, s.examId);
    expect(done.result?.submitReason).toBe("deadline");
    expect(done.result?.timeAnalysis.withinBudget).toBe(false);
  });

  it("applies an accommodation multiplier from the server record only", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    await ctx.repo.setSocExamAccommodation({ userId: U, multiplier: 1.5, reason: "test", setBy: "cli", setAt: T0.toISOString() });
    const s = await startExam(ctx, U, "knowledge");
    expect(s.remainingSeconds).toBe(60 * 60);
    expect(s.timeMultiplier).toBe(1.5);
  });
});

describe("no correctness feedback before submission", () => {
  it("records question answers without marking them and hides debriefs, results and model reports", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "investigation");
    const id = s.socAttemptId!;

    const ws = await getQueryWorkspace(ctx, U, id);
    expect(ws.questions.every((q) => q.status === "unanswered" && q.debrief === null && q.referenceQuery === null)).toBe(true);
    const q = ws.questions[0];
    const res = await submitInvestigationAnswer(ctx, U, { attemptId: id, questionId: q.id, answer: q.options?.[0] ?? "x" });
    expect(res).toEqual({ questionId: q.id, isCorrect: false, attemptsLeft: 0, status: "recorded", pointsAwarded: 0, debrief: null, referenceQuery: null });
    expect((await getQueryWorkspace(ctx, U, id)).questions.find((x) => x.id === q.id)?.status).toBe("recorded");

    await expect(submitSocAttempt(ctx, U, id)).rejects.toThrow("Submit the exam");
    await expect(submitSocReport(ctx, U, id, sampleReport())).rejects.toThrow("submitted with the exam");
    await expect(getSocReportModelReveal(ctx, U, id)).rejects.toThrow("after the exam is submitted");
    expect((await examSession(ctx, U, id)).results).toBeNull();
    expect(s.result).toBeNull();
  });

  it("reveals debriefs, the graded report and knowledge explanations after submission (own exam only)", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "investigation");
    await saveSocReportDraft(ctx, U, s.socAttemptId!, sampleReport());
    later(clock, 10);
    const done = await submitExam(ctx, U, s.examId);
    expect(done.result?.report?.criteria.length).toBeGreaterThan(0);
    expect(done.result?.components.map((c) => c.id).sort()).toEqual(["decisions", "questions", "report"]);
    expect((await examSession(ctx, U, s.socAttemptId!)).results?.alertResults.length).toBeGreaterThan(0);
    await expect(getSocReportModelReveal(ctx, U, s.socAttemptId!)).resolves.toBeDefined();
    await expect(getExamState(ctx, "someone-else", s.examId)).rejects.toThrow("not found");
  });

  it("knowledge exam: answers save silently; grading uses the server key; review appears only after submit", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "knowledge");
    expect(s.knowledgeItems).toHaveLength(25);
    expect(JSON.stringify(s)).not.toMatch(/explanation|correctOptionIds|"answer"/);
    expect(s.knowledgeReview).toBeNull();
    const seed = (await ctx.repo.getSocExamAttempt(s.examId))!.seed;
    expect(JSON.stringify(s)).not.toContain(seed);
    const bank = loadKnowledgeBank();
    const correct = s.knowledgeItems!.slice(0, 20);
    for (const v of correct) {
      const item = bank.items.find((i) => i.id === v.id)!;
      expect(await saveKnowledgeAnswer(ctx, U, s.examId, v.id, knowledgeItemReview(item, seed).correctOptionIds)).toEqual({ saved: true });
    }
    await saveKnowledgeAnswer(ctx, U, s.examId, s.knowledgeItems![20].id, ["oforged"]);
    later(clock, 15);
    const done = await submitExam(ctx, U, s.examId);
    expect(done.result?.knowledge).toMatchObject({ correct: 20, total: 25 });
    expect(done.result?.scorePercent).toBe(80);
    expect(Object.keys(done.knowledgeReview!)).toHaveLength(25);
  });
});

describe("budgets are counted on the server", () => {
  it("refuses searches past the format budget, and question answers in a format without them", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "mini-queue");
    const id = s.socAttemptId!;
    for (let i = 0; i < 10; i++) await executeInvestigationQuery(ctx, U, { attemptId: id, query: `source="auth" | head ${i + 1}` });
    await expect(executeInvestigationQuery(ctx, U, { attemptId: id, query: 'source="auth"' })).rejects.toThrow("Exam budget used up: 10 searches");
    const ws = await getQueryWorkspace(ctx, U, id);
    if (ws.questions[0]) await expect(submitInvestigationAnswer(ctx, U, { attemptId: id, questionId: ws.questions[0].id, answer: "x" })).rejects.toThrow("Exam budget used up");
    expect((await getExamState(ctx, U, s.examId)).budgets.queries).toEqual({ used: 10, limit: 10 });
  });

  it("parallel lookups cannot overrun the budget", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "mini-queue");
    const id = s.socAttemptId!;
    const results = await Promise.allSettled(
      Array.from({ length: 16 }, (_, i) => executeEnrichmentLookup(ctx, U, { attemptId: id, tool: "reputation", entityType: "ip", entityValue: `198.51.100.${i + 1}` }, { enforceTimingClamp: false })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(await ctx.repo.listSocEnrichmentLookups(id)).toHaveLength(10);
  });
});

describe("attempts, seeds and idempotency", () => {
  it("one exam at a time; exam SOC attempts cannot be started, reset or abandoned through practice paths", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "mini-queue");
    await expect(startExam(ctx, U, "knowledge")).rejects.toThrow("exam is active");
    await expect(startSocSession(ctx, U, `exam-${s.examId}`)).rejects.toThrow("exam lobby");
    await expect(abandonSocAttempt(ctx, U, s.socAttemptId!)).rejects.toThrow("cannot be abandoned");
  });

  it("seeds never repeat per (learner, format) and variants rotate least-used first", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const s = await startExam(ctx, U, "mini-queue");
      seen.push(s.variantId);
      await submitExam(ctx, U, s.examId);
      later(clock, 1);
    }
    const exams = await ctx.repo.listSocExamAttempts(U);
    expect(new Set(exams.map((e) => e.seed)).size).toBe(4);
    expect(seen.slice(0, 2).sort()).toEqual(["shift-quiet-day", "shift-standard-mixed"]);
    expect(seen.slice(2, 4).sort()).toEqual(["shift-quiet-day", "shift-standard-mixed"]);
  });

  it("knowledge draws unseen items first", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const first = await startExam(ctx, U, "knowledge");
    await submitExam(ctx, U, first.examId);
    later(clock, 61);
    const second = await startExam(ctx, U, "knowledge");
    const bankSize = loadKnowledgeBank().items.length;
    const firstIds = new Set(first.knowledgeItems!.map((i) => i.id));
    const fresh = second.knowledgeItems!.filter((i) => !firstIds.has(i.id)).length;
    expect(fresh).toBe(Math.min(25, bankSize - 25));
  });

  it("concurrent submits finalise once and award XP once; replays return the same result and change nothing", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "knowledge");
    const seed = (await ctx.repo.getSocExamAttempt(s.examId))!.seed;
    const bank = loadKnowledgeBank();
    for (const v of s.knowledgeItems!) await saveKnowledgeAnswer(ctx, U, s.examId, v.id, knowledgeItemReview(bank.items.find((i) => i.id === v.id)!, seed).correctOptionIds);
    const results = await Promise.all([submitExam(ctx, U, s.examId), submitExam(ctx, U, s.examId), submitExam(ctx, U, s.examId)]);
    expect(new Set(results.map((r) => JSON.stringify(r.result))).size).toBe(1);
    const xp = (await ctx.repo.listXpEvents(U)).filter((e) => e.source === `soc_exam:${s.examId}`);
    expect(xp).toHaveLength(1);
    later(clock, 1);
    const replay = await submitExam(ctx, U, s.examId);
    expect(replay.result).toEqual(results[0].result);
    await expect(saveKnowledgeAnswer(ctx, U, s.examId, s.knowledgeItems![0].id, [])).rejects.toThrow("Exam time is over");
  });
});

describe("adversarial inputs", () => {
  it("another learner cannot read, answer or submit someone else's exam, or drive its workspace", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "alert-queue");
    const k = await startExam(ctx, "victim-2", "knowledge");
    for (const call of [
      () => getExamState(ctx, "intruder", s.examId),
      () => submitExam(ctx, "intruder", s.examId),
      () => saveHandoffNote(ctx, "intruder", s.examId, "x"),
      () => saveKnowledgeAnswer(ctx, U, k.examId, k.knowledgeItems![0].id, []),
      () => recordSocDecision(ctx, "intruder", s.socAttemptId!, "a1", decision),
      () => getQueryWorkspace(ctx, "intruder", s.socAttemptId!),
    ]) {
      await expect(call()).rejects.toThrow();
    }
    await expect(getExamState(ctx, U, "00000000-0000-4000-8000-000000000000")).rejects.toThrow("not found");
  });

  it("rejects items outside the exam and handoff notes in formats without one", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "knowledge");
    const notDrawn = loadKnowledgeBank().items.find((i) => !s.knowledgeItems!.some((v) => v.id === i.id));
    if (notDrawn) await expect(saveKnowledgeAnswer(ctx, U, s.examId, notDrawn.id, [])).rejects.toThrow("Unknown exam item");
    await expect(saveHandoffNote(ctx, U, s.examId, "note")).rejects.toThrow("no handoff note");
  });

  it("alert-queue handoff note is saved and scored by the completeness check", async () => {
    const clock = { t: T0 };
    const ctx = makeCtx(clock);
    const s = await startExam(ctx, U, "alert-queue");
    const alertId = (await examSession(ctx, U, s.socAttemptId!)).scenario.alerts[0].id;
    await saveHandoffNote(ctx, U, s.examId, `Escalated ${alertId} as HIGH to tier 2 after confirming the sign-in came from an unknown host. Next: monitor the account for further sign-ins and follow up with IR on containment status.`);
    const done = await submitExam(ctx, U, s.examId);
    expect(done.handoffNote).toContain(alertId);
    expect(done.result?.components.find((c) => c.id === "handoff")?.percent).toBe(100);
  });
});
