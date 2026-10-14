import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChecks, type CheckSet } from "@/lib/content/checks";
import { parseExercises, type ExerciseSet } from "@/lib/content/exercises";
import { loadLessons } from "@/lib/content/lessons";
import type { Lesson } from "@/lib/content/schema";
import {
  computeLessonTime,
  leakedMarkers,
  lintSocLesson,
  nonReservedIndicators,
  prerequisiteGraphErrors,
  type SocLintInput,
} from "@/lib/content/soc-lesson-lint";
import { loadGeneratorMarkers, markersIn } from "@/lib/content/soc-markers";
import { loadLessonCards } from "@/lib/content/soc-track";

const PILOT = "content/tracks/soc/l1/m04-email/13-header-analysis.mdx";

async function pilotInput(): Promise<SocLintInput> {
  const lesson = (await loadLessons("content")).find((l) => l.filePath.replace(/\\/g, "/").endsWith(PILOT))!;
  const read = (ext: string) => fs.readFileSync(PILOT.replace(/\.mdx$/, ext), "utf8");
  return {
    lesson,
    checks: parseChecks(read(".checks.yaml"), "checks"),
    exercises: parseExercises(read(".exercises.yaml"), "exercises"),
    cards: loadLessonCards(PILOT)!.cards,
    skillIds: new Set(["soc_phishing_analysis"]),
    moduleKeys: new Set(["email"]),
    minCoreRank: 1,
    practiceError: () => null,
    markers: loadGeneratorMarkers(),
  };
}

function withBody(input: SocLintInput, body: string): SocLintInput {
  return { ...input, lesson: { ...input.lesson, body } };
}

describe("SOC L1 lesson linter", () => {
  it("accepts the email-header pilot as written", async () => {
    expect(lintSocLesson(await pilotInput()).errors).toEqual([]);
  });

  it("rejects a missing or reordered template section", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, input.lesson.body.replace("## Worked example", "## Example"))).errors;
    expect(errs.some((e) => e.includes('"## Worked example"'))).toBe(true);
  });

  it("rejects a missing outcome line", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, input.lesson.body.replace("> **Outcome:**", "> Outcome:"))).errors;
    expect(errs.some((e) => e.includes("Outcome"))).toBe(true);
  });

  it("rejects a reused generator indicator (leak scan)", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, `${input.lesson.body}\nSee portal.invoice-secure.example for details.`)).errors;
    expect(errs.some((e) => e.includes("generator vocabulary"))).toBe(true);
  });

  it("rejects a real-world IP or domain", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, `${input.lesson.body}\nIt came from 8.8.8.8 via mail.realbank.com.`)).errors;
    expect(errs.some((e) => e.includes("8.8.8.8"))).toBe(true);
    expect(errs.some((e) => e.includes("mail.realbank.com"))).toBe(true);
  });

  it("rejects certification names and hype", async () => {
    const input = await pilotInput();
    const body = `${input.lesson.body}\nThis is on the CompTIA exam and makes you 100% secure.`;
    const errs = lintSocLesson(withBody(input, body)).errors;
    expect(errs.some((e) => e.includes("certification"))).toBe(true);
    expect(errs.some((e) => e.includes("hype"))).toBe(true);
  });

  it("rejects non-canonical disposition wording", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, `${input.lesson.body}\nCall it a benign positive.`)).errors;
    expect(errs.some((e) => e.includes('"benign true positive"'))).toBe(true);
  });

  it("rejects a hint that gives the answer away", async () => {
    const input = await pilotInput();
    const ex = structuredClone(input.exercises) as ExerciseSet;
    ex.exercises[0].questions[0].hints = ["The answer is 192.0.2[.]58."];
    const errs = lintSocLesson({ ...input, exercises: ex }).errors;
    expect(errs.some((e) => e.includes("hint reveals the answer"))).toBe(true);
  });

  it("rejects an embedded exercise id with no definition", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, input.lesson.body.replace('id="header-check"', 'id="nope"'))).errors;
    expect(errs.some((e) => e.includes('id="nope"'))).toBe(true);
  });

  it("rejects fewer than four checks", async () => {
    const input = await pilotInput();
    const checks = { ...input.checks!, questions: input.checks!.questions.slice(0, 3) } as CheckSet;
    expect(lintSocLesson({ ...input, checks }).errors.some((e) => e.includes("at least 4"))).toBe(true);
  });

  it("rejects a wrong estimated time, a non-draft status, a wrong rank and unknown skills/practice", async () => {
    const input = await pilotInput();
    const lesson: Lesson = { ...input.lesson, estimated_minutes: 5, status: "published", rank: 2, skills: ["soc_made_up"] };
    const errs = lintSocLesson({ ...input, lesson, practiceError: () => "no page yet" }).errors.join("\n");
    expect(errs).toContain("computed");
    expect(errs).toContain("status must stay draft");
    expect(errs).toContain("min_core_rank");
    expect(errs).toContain("unknown skill soc_made_up");
    expect(errs).toContain("no page yet");
  });

  it("rejects a flashcard front that is not a question", async () => {
    const input = await pilotInput();
    const cards = [{ ...input.cards![0], front: "Convert this time to UTC." }];
    expect(lintSocLesson({ ...input, cards }).errors.some((e) => e.includes("question mark"))).toBe(true);
  });

  it("fails a lesson over 25 minutes", async () => {
    const input = await pilotInput();
    const long = `${input.lesson.body}

${"word ".repeat(1200)}`;
    const t = computeLessonTime({ ...input.lesson, body: long }, input.checks);
    const errs = lintSocLesson(withBody({ ...input, lesson: { ...input.lesson, estimated_minutes: t.minutes } }, long)).errors;
    expect(t.minutes).toBeGreaterThan(25);
    expect(errs.some((e) => e.includes("split the lesson"))).toBe(true);
  });

  it("computes time from words, exercises, checks and diagrams", async () => {
    const input = await pilotInput();
    const t = computeLessonTime(input.lesson, input.checks);
    expect(t.minutes).toBe(Math.ceil(t.words / 200 + t.exercises * 3 + t.checks + t.diagrams * 0.5));
    expect(t.minutes).toBe(input.lesson.estimated_minutes);
  });
});

