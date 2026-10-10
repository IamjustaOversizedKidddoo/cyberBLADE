import { describe, it, expect } from "vitest";
import { createRng } from "@/lib/generators/rng";
import { siemInvestigation } from "@/lib/generators/siem/siem-investigation";

describe("siemInvestigation generator", () => {
  it("produces deterministic SIEM environment and answers from a seed", () => {
    const rng1 = createRng("test-seed-42");
    const output1 = siemInvestigation(rng1, {});

    const rng2 = createRng("test-seed-42");
    const output2 = siemInvestigation(rng2, {});

    expect(output1.answers).toEqual(output2.answers);
    expect(output1.env.kind).toBe("siem");
    if (output1.env.kind === "siem") {
      expect(output1.env.siem.events.length).toBeGreaterThan(5);
      expect(output1.answers.attackerIp).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(output1.answers.targetUser).toBeTruthy();
      expect(output1.answers.failedCount).toMatch(/^\d+$/);
      expect(output1.answers.serviceName).toBeTruthy();
      expect(output1.answers.flag).toMatch(/^FLAG\{siem_ir_[a-f0-9]+\}$/);

      // Verify the events contain the attacker IP and target user
      const bruteForceEvents = output1.env.siem.events.filter(
        (e) => e.eventId === "4625" && e.sourceIp === output1.answers.attackerIp,
      );
      expect(bruteForceEvents.length).toBe(Number(output1.answers.failedCount));
    }
  });

  it("produces different randomized answers for different seeds", () => {
    const outputA = siemInvestigation(createRng("seed-alpha"), {});
    const outputB = siemInvestigation(createRng("seed-beta"), {});

    expect(outputA.answers.flag).not.toEqual(outputB.answers.flag);
  });
});
