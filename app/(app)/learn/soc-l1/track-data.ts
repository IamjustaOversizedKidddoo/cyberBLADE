import "server-only";

import fs from "node:fs";
import { notFound, redirect } from "next/navigation";
import { parse as parseYaml } from "yaml";
import { getLessons } from "@/lib/content/lessons";
import { groupModules, type TrackModule } from "@/lib/content/soc-curriculum";
import { loadSocCoverage, loadTrackConfig, type SocCoverage, type TrackConfig } from "@/lib/content/soc-track";
import type { Lesson } from "@/lib/content/schema";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank } from "@/lib/progress/access";
import { getCtx } from "@/lib/progress/context";
import type { LessonProgress } from "@/lib/progress/types";

export type SocTrackData = {
  operatorId: string;
  track: TrackConfig;
  modules: TrackModule[];
  lessons: Lesson[];
  progress: LessonProgress[];
  statusOf: (lessonId: string) => LessonProgress["status"] | "not_started";
};

/** Track pages share one gate: the track must be enabled and the operator must have reached its rank. */
export async function loadSocTrack(): Promise<SocTrackData> {
  const operator = await requireOperator();
  const track = loadTrackConfig();
  if (!track.enabled) notFound();
  if (!canAccessRank(operator.rank, track.min_core_rank)) redirect(`/learn/core?locked=${track.min_core_rank}`);
  const [lessons, progress] = await Promise.all([getLessons({ track: "soc" }), getCtx().repo.listLessonProgress(operator.id)]);
  return {
    operatorId: operator.id,
    track,
    modules: groupModules(track, lessons),
    lessons,
    progress,
    statusOf: (id) => progress.find((p) => p.lessonId === id)?.status ?? "not_started",
  };
}

export function skillTitles(): Map<string, string> {
  const doc = parseYaml(fs.readFileSync("content/soc/skills.yaml", "utf8")) as { skills: Array<{ id: string; title: string }> };
  return new Map(doc.skills.map((s) => [s.id, s.title]));
}

export function socCoverage(): SocCoverage {
  return loadSocCoverage();
}
