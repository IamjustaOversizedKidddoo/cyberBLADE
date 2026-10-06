import { lessonFrontmatterSchema } from "@/lib/content/schema";

const valid = {
  id: "core-r0-comp-hardware-01",
  title: "What a Computer Really Is",
  track: "core",
  rank: 0,
  module: "computers",
  order: 1,
  estimated_minutes: 30,
  objectives_covered: ["secplus:1.2"],
  mitre: [],
  xp: 100,
  status: "draft",
  last_reviewed: null,
};

test("accepts a valid frontmatter", () => {
  const parsed = lessonFrontmatterSchema.parse(valid);
  expect(parsed.id).toBe(valid.id);
  expect(parsed.lab).toBeUndefined();
});

test("accepts the purple track", () => {
  expect(lessonFrontmatterSchema.safeParse({ ...valid, id: "purple-r3-web-sqli-01", track: "purple", rank: 3 }).success).toBe(true);
});

test.each([
  ["bad id", { id: "lesson one" }],
  ["unknown track", { track: "gaming" }],
  ["rank too high", { rank: 6 }],
  ["order zero", { order: 0 }],
  ["too short", { estimated_minutes: 2 }],
  ["bad mitre id", { mitre: ["T10"] }],
  ["zero xp", { xp: 0 }],
  ["unknown status", { status: "live" }],
])("rejects %s", (_, patch) => {
  expect(lessonFrontmatterSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
});

test("accepts ATT&CK technique and sub-technique ids", () => {
  expect(lessonFrontmatterSchema.safeParse({ ...valid, mitre: ["T1059", "T1059.004"] }).success).toBe(true);
});

test("normalizes a YAML date for last_reviewed to YYYY-MM-DD", () => {
  expect(lessonFrontmatterSchema.parse({ ...valid, last_reviewed: new Date("2026-09-01T00:00:00Z") }).last_reviewed).toBe(
    "2026-09-01",
  );
  expect(lessonFrontmatterSchema.parse({ ...valid, last_reviewed: "2026-09-01" }).last_reviewed).toBe("2026-09-01");
});