describe("indicator helpers", () => {
  it("allows documentation, private and reserved ranges and names", () => {
    expect(nonReservedIndicators("192.0.2.5 198.51.100.7 203.0.113.9 10.1.2.3 172.16.40.30 mx2.larkspur.example a.test example.com x.example.net")).toEqual([]);
  });

  it("flags public IPs and real TLDs", () => {
    expect(nonReservedIndicators("1.1.1.1 and evil.ru")).toEqual(["1.1.1.1", "evil.ru"]);
  });

  it("ignores file names that look like hosts", () => {
    expect(nonReservedIndicators("Open Q4 rates.xlsx or report.pdf")).toEqual([]);
  });

  it("extracts markers but skips system binaries and templated values", () => {
    expect(markersIn("powershell.exe dropped stage2.bin from {c2Domain}")).toEqual(["stage2.bin"]);
    expect(markersIn("Message from <billing-update@{phishingDomain}>")).toEqual([]);
  });

  it("finds a marker regardless of case", () => {
    expect(leakedMarkers("Subject: URGENT: Revised Vendor Remittance Invoice", ["urgent: revised vendor remittance invoice"])).toHaveLength(1);
  });

  it("collects the generator's IOC pools", () => {
    const m = loadGeneratorMarkers();
    expect(m).toContain("198.51.100.24");
    expect(m).toContain("portal.invoice-secure.example");
    expect(m).not.toContain("powershell.exe");
  });
});

describe("prerequisite graph", () => {
  const node = (id: string, track: "core" | "soc", rank: number, order: number, prerequisites: string[] = []) => ({ id, track, rank, module: "m", order, prerequisites });

  it("accepts backwards edges", () => {
    expect(prerequisiteGraphErrors([node("core-a", "core", 1, 1), node("soc-1", "soc", 1, 1, ["core-a"]), node("soc-2", "soc", 1, 2, ["soc-1"])], 1)).toEqual([]);
  });

  it("rejects unknown, forward, above-gate and cyclic prerequisites", () => {
    const errs = prerequisiteGraphErrors(
      [
        node("core-hi", "core", 2, 1),
        node("soc-1", "soc", 1, 1, ["soc-2", "missing", "core-hi"]),
        node("soc-2", "soc", 1, 2, ["soc-1"]),
      ],
      1,
    ).join("\n");
    expect(errs).toContain("missing does not exist");
    expect(errs).toContain("comes later");
    expect(errs).toContain("above the track gate");
    expect(errs).toContain("cycle");
  });
});

describe("drills can be switched off", () => {
  it("rejects a lesson whose only practice targets are drills", async () => {
    const input = await pilotInput();
    const lesson = { ...input.lesson, practice: ["drill:drill-01"] };
    expect(lintSocLesson({ ...input, lesson }).errors.some((e) => e.includes("non-drill target"))).toBe(true);
  });

  it("rejects prose that refers to drills as linked below", async () => {
    const input = await pilotInput();
    const errs = lintSocLesson(withBody(input, `${input.lesson.body}\nThe query drills linked below help.`)).errors;
    expect(errs.some((e) => e.includes("linked below"))).toBe(true);
  });
});
