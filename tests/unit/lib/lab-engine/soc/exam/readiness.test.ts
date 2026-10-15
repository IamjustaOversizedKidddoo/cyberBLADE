import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { evaluateReadiness, READINESS_STATEMENT } from "@/lib/lab-engine/soc/exam/readiness";
import { calibrationTable } from "@/lib/lab-engine/soc/exam/calibration";
import { loadReadinessConfig } from "@/lib/lab-engine/soc/exam/config";
import { buildStudyPlan } from "@/lib/lab-engine/soc/exam/study-plan";
import type { SocExamAttemptRecord, SocExamResult, SocExamOutcomeReport } from "@/lib/lab-engine/soc/exam/types";

const cfg = loadReadinessConfig();
const counts = (f: string) => f !== "mini-queue";
let n = 0;

type Spec = { format?: SocExamAttemptRecord["format"]; variant?: string; score: number; skill?: number; report?: number | null; late?: boolean; flags?: boolean; day?: number; userId?: string };
function ex(s: Spec): SocExamAttemptRecord {
  n += 1;
  const format = s.format ?? "alert-queue";
  const result: SocExamResult = {
    format, variantId: s.variant ?? `v${n}`, scorePercent: s.score, components: [],
    perSkill: [{ skill: "soc_alert_triage", earned: 1, possible: 1, percent: s.score }, { skill: "soc_siem_correlation", earned: 1, possible: 1, percent: s.skill ?? s.score }],
    decisionQuality: null,
    timeAnalysis: { durationSeconds: 60, budgetSeconds: 600, withinBudget: !s.late, medianSecondsPerAlert: null, longestIdleGapSeconds: 0, timeToFirstContainmentSeconds: null },
    thoroughness: null,
    report: s.report === undefined || s.report === null ? null : { totalPercent: s.report, criteria: [] },
    knowledge: null,
    integrityFlags: s.flags ? [{ code: "rapid_decisions", detail: "x" }] : [],
    budgetsUsed: {}, submitReason: s.late ? "deadline" : "learner",
  };
  const day = String(s.day ?? (n % 28) + 1).padStart(2, "0");
  return { id: `e${n}`, userId: s.userId ?? "u", format, configVersion: 1, variantId: result.variantId, socAttemptId: null, seed: "s", itemIds: [], status: "submitted", submitReason: result.submitReason, startedAt: `2026-09-${day}T10:00:00Z`, deadlineAt: `2026-09-${day}T11:00:00Z`, timeMultiplier: 1, submittedAt: `2026-09-${day}T10:30:00Z`, result };
}

const strong = () => [ex({ score: 85 }), ex({ format: "investigation", score: 80, report: 80 }), ex({ format: "knowledge", score: 90 }), ex({ score: 82 })];

describe("provisional readiness gate", () => {
  const table: Array<{ name: string; exams: () => SocExamAttemptRecord[]; state: string; unmet: string[] }> = [
    { name: "no attempts", exams: () => [], state: "not_ready", unmet: ["attempts", "formats", "variants", "overall", "skill_floor", "report", "time", "integrity"] },
    { name: "strong, varied recent practice", exams: strong, state: "ready", unmet: [] },
    { name: "one lucky perfect attempt is not enough", exams: () => [ex({ format: "investigation", score: 100, report: 100 })], state: "not_ready", unmet: ["attempts", "formats", "variants"] },
    { name: "flaky pass: one great run among weak ones", exams: () => [ex({ score: 98 }), ex({ format: "investigation", score: 40, report: 45 }), ex({ format: "knowledge", score: 45 }), ex({ score: 42 })], state: "not_ready", unmet: ["overall", "skill_floor", "report"] },
    { name: "single format only", exams: () => [ex({ score: 90 }), ex({ score: 90 }), ex({ score: 90 }), ex({ score: 90, report: 90 })], state: "not_ready", unmet: ["formats"] },
    { name: "same scenario repeated", exams: () => [ex({ score: 90, variant: "x" }), ex({ score: 90, format: "knowledge" }), ex({ score: 90, variant: "x" }), ex({ score: 90, variant: "x", report: 90 })], state: "not_ready", unmet: ["variants"] },
    { name: "one weak skill below the floor gives close", exams: () => [ex({ score: 85, skill: 50 }), ex({ format: "investigation", score: 80, skill: 50, report: 80 }), ex({ format: "knowledge", score: 90, skill: 50 }), ex({ score: 82, skill: 50 })], state: "close", unmet: ["skill_floor"] },
    { name: "a skill below the close floor too gives not ready", exams: () => [ex({ score: 85, skill: 40 }), ex({ format: "investigation", score: 80, skill: 40, report: 80 }), ex({ format: "knowledge", score: 90, skill: 40 }), ex({ score: 82, skill: 40 })], state: "not_ready", unmet: ["skill_floor"] },
    { name: "exact thresholds count as met (75 / 60 / 65)", exams: () => [ex({ score: 75, skill: 60 }), ex({ format: "investigation", score: 75, skill: 60, report: 65 }), ex({ format: "knowledge", score: 75, skill: 60 }), ex({ score: 75, skill: 60 })], state: "ready", unmet: [] },
    { name: "one point under the overall threshold", exams: () => [ex({ score: 74 }), ex({ format: "investigation", score: 74, report: 80 }), ex({ format: "knowledge", score: 74 }), ex({ score: 74 })], state: "close", unmet: ["overall"] },
    { name: "no report in the window", exams: () => [ex({ score: 90 }), ex({ format: "knowledge", score: 90 }), ex({ score: 90 }), ex({ format: "knowledge", score: 90 })], state: "not_ready", unmet: ["report"] },
    { name: "ran out of time once", exams: () => strong().map((e, i) => (i === 1 ? ex({ format: "investigation", score: 80, report: 80, late: true }) : e)), state: "not_ready", unmet: ["time"] },
    { name: "integrity flag", exams: () => [...strong().slice(0, 3), ex({ score: 85, flags: true })], state: "not_ready", unmet: ["integrity"] },
    { name: "mini-queue drills never count", exams: () => [ex({ format: "mini-queue", score: 100 }), ex({ format: "mini-queue", score: 100 }), ex({ format: "mini-queue", score: 100 }), ex({ format: "mini-queue", score: 100 })], state: "not_ready", unmet: ["attempts", "formats", "variants", "overall", "skill_floor", "report", "time", "integrity"] },
    { name: "only the most recent window counts (old weak attempts drop out)", exams: () => [ex({ score: 10, day: 1 }), ex({ score: 10, day: 2 }), ...strong().map((e, i) => ({ ...e, submittedAt: `2026-09-2${i}T10:30:00Z` }))], state: "ready", unmet: [] },
  ];

  for (const row of table) {
    it(row.name, () => {
      const r = evaluateReadiness(row.exams(), counts, cfg);
      expect(r.provisional).toBe(true);
      expect(r.state).toBe(row.state);
      if (row.state !== "close" || row.unmet.length) expect(r.unmet.map((c) => c.id)).toEqual(row.unmet);
      expect(r.statement).toBe(row.state === "ready" ? READINESS_STATEMENT : null);
    });
  }

  it("uses the exact wording rule", () => {
    expect(READINESS_STATEMENT).toBe("Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam.");
  });
});

