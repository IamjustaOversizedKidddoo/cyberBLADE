import { describe, expect, it } from "vitest";
import { detectNearMiss } from "@/lib/lab-engine/nudges";
import type { Lab } from "@/lib/lab-engine/lab-schema";

const mockLab: Lab = {
  id: "test-lab",
  title: "Test Lab",
  type: "terminal",
  track: "core",
  rank: 1,
  estimated_minutes: 20,
  briefing: "briefing.md",
  dataset: { generator: "test", params: {} },
  xp: 100,
  mitre: [],
  hints: {},
  objectives: [
    {
      id: "o1",
      prompt: "Find the flag",
      check: { kind: "flag", answer_from: "generator.flag", case_sensitive: true },
    },
    {
      id: "o2",
      prompt: "Find the network CIDR",
      check: { kind: "flag", answer_from: "generator.net", case_sensitive: false },
    },
    {
      id: "o3",
      prompt: "Find the file path",
      check: { kind: "flag", answer_from: "generator.path", case_sensitive: true },
    },
    {
      id: "o4",
      prompt: "Find the PID",
      check: { kind: "flag", answer_from: "generator.pid", case_sensitive: false },
    },
  ],
};

const mockAnswers = {
  flag: "FLAG{super_secret_token}",
  net: "10.0.2.0/24",
  path: "/usr/local/bin/backdoor",
  pid: "4192",
};

describe("detectNearMiss", () => {
  it("detects case sensitivity mismatch", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o1", "flag{super_secret_token}");
    expect(nudge).toContain("casing");
  });

  it("detects missing flag wrapper", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o1", "super_secret_token");
    expect(nudge).toContain("Include the complete flag wrapper");
  });

  it("detects CIDR notation omitted", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o2", "10.0.2.0");
    expect(nudge).toContain("CIDR notation");
  });

  it("detects basename instead of absolute path", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o3", "backdoor");
    expect(nudge).toContain("full absolute path");
  });

  it("detects process name instead of PID", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o4", "nginx");
    expect(nudge).toContain("numeric process ID");
  });

  it("returns null on completely wrong answers", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o1", "random_gibberish");
    expect(nudge).toBeNull();
  });

  it("returns null on exact match", () => {
    const nudge = detectNearMiss(mockLab, mockAnswers, "o1", "FLAG{super_secret_token}");
    expect(nudge).toBeNull();
  });
});
