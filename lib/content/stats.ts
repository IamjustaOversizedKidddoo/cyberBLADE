import { loadLessons } from "@/lib/content/lessons";
import { listLabs } from "@/lib/lab-engine/labs";

export interface PlatformStats {
  lessonCount: number;
  labCount: number;
  engineCount: number;
  objectiveCount: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [lessons, labs] = await Promise.all([
    loadLessons("content"),
    listLabs("labs"),
  ]);

  const engines = new Set(labs.map((l) => l.type));
  const totalObjectives = labs.reduce((acc, l) => acc + (l.objectives?.length || 0), 0);

  return {
    lessonCount: lessons.length,
    labCount: labs.length,
    engineCount: engines.size,
    objectiveCount: totalObjectives,
  };
}
