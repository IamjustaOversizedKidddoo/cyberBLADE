import path from "node:path";
import { labSchema } from "@/lib/lab-engine/lab-schema";
import { listLabs, loadLab } from "@/lib/lab-engine/labs";

const ROOT = path.join("tests", "fixtures", "labs");

const valid = {
  id: "core-r0-terminal-lab-01",
  title: "First Terminal",
  type: "terminal",
  track: "core",
  rank: 0,
  estimated_minutes: 20,
  briefing: "briefing.md",
  dataset: { generator: "first_terminal", params: {} },
  objectives: [{ id: "o1", prompt: "Flag?", check: { kind: "flag", answer_from: "generator.flag1" } }],
  hints: { o1: ["Look for hidden files."] },
  xp: 150,
  mitre: [],
};

test("accepts a valid lab and defaults case_sensitive to true", () => {
  const lab = labSchema.parse(valid);
  expect(lab.objectives[0].check.case_sensitive).toBe(true);
  expect(lab.challenge).toBeUndefined();
});

test("accepts a challenge block", () => {
  const lab = labSchema.parse({ ...valid, challenge: { rank: 0, time_limit_minutes: 45, cooldown_minutes: 30 } });
  expect(lab.challenge).toEqual({ rank: 0, time_limit_minutes: 45, cooldown_minutes: 30 });
});

test.each([
  ["a lab type that is not built yet", { type: "siem" }],
  ["a hint for a missing objective", { hints: { o9: ["nope"] } }],
  ["answer_from outside the generator", { objectives: [{ id: "o1", prompt: "?", check: { kind: "flag", answer_from: "answers.flag" } }] }],
  ["no objectives", { objectives: [] }],
  ["duplicate objective ids", { objectives: [valid.objectives[0], valid.objectives[0]] }],
  ["zero xp", { xp: 0 }],
])("rejects %s", (_, patch) => {
  expect(labSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
});

test("loadLab reads lab.yaml and the briefing", async () => {
  const lab = await loadLab("fixture-lab-01", ROOT);
  expect(lab).toMatchObject({ id: "fixture-lab-01", xp: 50, briefingText: "You are on a simulated machine.\n" });
  expect(lab.dataset).toEqual({ generator: "fixture_gen", params: { files: 2 } });
});

test("folder name must equal the lab id", async () => {
  await expect(loadLab("wrong-folder", ROOT)).rejects.toThrow(/wrong-folder.*some-other-id/);
});

test("unknown lab", async () => {
  await expect(loadLab("missing-lab", ROOT)).rejects.toThrow(/missing-lab/);
});

test("lab ids cannot escape the labs folder", async () => {
  await expect(loadLab("../fixtures", ROOT)).rejects.toThrow(/invalid lab id/);
});

test("listLabs reports every broken lab", async () => {
  await expect(listLabs(ROOT)).rejects.toThrow(/wrong-folder/);
});
