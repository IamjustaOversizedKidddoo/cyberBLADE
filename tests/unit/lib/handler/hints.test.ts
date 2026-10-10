import { describe, expect, it } from "vitest";
import { getNextLabHint } from "@/lib/handler/hints";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";

const mockLab: LoadedLab = {
  id: "test-lab-01",
  title: "Test Lab",
  type: "terminal",
  track: "core",
  rank: 1,
  estimated_minutes: 15,
  briefing: "briefing.md",
  briefingText: "Briefing text",
  dataset: { generator: "test_gen", params: {} },
  objectives: [
    {
      id: "o1",
      prompt: "Find the entry",
      check: { kind: "flag", answer_from: "generator.flag", case_sensitive: true },
    },
    {
      id: "o2",
      prompt: "Find the service",
      check: { kind: "flag", answer_from: "generator.service", case_sensitive: true },
    },
  ],
  hints: {
    o1: [
      "Tier 1: Look at the registry hive using Get-ItemProperty.",
      "Tier 2: Specifically check HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run.",
      "Tier 3: Query the value data of the non-system entry to find the answer.",
    ],
    o2: ["Tier 1: Inspect services."],
  },
  xp: 100,
  mitre: [],
};

describe("Handler Progressive Hints", () => {
  it("discloses Tier 1 when hintsUsed is 0", () => {
    const hint = getNextLabHint(mockLab, "o1", 0);
    expect(hint).not.toBeNull();
    expect(hint!.tier).toBe(1);
    expect(hint!.totalTiers).toBe(3);
    expect(hint!.hintText).toContain("Tier 1: Look at the registry hive");
    expect(hint!.newHintsUsedCount).toBe(1);
  });

  it("discloses Tier 2 when hintsUsed is 1", () => {
    const hint = getNextLabHint(mockLab, "o1", 1);
    expect(hint).not.toBeNull();
    expect(hint!.tier).toBe(2);
    expect(hint!.hintText).toContain("Tier 2: Specifically check HKLM");
    expect(hint!.newHintsUsedCount).toBe(2);
  });

  it("discloses Tier 3 when hintsUsed is 2", () => {
    const hint = getNextLabHint(mockLab, "o1", 2);
    expect(hint).not.toBeNull();
    expect(hint!.tier).toBe(3);
    expect(hint!.hintText).toContain("Tier 3: Query the value data");
    expect(hint!.newHintsUsedCount).toBe(3);
  });

  it("repeats Tier 3 if all hints have already been unlocked", () => {
    const hint = getNextLabHint(mockLab, "o1", 5);
    expect(hint).not.toBeNull();
    expect(hint!.tier).toBe(3);
    expect(hint!.hintText).toContain("Tier 3: Query the value data");
    expect(hint!.newHintsUsedCount).toBe(5);
  });

  it("returns null if objective has no configured hints", () => {
    const hint = getNextLabHint(mockLab, "nonexistent", 0);
    expect(hint).toBeNull();
  });
});
