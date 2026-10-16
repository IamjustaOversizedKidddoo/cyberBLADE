/** Closed beta: invite codes, uniform failures, atomic limited use, local sign-up gate, feedback. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "198.51.100.77"]]),
  cookies: async () => ({ get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined), set: (n: string, v: string) => cookieJar.set(n, v), delete: (n: string | { name: string }) => cookieJar.delete(typeof n === "string" ? n : n.name) }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
const operator = { id: "u-beta-1", rank: 1, handle: "op_beta" };
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => operator, setOperatorCookie: async () => undefined }));

import { MemoryBetaStore } from "@/lib/beta/store";
import { setBetaStore } from "@/lib/beta";
import { generateInviteCode, hashInviteCode, INVITE_ERROR, normalizeInviteCode } from "@/lib/beta/codes";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";
import { groupFeedback } from "@/lib/beta/feedback-export";

let store: MemoryBetaStore;
const NOW = () => new Date().toISOString();
const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
async function invite(maxUses = 1, expiresAt = later(7)) {
  const code = generateInviteCode();
  const inv = await store.createInvite({ codeHash: hashInviteCode(normalizeInviteCode(code)!), label: "t", maxUses, expiresAt, createdBy: "test" });
  return { code, inv };
}

beforeEach(() => {
  store = new MemoryBetaStore();
  setBetaStore(store);
  resetSubmissionRateLimits();
  cookieJar.clear();
});
afterEach(() => {
  setBetaStore(null);
  delete process.env.BETA_INVITE_ONLY;
});

describe("invite codes", () => {
  it("are 16 unambiguous characters, normalised before hashing, never stored in clear", async () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJKMNP-TV-Z2-9]{4}(-[A-HJKMNP-TV-Z2-9]{4}){3}$/);
    expect(normalizeInviteCode(code.toLowerCase().replace(/-/g, " "))).toBe(code.replace(/-/g, ""));
    expect(normalizeInviteCode("TOO-SHORT")).toBeNull();
    expect(normalizeInviteCode("OOOO-IIII-LLLL-1111")).toBeNull();
    const { inv } = await invite();
    expect(JSON.stringify(await store.listInvites())).not.toContain(code);
    expect(inv.codeHash).toHaveLength(64);
  });
});

describe("redemption rules (local store parity with beta_redeem_invite)", () => {
  it("limited use is atomic and idempotent per learner", async () => {
    const { code } = await invite(2);
    const h = hashInviteCode(normalizeInviteCode(code)!);
    const results = await Promise.all(["a", "b", "c"].map((u) => store.redeemInvite(h, u, NOW())));
    expect(results.filter(Boolean)).toHaveLength(2);
    const admitted = ["a", "b", "c"][results.indexOf(true)];
    expect(await store.redeemInvite(h, admitted, NOW())).toBe(true);
    expect((await store.listInvites())[0].uses).toBe(2);
  });

  it("expired, revoked and unknown codes all fail alike", async () => {
    const expired = await invite(5, new Date(Date.now() - 1000).toISOString());
    const revoked = await invite(5);
    await store.revokeInvite(revoked.inv.id, NOW());
    for (const c of [expired.code, revoked.code, generateInviteCode()]) expect(await store.redeemInvite(hashInviteCode(normalizeInviteCode(c)!), "z", NOW())).toBe(false);
  });
});

describe("local sign-up with BETA_INVITE_ONLY", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ handle: `op_${Math.random().toString(36).slice(2, 8)}`, agree: "on", next: "/dashboard", ...fields })) f.set(k, v);
    return f;
  };

  it("refuses a missing or wrong code with one message and creates nothing; a valid code admits exactly one learner", async () => {
    process.env.BETA_INVITE_ONLY = "true";
    const { startOperator } = await import("@/app/start/actions");
    const blank = { errors: {}, handle: "" };
    for (const bad of ["", "NOPE", generateInviteCode()]) {
      const r = await startOperator(blank, form({ invite: bad }));
      expect(r.errors.invite).toBe(INVITE_ERROR);
    }
    const { code } = await invite(1);
    await expect(startOperator(blank, form({ invite: code }))).rejects.toThrow("REDIRECT:/dashboard");
    expect((await store.listInvites())[0].uses).toBe(1);
    const again = await startOperator(blank, form({ invite: code }));
    expect(again.errors.invite).toBe(INVITE_ERROR);
  });

  it("without the flag, sign-up works as before (no code asked)", async () => {
    const { startOperator } = await import("@/app/start/actions");
    await expect(startOperator({ errors: {}, handle: "" }, form({}))).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("feedback", () => {
  it("stores trimmed text without control characters, with a request id; refuses empty or oversized text", async () => {
    const { submitFeedbackAction } = await import("@/app/(app)/feedback/actions");
    const ok = await submitFeedbackAction({ kind: "lesson_check", route: "/learn/soc-l1-triage-loop-01", message: "  option b\u0007 has a typo  ", ref: { lessonId: "soc-l1-triage-loop-01", questionId: "q2" } });
    expect(ok).toMatchObject({ ok: true });
    const saved = (await store.listFeedback())[0];
    expect(saved).toMatchObject({ kind: "lesson_check", contentId: "soc-l1-triage-loop-01:q2", message: "option b has a typo", userId: operator.id });
    for (const bad of [{ kind: "general", route: "/x", message: "" }, { kind: "general", route: "/x", message: "x".repeat(2001) }, { kind: "general", route: "javascript:alert(1)", message: "hi" }, { kind: "nope", route: "/x", message: "hi" }]) {
      expect(await submitFeedbackAction(bad)).toMatchObject({ ok: false, requestId: expect.any(String) });
    }
  });

  it("never resolves another learner's exam or attempt into a content id", async () => {
    const { submitFeedbackAction } = await import("@/app/(app)/feedback/actions");
    await submitFeedbackAction({ kind: "exam_question", route: "/labs/soc/exams/x", message: "hm", ref: { examId: "00000000-0000-4000-8000-000000000000", itemKey: "q0123456789ab" } });
    await submitFeedbackAction({ kind: "scenario", route: "/labs/soc/x", message: "hm", ref: { attemptId: "00000000-0000-4000-8000-000000000001" } });
    expect((await store.listFeedback()).map((f) => f.contentId)).toEqual(["exam:unknown", "scenario:unknown"]);
  });

  it("is rate limited per learner", async () => {
    const { submitFeedbackAction } = await import("@/app/(app)/feedback/actions");
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await submitFeedbackAction({ kind: "general", route: "/dashboard", message: `n${i}` }));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });

  it("export groups by content item and pseudonymises learners", () => {
    const rows = [
      { id: "1", userId: "user-a", kind: "lesson_check" as const, contentId: "l1:q1", route: "/a", message: "m1", requestId: "r1", createdAt: "2026-10-16T01:00:00Z" },
      { id: "2", userId: "user-b", kind: "lesson_check" as const, contentId: "l1:q1", route: "/a", message: "m2", requestId: "r2", createdAt: "2026-10-16T02:00:00Z" },
      { id: "3", userId: "user-a", kind: "general" as const, contentId: "", route: "/b", message: "m3", requestId: "r3", createdAt: "2026-10-16T03:00:00Z" },
    ];
    const g = groupFeedback(rows, "salt");
    expect(g.map((x) => [x.item, x.count])).toEqual([["lesson_check:l1:q1", 2], ["general", 1]]);
    expect(JSON.stringify(g)).not.toMatch(/user-a|user-b/);
  });
});
