import "server-only";
import fs from "node:fs/promises";
import { parseExercises, type ExerciseSet } from "./exercises";
import { getLesson } from "./lessons";

export function exercisesPathFor(filePath: string): string {
  return filePath.replace(/\.mdx$/, ".exercises.yaml");
}

/** Full exercise set incl. accepted answers. Server only. Null when the lesson has none. */
export async function loadExercises(lessonId: string): Promise<ExerciseSet | null> {
  const lesson = await getLesson(lessonId);
  if (!lesson) throw new Error(`unknown lesson ${lessonId}`);
  const file = exercisesPathFor(lesson.filePath);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  const set = parseExercises(text, file);
  if (set.lesson !== lessonId) throw new Error(`${file}: lesson is ${set.lesson}, expected ${lessonId}`);
  return set;
}
