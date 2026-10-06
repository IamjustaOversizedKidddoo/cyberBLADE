import { dir, file } from "@/lib/lab-engine/terminal/build";
import { checkObjective, generateLab, normalizeAnswer } from "@/lib/lab-engine/checks";
import { labSchema, type Lab } from "@/lib/lab-engine/lab-schema";
import type { Generator } from "@/lib/generators";

const lab: Lab = labSchema.parse({
  id: "fixture-lab-01",
  title: "Fixture",
  type: "terminal",
  track: "core",
  rank: 0,
  estimated_minutes: 10,
  briefing: "briefing.md",
  dataset: { generator: "fixture_gen", params: { name: "x" } },
  objectives: [
    { id: "o1", prompt: "flag?", check: { kind: "flag", answer_from: "generator.flag" } },
    { id: "o2", prompt: "who?", check: { kind: "flag", answer_from: "generator.user", case_sensitive: false } },
    { id: "o3", prompt: "broken", check: { kind: "flag", answer_from: "generator.missing" } },
  ],
  hints: {},
  xp: 50,
  mitre: [],
});

const answers = { flag: "NEON{abc}", user: "Alice" };

test.each([
  ["  NEON{abc}\n", true],
  ["NEON{abc}", true],
  ["neon{abc}", false],
  ["NEON{abd}", false],
  ["", false],
])("flag %j → %s", (submitted, expected) => {
  expect(checkObjective(lab, answers, "o1", submitted)).toBe(expected);
});

test("case-insensitive objectives", () => {
  expect(checkObjective(lab, answers, "o2", "alice")).toBe(true);
  expect(checkObjective(lab, answers, "o2", " ALICE ")).toBe(true);
  expect(checkObjective(lab, answers, "o2", "bob")).toBe(false);
});

test("unknown objective or missing generator answer is a configuration error", () => {
  expect(() => checkObjective(lab, answers, "o9", "x")).toThrow(/o9/);
  expect(() => checkObjective(lab, answers, "o3", "x")).toThrow(/missing/);
});

test("normalizeAnswer trims and collapses inner whitespace", () => {
  expect(normalizeAnswer("  a   b\t c \n")).toBe("a b c");
});

describe("generateLab", () => {
  const fixtureGen: Generator = (rng, params) => {
    const flag = `NEON{${rng.hex(12)}}`;
    return {
      world: {
        hostname: "h",
        user: "op",
        home: "/home/op",
        root: dir({ home: dir({ op: dir({ "flag.txt": file(flag) }, { owner: "op" }) }) }),
      },
      answers: { flag, user: String(params.name) },
    };
  };
  const registry = { fixture_gen: fixtureGen };

  test("same seed gives the same world and answers; another seed differs", () => {
    const a = generateLab(lab, "seed-a", registry);
    expect(generateLab(lab, "seed-a", registry)).toEqual(a);
    expect(generateLab(lab, "seed-b", registry).answers.flag).not.toBe(a.answers.flag);
    expect(a.answers.user).toBe("x");
  });

  test("unknown generator", () => {
    expect(() => generateLab(lab, "s", {})).toThrow(/fixture_gen/);
  });
});
