import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const operator = { id: "u-cp", rank: 1 };
vi.mock("@/lib/identity/session", () => ({ requireOperator: async () => operator }));

import { answerCheckpointAction } from "@/app/(app)/learn/soc-l1/actions";
import { toPublicChecks } from "@/lib/content/checks";
import { loadChecks } from "@/lib/content/checks-server";
import { resetSubmissionRateLimits } from "@/lib/progress/rate-limit";

const LESSON = "soc-l1-triage-loop-01";

describe("answerCheckpointAction", () => {
  beforeEach(() => {
    process.env.NEON_SHOW_DRAFTS = "true";
    operator.rank = 1;
    operator.id = `u-${Math.random()}`;
    resetSubmissionRateLimits();
  });

  it("grades a checkpoint question with the learner's option order and never completes a lesson", async () => {
    const set = await loadChecks(LESSON);
    const q = set.questions.at(-1)!;
    const shown = toPublicChecks(set, operator.id).find((x) => x.id === q.id)!;
    const right = shown.options.indexOf(q.options.find((o) => o.correct)!.text);
    const r = await answerCheckpointAction("triage", `${LESSON}~${q.id}`, right);
    expect(r.correct).toBe(true);
    expect(r.lessonCompleted).toBe(false);
    const wrong = await answerCheckpointAction("triage", `${LESSON}~${q.id}`, right === 0 ? 1 : 0);
    expect(wrong.correct).toBe(false);
  });

  it("refuses a lesson from another module, malformed ids and learners below the gate", async () => {
    await expect(answerCheckpointAction("email", `${LESSON}~q5`, 0)).rejects.toThrow("not available");
    await expect(answerCheckpointAction("triage", "../etc~q1", 0)).rejects.toThrow("not available");
    await expect(answerCheckpointAction("triage", `${LESSON}~q99`, 0)).rejects.toThrow("not available");
    operator.rank = 0;
    await expect(answerCheckpointAction("triage", `${LESSON}~q5`, 0)).rejects.toThrow("not available");
  });
});
