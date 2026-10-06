import path from "node:path";
import { loadLessons } from "@/lib/content/lessons";
import { isVisible } from "@/lib/content/visibility";

const fixtures = (name: string) => path.join("tests", "fixtures", name);

test("loads, parses and sorts lessons by order", async () => {
  const lessons = await loadLessons(fixtures("content"));
  expect(lessons.map((l) => l.id)).toEqual(["core-r0-test-first-01", "core-r0-test-second-01"]);
  expect(lessons[0]).toMatchObject({ slug: "b-first", title: "First", last_reviewed: "2026-09-01" });
  expect(lessons[0].body).toContain("Body of First.");
  expect(lessons[0].filePath).toMatch(/b-first\.mdx$/);
});

test("invalid frontmatter names the file and the field", async () => {
  await expect(loadLessons(fixtures("content-bad"))).rejects.toThrow(/noxp\.mdx.*xp/s);
});

test("duplicate ids are rejected", async () => {
  await expect(loadLessons(fixtures("content-dup"))).rejects.toThrow(/duplicate id core-r0-test-same-01/);
});

test("a missing content folder yields no lessons", async () => {
  expect(await loadLessons(fixtures("does-not-exist"))).toEqual([]);
});

test("visibility: published always, drafts only when enabled", () => {
  expect(isVisible({ status: "draft" }, false)).toBe(false);
  expect(isVisible({ status: "reviewed" }, false)).toBe(false);
  expect(isVisible({ status: "published" }, false)).toBe(true);
  expect(isVisible({ status: "draft" }, true)).toBe(true);
});
