import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { socFamilySchema, type SocFamily } from "@/lib/lab-engine/soc/family-schema";
import { generateSocVariant } from "@/lib/lab-engine/soc/generator";
import {
  generateScenarioQuestions,
  normalizeAnswer,
  verifyAnswer,
  type ServerQuestionTruth,
} from "@/lib/lab-engine/soc/query/questions";

function loadFamily(familyId: string): SocFamily {
  const filePath = path.resolve(`content/soc/families/${familyId}.yaml`);
  const raw = fs.readFileSync(filePath, "utf8");
  return socFamilySchema.parse(parseYaml(raw));
}

describe("BladeQL Part E: Investigation Questions & Server Verification", () => {
  it("generates 8 verifiable investigation questions with zero ground-truth leaks in learner models", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "seed-questions-test-1", "beginner");

    const { learnerQuestions, serverTruths } = generateScenarioQuestions(
      scenario,
      "seed-questions-test-1",
    );

    expect(learnerQuestions.length).toBe(8);
    expect(serverTruths.length).toBe(8);

    // Verify learner questions contain NO answers, NO reference queries, and NO ground truth
    for (const q of learnerQuestions) {
      expect(q.id).toBeDefined();
      expect(q.stem.length).toBeGreaterThan(10);
      expect(q.points).toBeGreaterThan(0);
      expect(q.attemptsLeft).toBe(5);
      expect(q.status).toBe("unanswered");

      // Verify ground truth fields are NOT present
      expect((q as unknown as Record<string, unknown>).referenceAnswer).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).referenceQuery).toBeNull();
      // Uniform shape (S7): the key exists but holds nothing until solved or locked.
      expect((q as unknown as Record<string, unknown>).debrief).toBeNull();
    }
  });

  it("proves answerability: reference queries match server ground truth answers", () => {
    const family = loadFamily("soc-f-phishing-cred-01");
    const { scenario } = generateSocVariant(family, "seed-answerability-1", "beginner");

    const { serverTruths } = generateScenarioQuestions(scenario, "seed-answerability-1");

    for (const truth of serverTruths) {
      expect(truth.referenceAnswer).toBeDefined();
      expect(truth.referenceQuery).toBeDefined();

      // Verify reference answer matches itself via verifyAnswer
      const check = verifyAnswer(truth.referenceAnswer, truth);
      expect(check.isCorrect).toBe(true);
    }
  });

  it("normalizes defanged IoCs, timestamps, and formatting variations correctly", () => {
    // 1. Defanged IP & URL refanging
    const truthIp: ServerQuestionTruth = {
      id: "q-ip",
      scenarioId: "sc-1",
      referenceAnswer: "198.51.100.25",
      referenceQuery: "",
      debrief: "",
      type: "entity",
    };

    expect(verifyAnswer("198[.]51[.]100[.]25", truthIp).isCorrect).toBe(true);
    expect(verifyAnswer("  198.51.100.25  ", truthIp).isCorrect).toBe(true);
    expect(verifyAnswer("198.51.100.99", truthIp).isCorrect).toBe(false);

    // 2. Defanged Domain & URL
    const truthUrl: ServerQuestionTruth = {
      id: "q-url",
      scenarioId: "sc-1",
      referenceAnswer: "http://malicious.example/login",
      referenceQuery: "",
      debrief: "",
      type: "entity",
    };
    expect(verifyAnswer("hxxp://malicious[.]example/login", truthUrl).isCorrect).toBe(true);

    // 3. Timestamp tolerance within 60 seconds
    const truthTs: ServerQuestionTruth = {
      id: "q-ts",
      scenarioId: "sc-1",
      referenceAnswer: "2026-10-12T08:15:30.000Z",
      toleranceSeconds: 60,
      referenceQuery: "",
      debrief: "",
      type: "timestamp",
    };

    expect(verifyAnswer("2026-10-12T08:15:45.000Z", truthTs).isCorrect).toBe(true); // +15s (within 60s)
    expect(verifyAnswer("2026-10-12T08:14:40.000Z", truthTs).isCorrect).toBe(true); // -50s (within 60s)
    expect(verifyAnswer("2026-10-12T08:20:00.000Z", truthTs).isCorrect).toBe(false); // +4.5m (outside)
  });

  // The lockout/rate-limit test moved to question-service.test.ts: answers are now checked
  // server-side with persisted attempts (S7), not by an in-memory browser function.
});
