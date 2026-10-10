import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Lesson } from "@/lib/content/schema";
import { coverageSchema, type Coverage } from "@/lib/content/validate";
import type { CertReadiness, GradingBand, ObjectiveReadiness } from "./types";

export function scoreToBand(scorePercent: number): GradingBand {
  if (scorePercent >= 95) return "Exam Ready";
  if (scorePercent >= 85) return "Strong";
  if (scorePercent >= 70) return "Good";
  if (scorePercent >= 50) return "Needs review";
  return "Weak";
}

let cachedCoverage: Promise<Coverage> | null = null;

export async function loadCoverageMatrix(root = "content/coverage/core.yaml"): Promise<Coverage> {
  const filePath = path.isAbsolute(root)
    ? root
    : path.join(process.cwd(), "content", "coverage", path.basename(root));
  const text = await fs.readFile(filePath, "utf8");
  return coverageSchema.parse(parseYaml(text));
}

export function getCoverageMatrix(): Promise<Coverage> {
  cachedCoverage ??= loadCoverageMatrix();
  return cachedCoverage;
}

export function calculateReadinessSync(input: {
  coverage: Coverage;
  completedLessonIds: Set<string>;
  lessons: Lesson[];
}): CertReadiness[] {
  const { coverage, completedLessonIds, lessons } = input;

  // Build a lookup: objectiveId -> lesson covering it (if any completed)
  const coveredBy = new Map<string, Lesson>();
  for (const lesson of lessons) {
    if (completedLessonIds.has(lesson.id)) {
      for (const objId of lesson.objectives_covered) {
        coveredBy.set(objId, lesson);
      }
    }
  }

  const results: CertReadiness[] = [];

  for (const [certId, certInfo] of Object.entries(coverage.certs)) {
    const certObjectives = coverage.objectives.filter((o) => o.id.startsWith(`${certId}:`));
    const totalObjectives = certObjectives.length;

    let completedCount = 0;
    const objectiveDetails: ObjectiveReadiness[] = certObjectives.map((o) => {
      const coveringLesson = coveredBy.get(o.id);
      const isCovered = coveringLesson !== undefined;
      if (isCovered) completedCount++;

      return {
        id: o.id,
        summary: o.summary,
        targetRank: o.target_rank,
        covered: isCovered,
        lessonId: coveringLesson?.id,
        lessonTitle: coveringLesson?.title,
      };
    });

    const scorePercent = totalObjectives > 0 ? Math.round((completedCount / totalObjectives) * 100) : 0;
    const band = scoreToBand(scorePercent);

    results.push({
      certId,
      name: certInfo.name,
      examCode: certInfo.exam,
      scorePercent,
      band,
      completedObjectives: completedCount,
      totalObjectives,
      objectives: objectiveDetails,
    });
  }

  return results;
}

export async function calculateCertReadiness(input: {
  completedLessonIds: Set<string>;
  lessons: Lesson[];
  customCoverage?: Coverage;
}): Promise<CertReadiness[]> {
  const coverage = input.customCoverage ?? (await getCoverageMatrix());
  return calculateReadinessSync({
    coverage,
    completedLessonIds: input.completedLessonIds,
    lessons: input.lessons,
  });
}