describe("offline calibration", () => {
  it("compares the gate state before each self-reported exam date and skips untrusted rows", () => {
    const exams = strong().map((e) => ({ ...e, submittedAt: "2026-09-20T10:30:00Z" }));
    const o = (examDate: string, passed: boolean, userId = "u"): SocExamOutcomeReport => ({ id: examDate, userId, certFamily: "other", examDate, passed, consentVersion: "v", createdAt: "x" });
    const t = calibrationTable(exams, [o("2026-10-01", true), o("2026-09-02", false), o("2027-01-01", true), o("not-a-date", true), o("2026-10-01", false, "other-user")], cfg, counts, new Date("2026-10-15T00:00:00Z"));
    expect(t).toEqual({ rows: 3, skipped: 2, byState: { ready: { passed: 1, failed: 0 }, close: { passed: 0, failed: 0 }, not_ready: { passed: 0, failed: 2 } } });
  });
});

describe("study plan", () => {
  const lessonTitle = (id: string) => `Lesson ${id}`;
  it("links weak skills to lessons, due reviews and practice; hides query drills when search is off", () => {
    const exams = [ex({ score: 90, skill: 30 })];
    const on = buildStudyPlan({ exams, threshold: 60, lessonTitle, dueReviewByLesson: new Map(), drillsEnabled: true });
    const off = buildStudyPlan({ exams, threshold: 60, lessonTitle, dueReviewByLesson: new Map(), drillsEnabled: false });
    expect(on.entries.map((e) => e.skill)).toEqual(["soc_siem_correlation"]);
    expect(on.entries[0].lessons.length).toBeGreaterThan(0);
    expect(on.entries[0].practice.some((p) => p.kind === "drill")).toBe(true);
    expect(off.entries[0].practice.some((p) => p.kind === "drill")).toBe(false);
    expect(off.entries[0].practice.length).toBeGreaterThan(0);
    const due = new Map([[on.entries[0].lessons[0].id, 2]]);
    expect(buildStudyPlan({ exams, threshold: 60, lessonTitle, dueReviewByLesson: due, drillsEnabled: false }).entries[0].reviewDue).toBe(2);
  });
});

describe("accommodation (admin CLI core)", () => {
  it("validates input, defaults nothing, and produces an audit line", async () => {
    const { buildAccommodation } = await import("@/lib/lab-engine/soc/exam/accommodation");
    const now = new Date("2026-10-15T10:00:00Z");
    const ok = buildAccommodation({ userId: "u1", multiplier: 1.5, reason: "documented need", setBy: "owner" }, now);
    expect(ok.record).toEqual({ userId: "u1", multiplier: 1.5, reason: "documented need", setBy: "owner", setAt: now.toISOString() });
    expect(JSON.parse(ok.audit)).toMatchObject({ action: "accommodation_set", userId: "u1", multiplier: 1.5, setBy: "owner" });
    expect(JSON.parse(buildAccommodation({ userId: "u1", multiplier: 1, reason: "no longer needed", setBy: "owner" }, now).audit).action).toBe("accommodation_off");
    for (const bad of [{ userId: "u1", multiplier: 4, reason: "xxxxx", setBy: "ow" }, { userId: "u1", multiplier: 0.5, reason: "xxxxx", setBy: "ow" }, { userId: "u1", multiplier: 1.5, reason: "", setBy: "ow" }, { userId: "", multiplier: 1.5, reason: "xxxxx", setBy: "ow" }, { userId: "u1", multiplier: Number.NaN, reason: "xxxxx", setBy: "ow" }]) {
      expect(() => buildAccommodation(bad, now)).toThrow();
    }
  });
});
