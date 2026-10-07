import { checksSchema, type CheckSet } from "@/lib/content/checks";
import type { Lesson } from "@/lib/content/schema";
import { coverageSchema, validateContent, type ContentInput } from "@/lib/content/validate";
import { labSchema, type LoadedLab } from "@/lib/lab-engine/lab-schema";

const GOOD_BODY = `## Briefing

### 1. What it is
Text.

### 2. Why it exists
Text.

### 3. How it works

\`\`\`console
$ ls -la
$ cat /etc/hostname | wc -l
\`\`\`

### 4. How attackers abuse it
### 5. How defenders detect it
### 6. How to prevent/fix it
### 7. Common mistakes
### Remember it like this
### Interview answer

## Terminal Check

<TerminalCheck />

## Lab

<LabLink />

## Debrief

Done.
`;

const lesson = (patch: Partial<Lesson> = {}): Lesson => ({
  id: "core-r0-test-good-01",
  title: "Good",
  track: "core",
  rank: 0,
  module: "test",
  order: 1,
  estimated_minutes: 20,
  objectives_covered: ["secplus:5.4"],
  mitre: [],
  lab: "core-r0-test-lab-01",
  xp: 100,
  status: "draft",
  last_reviewed: null,
  slug: "good",
  filePath: "content/core/rank-0/good.mdx",
  body: GOOD_BODY,
  ...patch,
});

const checkSet = (lessonId: string, objective = "secplus:5.4"): CheckSet =>
  checksSchema.parse({
    lesson: lessonId,
    questions: ["q1", "q2", "q3"].map((id) => ({
      id,
      prompt: "?",
      objectives: [objective],
      options: [
        { text: "a", correct: true, explanation: "x" },
        { text: "b", correct: false, explanation: "y" },
      ],
    })),
  });

const lab = (id = "core-r0-test-lab-01", extra: Record<string, unknown> = {}): LoadedLab => ({
  ...labSchema.parse({
    id,
    title: "Lab",
    type: "terminal",
    track: "core",
    rank: 0,
    estimated_minutes: 10,
    briefing: "briefing.md",
    dataset: { generator: "demo", params: {} },
    objectives: [{ id: "o1", prompt: "?", check: { kind: "flag", answer_from: "generator.flag" } }],
    xp: 100,
    ...extra,
  }),
  briefingText: "Simulated.",
});

const coverage = coverageSchema.parse({
  built_ranks: [0],
  certs: { secplus: { name: "CompTIA Security+", exam: "SY0-701" } },
  objectives: [
    { id: "secplus:5.4", summary: "Legal and compliance basics", target_rank: 0 },
    { id: "secplus:1.4", summary: "Choosing cryptography", target_rank: 2 },
  ],
});

const input = (patch: Partial<ContentInput> = {}): ContentInput => {
  const lessons = patch.lessons ?? [lesson()];
  return {
    lessons,
    checks: new Map(lessons.map((l) => [l.id, checkSet(l.id)])),
    labs: [lab()],
    coverage,
    generators: ["demo"],
    runLessonCommands: () => [],
    now: new Date("2026-10-07T00:00:00Z"),
    ...patch,
  };
};

test("a good lesson produces no errors or warnings", async () => {
  expect(await validateContent(input())).toEqual({ errors: [], warnings: [] });
});

test("rule 1: missing or out-of-order sections", async () => {
  const body = GOOD_BODY.replace("### 7. Common mistakes\n", "").replace("## Debrief", "## Wrap-up");
  const { errors } = await validateContent(input({ lessons: [lesson({ body })] }));
  expect(errors).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/core-r0-test-good-01.*"### 7\."/),
      expect.stringMatching(/core-r0-test-good-01.*"## Debrief"/),
    ]),
  );
});

test("rule 1: headings inside code blocks do not count", async () => {
  const body = GOOD_BODY.replace("## Debrief\n", "```\n## Debrief\n```\n");
  const { errors } = await validateContent(input({ lessons: [lesson({ body })] }));
  expect(errors.some((e) => e.includes('"## Debrief"'))).toBe(true);
});

test("rule 1: Terminal Check and Lab placeholders", async () => {
  const body = GOOD_BODY.replace("<TerminalCheck />", "").replace("<LabLink />", "");
  const { errors } = await validateContent(input({ lessons: [lesson({ body })] }));
  expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/<TerminalCheck \/>/), expect.stringMatching(/<LabLink \/>/)]));
});

test("MDX that does not compile is reported (e.g. HTML comments)", async () => {
  const body = GOOD_BODY.replace("Done.", "<!-- a note -->");
  const { errors } = await validateContent(input({ lessons: [lesson({ body })] }));
  expect(errors.some((e) => e.startsWith("core-r0-test-good-01: MDX"))).toBe(true);
});

test("rule 2: missing checks file, unknown lab, challenge lab used as a lesson lab, unregistered generator", async () => {
  const l = lesson({ lab: "core-r0-nope-01" });
  const r1 = await validateContent(input({ lessons: [l], checks: new Map() }));
  expect(r1.errors).toEqual(
    expect.arrayContaining([expect.stringMatching(/no checks file/), expect.stringMatching(/unknown lab core-r0-nope-01/)]),
  );
  const r2 = await validateContent(input({ labs: [lab("core-r0-test-lab-01", { challenge: { rank: 0, time_limit_minutes: 45, cooldown_minutes: 30 } })] }));
  expect(r2.errors.some((e) => /challenge lab/.test(e))).toBe(true);
  const r3 = await validateContent(input({ generators: [] }));
  expect(r3.errors.some((e) => /generator demo is not registered/.test(e))).toBe(true);
});

test("rule 3: unknown objective ids and uncovered built-rank objectives", async () => {
  const l = lesson({ objectives_covered: ["secplus:9.9"] });
  const { errors } = await validateContent(
    input({ lessons: [l], checks: new Map([[l.id, checkSet(l.id, "netplus:1.1")]]) }),
  );
  expect(errors).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/core-r0-test-good-01: objective secplus:9.9 is not in the coverage matrix/),
      expect.stringMatching(/check q1 objective netplus:1.1 is not in the coverage matrix/),
      expect.stringMatching(/secplus:5.4 \(target rank 0\) has no lesson/),
    ]),
  );
});

test("rule 4: lesson commands that the lab shell cannot run", async () => {
  const { errors } = await validateContent(input({ runLessonCommands: () => ["$ nmap -sV host → command not found"] }));
  expect(errors).toEqual([expect.stringMatching(/core-r0-test-good-01: .*nmap -sV host/)]);
});

test("rule 5: reviews older than 12 months are warnings", async () => {
  const { errors, warnings } = await validateContent(input({ lessons: [lesson({ last_reviewed: "2025-09-01" })] }));
  expect(errors).toEqual([]);
  expect(warnings).toEqual([expect.stringMatching(/last reviewed 2025-09-01/)]);
});

test("coverage objectives must belong to a listed cert", () => {
  expect(
    coverageSchema.safeParse({ built_ranks: [], certs: {}, objectives: [{ id: "secplus:1.1", summary: "x", target_rank: 0 }] }).success,
  ).toBe(false);
});
