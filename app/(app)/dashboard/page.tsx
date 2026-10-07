import type { Metadata } from "next";
import { CourseMap } from "@/components/dashboard/CourseMap";
import { HeroBand } from "@/components/theme/HeroBand";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const [lessons, progress, xp] = await Promise.all([
    getLessons({ track: "core", rank: operator.rank }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
  ]);
  const done = lessons.filter((l) => progress.some((p) => p.lessonId === l.id && p.status === "completed")).length;
  return (
    <main>
      <HeroBand title={`rank_${operator.rank}`} kicker={`> welcome, ${operator.handle}`}>
        <p>
          Rank {operator.rank} · {rankName(operator.rank)} · {xp} XP
        </p>
      </HeroBand>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <CourseMap currentRank={operator.rank} xp={xp} rankProgress={{ done, total: lessons.length }} />
      </div>
    </main>
  );
}
