import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileProgressRepo } from "@/lib/progress/file-repo";

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "neon-progress-"));
  file = path.join(dir, "progress.json");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("concurrent XP awards for the same source count once", async () => {
  const repo = new FileProgressRepo(file);
  const results = await Promise.all(Array.from({ length: 10 }, () => repo.awardXp("u", "lesson:x", 100)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await repo.getXpTotal("u")).toBe(100);
});

test("XP from different sources and users adds up separately", async () => {
  const repo = new FileProgressRepo(file);
  await repo.awardXp("u", "lesson:a", 100);
  await repo.awardXp("u", "lab:b", 150);
  await repo.awardXp("v", "lesson:a", 100);
  expect(await repo.getXpTotal("u")).toBe(250);
  expect(await repo.getXpTotal("v")).toBe(100);
});

test("data survives a new repo instance on the same file", async () => {
  await new FileProgressRepo(file).awardXp("u", "lesson:x", 100);
  const attempt = await new FileProgressRepo(file).createAttempt({
    userId: "u",
    labId: "lab",
    seed: "s",
    mode: "practice",
    objectivesSolved: [],
    hintsUsed: 0,
    startedAt: "2026-10-07T00:00:00Z",
    expiresAt: null,
    completedAt: null,
    failedAt: null,
  });
  const again = new FileProgressRepo(file);
  expect(await again.getXpTotal("u")).toBe(100);
  expect(await again.getAttempt(attempt.id)).toEqual(attempt);
});

test("addCheckPassed is atomic and de-duplicates", async () => {
  const repo = new FileProgressRepo(file);
  await Promise.all(["q1", "q2", "q1", "q3"].map((q) => repo.addCheckPassed("u", "l", q)));
  expect((await repo.getLessonProgress("u", "l"))?.checksPassed.sort()).toEqual(["q1", "q2", "q3"]);
});

test("lookups with prototype-like keys return nothing", async () => {
  const repo = new FileProgressRepo(file);
  expect(await repo.getAttempt("__proto__")).toBeNull();
  expect(await repo.getLessonProgress("constructor", "x")).toBeNull();
});
