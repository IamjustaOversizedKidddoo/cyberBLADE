import { describe, expect, it } from "vitest";
import { calculateReadinessSync, scoreToBand } from "@/lib/readiness/calculator";
import type { Coverage } from "@/lib/content/validate";
import type { Lesson } from "@/lib/content/schema";

const mockCoverage: Coverage = {
  built_ranks: [0, 1],
  certs: {
    netplus: { name: "CompTIA Network+", exam: "N10-009" },
    secplus: { name: "CompTIA Security+", exam: "SY0-701" },
  },
  objectives: [
    { id: "netplus:1.1", summary: "OSI & TCP/IP models", target_rank: 1 },
    { id: "netplus:1.4", summary: "Ports and protocols", target_rank: 1 },
    { id: "secplus:1.1", summary: "Security controls", target_rank: 2 },
    { id: "secplus:1.2", summary: "CIA triad and fundamental security", target_rank: 2 },
  ],
};

const mockLessons: Lesson[] = [
  {
    id: "lesson-net-01",
    title: "Layered Models",
    track: "core",
    rank: 1,
    module: "networking",
    order: 1,
    estimated_minutes: 20,
    objectives_covered: ["netplus:1.1"],
    mitre: [],
    xp: 100,
    status: "draft",
    last_reviewed: null,
    slug: "lesson-net-01",
    filePath: "lesson-net-01.mdx",
    body: "Lesson body",
  },
  {
    id: "lesson-net-02",
    title: "Ports & Protocols",
    track: "core",
    rank: 1,
    module: "networking",
    order: 2,
    estimated_minutes: 20,
    objectives_covered: ["netplus:1.4"],
    mitre: [],
    xp: 100,
    status: "draft",
    last_reviewed: null,
    slug: "lesson-net-02",
    filePath: "lesson-net-02.mdx",
    body: "Lesson body",
  },
];

describe("Cert Readiness Calculator", () => {
  it("maps score percentages to grading bands accurately", () => {
    expect(scoreToBand(100)).toBe("Exam Ready");
    expect(scoreToBand(95)).toBe("Exam Ready");
    expect(scoreToBand(90)).toBe("Strong");
    expect(scoreToBand(85)).toBe("Strong");
    expect(scoreToBand(75)).toBe("Good");
    expect(scoreToBand(70)).toBe("Good");
    expect(scoreToBand(60)).toBe("Needs review");
    expect(scoreToBand(50)).toBe("Needs review");
    expect(scoreToBand(45)).toBe("Weak");
    expect(scoreToBand(0)).toBe("Weak");
  });

  it("calculates 0% readiness when no lessons are completed", () => {
    const results = calculateReadinessSync({
      coverage: mockCoverage,
      completedLessonIds: new Set(),
      lessons: mockLessons,
    });

    const netplus = results.find((r) => r.certId === "netplus")!;
    expect(netplus.scorePercent).toBe(0);
    expect(netplus.band).toBe("Weak");
    expect(netplus.completedObjectives).toBe(0);
    expect(netplus.totalObjectives).toBe(2);
  });

  it("calculates 50% readiness when one of two objectives is covered", () => {
    const results = calculateReadinessSync({
      coverage: mockCoverage,
      completedLessonIds: new Set(["lesson-net-01"]),
      lessons: mockLessons,
    });

    const netplus = results.find((r) => r.certId === "netplus")!;
    expect(netplus.scorePercent).toBe(50);
    expect(netplus.band).toBe("Needs review");
    expect(netplus.completedObjectives).toBe(1);
    expect(netplus.objectives.find((o) => o.id === "netplus:1.1")?.covered).toBe(true);
    expect(netplus.objectives.find((o) => o.id === "netplus:1.4")?.covered).toBe(false);
  });

  it("calculates 100% readiness and Exam Ready band when all objectives are covered", () => {
    const results = calculateReadinessSync({
      coverage: mockCoverage,
      completedLessonIds: new Set(["lesson-net-01", "lesson-net-02"]),
      lessons: mockLessons,
    });

    const netplus = results.find((r) => r.certId === "netplus")!;
    expect(netplus.scorePercent).toBe(100);
    expect(netplus.band).toBe("Exam Ready");
    expect(netplus.completedObjectives).toBe(2);
  });
});
