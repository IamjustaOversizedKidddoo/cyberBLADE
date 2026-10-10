import { describe, expect, it } from "vitest";
import { askHandler, requestProgressiveHint } from "@/lib/handler/service";
import { makeCtx } from "@/tests/unit/lib/progress/fakes";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import { labSchema } from "@/lib/lab-engine/lab-schema";

describe("Handler Service Integration", () => {
  it("processes learner questions with askHandler", async () => {
    const res = await askHandler({
      context: {
        kind: "lesson",
        lessonId: "test-lesson",
        lessonTitle: "Authentication & Authorization",
      },
      message: "what is the difference between authentication and authorization?",
    });

    expect(res.reply).toContain("What is");
    expect(res.commandRecognized).toBe("what_is");
    expect(res.providerUsed).toBe("heuristic");
    expect(res.blocked).toBe(false);
  });

  it("redacts leaked flags in askHandler output", async () => {
    const customProvider = {
      name: "heuristic" as const,
      generateReply: async () => "Congratulations, the key is FLAG{super_secret_payload_123}!",
    };

    const res = await askHandler({
      context: { kind: "lesson", lessonId: "test" },
      message: "give me the flag",
      provider: customProvider,
    });

    expect(res.reply).not.toContain("FLAG{super_secret_payload_123}");
    expect(res.reply).toContain("[REDACTED_FLAG: Discover via lab execution]");
    expect(res.blocked).toBe(true);
  });

  it("blocks transmission during challenge mode", async () => {
    const res = await askHandler({
      context: { kind: "lab", isChallenge: true },
      message: "how do I solve this?",
    });

    expect(res.reply).toContain("[COMM LINK SEVERED]");
    expect(res.blocked).toBe(true);
  });

  it("progressively discloses hints and increments hintsUsed on practice attempts", async () => {
    const { ctx, operators } = makeCtx();
    const op = await operators.create({ handle: "tutor-test", ethicsAcceptedAt: "now" });

    const labWithHints: LoadedLab = {
      ...labSchema.parse({
        id: "lab-hints-test",
        title: "Hints Test Lab",
        type: "terminal",
        track: "core",
        rank: 0,
        estimated_minutes: 10,
        briefing: "briefing.md",
        dataset: { generator: "flag_gen", params: {} },
        objectives: [
          { id: "o1", prompt: "Find the entry", check: { kind: "flag", answer_from: "generator.flag" } },
        ],
        hints: {
          o1: [
            "Tier 1: Check the /home/op directory.",
            "Tier 2: Inspect flag.txt.",
            "Tier 3: Read the exact contents of flag.txt with cat.",
          ],
        },
        xp: 100,
      }),
      briefingText: "Lab text",
    };

    // Override content to provide labWithHints
    ctx.content.loadLab = async () => labWithHints;

    const attempt = await ctx.repo.createAttempt({
      userId: op.id,
      labId: labWithHints.id,
      seed: "seed123",
      mode: "practice",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: new Date().toISOString(),
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    });

    // Request Hint 1
    const res1 = await requestProgressiveHint(ctx, op.id, attempt.id, "o1");
    expect(res1.progression.tier).toBe(1);
    expect(res1.progression.hintText).toContain("Tier 1: Check the /home/op");

    let updatedAttempt = await ctx.repo.getAttempt(attempt.id);
    expect(updatedAttempt?.hintsUsed).toBe(1);

    // Request Hint 2
    const res2 = await requestProgressiveHint(ctx, op.id, attempt.id, "o1");
    expect(res2.progression.tier).toBe(2);
    expect(res2.progression.hintText).toContain("Tier 2: Inspect flag.txt");

    updatedAttempt = await ctx.repo.getAttempt(attempt.id);
    expect(updatedAttempt?.hintsUsed).toBe(2);

    // Request Hint 3
    const res3 = await requestProgressiveHint(ctx, op.id, attempt.id, "o1");
    expect(res3.progression.tier).toBe(3);
    expect(res3.progression.hintText).toContain("Tier 3: Read the exact contents");

    updatedAttempt = await ctx.repo.getAttempt(attempt.id);
    expect(updatedAttempt?.hintsUsed).toBe(3);
  });

  it("refuses hints during challenge attempts", async () => {
    const { ctx, operators } = makeCtx();
    const op = await operators.create({ handle: "challenger", ethicsAcceptedAt: "now" });

    const attempt = await ctx.repo.createAttempt({
      userId: op.id,
      labId: "challenge-lab",
      seed: "seed123",
      mode: "challenge",
      objectivesSolved: [],
      hintsUsed: 0,
      startedAt: new Date().toISOString(),
      expiresAt: null,
      completedAt: null,
      failedAt: null,
    });

    await expect(requestProgressiveHint(ctx, op.id, attempt.id, "o1")).rejects.toThrow(
      "Hints are unavailable during rank challenges",
    );
  });
});
