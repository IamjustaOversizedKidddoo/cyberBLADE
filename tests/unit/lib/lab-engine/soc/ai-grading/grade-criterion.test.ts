import { describe, expect, it } from "vitest";
import { gradeCriterion, ProviderUnavailableError, type TokenBudget } from "@/lib/lab-engine/soc/ai-grading/grade-criterion";
import {
  createContentHeuristicMock,
  createFabricatedQuoteMock,
  createMalformedMock,
  createOversizedMock,
  createRefusingMock,
  createScriptedProvider,
  createThrowingMock,
  createTimeoutMock,
  extractFencedReport,
  respondWithBand,
} from "@/lib/lab-engine/soc/ai-grading/mock-providers";
import { gradeArgsFor, sampleReport } from "./helpers";

describe("gradeCriterion", () => {
  it("grades with N=3 samples at temperature 0 and verified spans", async () => {
    const provider = createContentHeuristicMock();
    const o = await gradeCriterion({ ...gradeArgsFor("reasoning_evidence_linkage"), provider });
    expect(o.status).toBe("graded");
    expect(o.band).toBe(3);
    expect(o.confidence).toBe("high");
    expect(o.eligibleToCount).toBe(true);
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls.every((c) => c.temperature === 0 && c.jsonMode)).toBe(true);
    expect(o.verifiedSpans.length).toBeGreaterThanOrEqual(2);
    expect(o.feedback.summary).toMatch(/^Explicitly reasoned:/);
    expect(o.modelId).toBe("mock:content-heuristic");
    expect(o.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a fresh fence and canary on every call", async () => {
    const provider = createContentHeuristicMock();
    await gradeCriterion({ ...gradeArgsFor("narrative_quality"), provider });
    const fences = provider.calls.map((c) => /<<<REPORT-([0-9a-f]+)>>>/.exec(c.userMessage)?.[1]);
    const canaries = provider.calls.map((c) => /CANARY-[0-9a-f]+/.exec(c.systemPrompt)?.[0]);
    expect(new Set(fences).size).toBe(3);
    expect(new Set(canaries).size).toBe(3);
  });

  it("produces the same input hash for the same report regardless of nonce", async () => {
    const a = await gradeCriterion({ ...gradeArgsFor("coherence"), provider: createContentHeuristicMock() });
    const b = await gradeCriterion({ ...gradeArgsFor("coherence"), provider: createContentHeuristicMock() });
    expect(a.inputHash).toBe(b.inputHash);
  });

  it.each([
    ["refusals", createRefusingMock, "invalid_output"],
    ["malformed JSON", createMalformedMock, "invalid_output"],
    ["oversized output", createOversizedMock, "invalid_output"],
    ["fabricated quotes", createFabricatedQuoteMock, "invalid_output"],
  ] as const)("does not guess on %s: retries once per sample, then Not graded", async (_label, make, reason) => {
    const provider = make();
    const o = await gradeCriterion({ ...gradeArgsFor("narrative_quality"), provider });
    expect(o.status).toBe("not_graded");
    expect(o.notGradedReason).toBe(reason);
    expect(o.band).toBeUndefined();
    expect(provider.calls).toHaveLength(6); // 3 samples x (1 try + 1 retry)
    expect(o.rawSamples.every((s) => s.rejection)).toBe(true);
  });

  it("still grades when one sample is invalid twice but two are valid", async () => {
    const provider = createScriptedProvider((req, i) =>
      i < 2 ? "not json" : respondWithBand(2, extractFencedReport(req.userMessage).sections),
    );
    const o = await gradeCriterion({ ...gradeArgsFor("narrative_quality"), provider });
    expect(o.status).toBe("graded");
    expect(o.band).toBe(2);
  });

  it("surfaces timeouts and quota errors as retryable provider trouble (no grade recorded)", async () => {
    await expect(gradeCriterion({ ...gradeArgsFor("coherence"), provider: createTimeoutMock() })).rejects.toBeInstanceOf(ProviderUnavailableError);
    await expect(gradeCriterion({ ...gradeArgsFor("coherence"), provider: createThrowingMock("Groq API rate limit or quota exceeded (429)") })).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("skips the call entirely when the pre-filter rejects the text", async () => {
    const provider = createContentHeuristicMock();
    const r = sampleReport();
    r.escalation.handoffSummary = "";
    r.escalation.requiresEscalation = false;
    const o = await gradeCriterion({ ...gradeArgsFor("handoff_usefulness", r), provider });
    expect(o).toMatchObject({ status: "not_graded", notGradedReason: "empty" });
    expect(provider.calls).toHaveLength(0);
  });

  it("stops at the token budget instead of overspending", async () => {
    const provider = createContentHeuristicMock();
    let spent = 0;
    const budget: TokenBudget = {
      allow: (est) => (spent + est > 1500 ? "submission_token_cap" : null),
      consume: (i, o) => {
        spent += i + o;
      },
    };
    const o = await gradeCriterion({ ...gradeArgsFor("narrative_quality"), provider, budget });
    expect(o).toMatchObject({ status: "not_graded", notGradedReason: "submission_token_cap" });
    expect(provider.calls.length).toBeLessThan(3);
  });

  it("marks wide disagreement as low confidence and not countable", async () => {
    const bands = [0, 2, 3] as const;
    const provider = createScriptedProvider((req, i) => respondWithBand(bands[i % 3], extractFencedReport(req.userMessage).sections));
    const o = await gradeCriterion({ ...gradeArgsFor("narrative_quality"), provider });
    expect(o).toMatchObject({ status: "graded", band: 2, confidence: "low", eligibleToCount: false });
    expect(o.flags).toContain("disagreement");
  });

  it("applies the sanity rule: a high band on very short text needs review and does not count", async () => {
    const r = sampleReport();
    r.executiveSummary = "Account a.mehta was phished from billing-notice.example.net.";
    r.attackNarrative = "Sign-in from 198.51.100.23 (alt-019) followed.";
    const provider = createScriptedProvider((req) => respondWithBand(3, extractFencedReport(req.userMessage).sections));
    const o = await gradeCriterion({ ...gradeArgsFor("narrative_quality", r), provider });
    expect(o.status).toBe("needs_review");
    expect(o.eligibleToCount).toBe(false);
    expect(o.flags).toContain("sanity_high_band_short_text");
  });
});
