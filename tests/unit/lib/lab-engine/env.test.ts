import { describe, expect, it } from "vitest";
import type { Generator } from "@/lib/generators";
import { generateLab } from "@/lib/lab-engine/checks";
import { labSchema } from "@/lib/lab-engine/lab-schema";
import { assertEnvMatchesLab } from "@/lib/lab-engine/env";
import { demoWorld } from "@/lib/lab-engine/terminal/demo-world";

describe("lab environments", () => {
  it("assertEnvMatchesLab throws when generator returns wrong env kind", () => {
    expect(() =>
      assertEnvMatchesLab(
        { id: "test-pkt", type: "packet" },
        { kind: "terminal", world: demoWorld() },
      ),
    ).toThrowError("lab test-pkt: generator returned terminal env for a packet lab");
  });

  it("generateLab on a packet lab throws when generator returns terminal env", () => {
    const lab = labSchema.parse({
      id: "pkt-01",
      title: "Packet test",
      type: "packet",
      track: "core",
      rank: 1,
      estimated_minutes: 15,
      briefing: "briefing.md",
      dataset: { generator: "fake_gen", params: {} },
      objectives: [
        { id: "o1", prompt: "test", check: { kind: "flag", answer_from: "generator.flag" } },
      ],
      xp: 100,
    });

    const fakeRegistry: Record<string, Generator> = {
      fake_gen: () => ({
        env: { kind: "terminal" as const, world: demoWorld() },
        answers: { flag: "NEON{1234567890ab}" },
      }),
    };

    expect(() => generateLab(lab, "seed-1", fakeRegistry)).toThrowError(
      "lab pkt-01: generator returned terminal env for a packet lab",
    );
  });
});
