import "server-only";
import fs from "node:fs/promises";
import { parseChecks, type CheckSet } from "./checks";
import { getLesson } from "./lessons";
import type { Lesson } from "./schema";

export function checksPathFor(lesson: Pick<Lesson, "filePath">): string {
  return lesson.filePath.replace(/\.mdx$/, ".checks.yaml");
}

/** The lesson's full check set, answer key included. Server only. */
export async function loadChecks(lessonId: string): Promise<CheckSet> {
  const lesson = await getLesson(lessonId);
  if (!lesson) throw new Error(`unknown lesson ${lessonId}`);
  const file = checksPathFor(lesson);
  const set = parseChecks(await fs.readFile(file, "utf8"), file);
  if (set.lesson !== lessonId) throw new Error(`${file}: lesson is ${set.lesson}, expected ${lessonId}`);
  return set;
}
