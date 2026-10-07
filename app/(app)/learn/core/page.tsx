import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";

export const metadata: Metadata = { title: "Shared core" };

const LABEL = { not_started: "Not started", in_progress: "In progress", completed: "✓ Completed" } as const;

export default async function CoreMapPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const [lessons, progress, xp] = await Promise.all([
    getLessons({ track: "core", rank: 0 }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
  ]);
  const statusOf = (id: string) => progress.find((p) => p.lessonId === id)?.status ?? "not_started";
  const done = lessons.filter((l) => statusOf(l.id) === "completed").length;

  return (
    <main>
      <HeroBand title="rank_0" kicker={`> ${rankName(0)} · ${done}/${lessons.length} lessons · ${xp} XP`} />
      <div className="mx-auto max-w-3xl px-4 py-12">
        {lessons.length === 0 ? (
          <p className="text-muted">No lessons are published yet. Check back soon.</p>
        ) : (
          <ol className="space-y-3">
            {lessons.map((l) => {
              const status = statusOf(l.id);
              return (
                <li key={l.id}>
                  <Link
                    href={`/learn/${l.id}`}
                    className={`block border p-4 hover:border-cyan ${status === "completed" ? "border-purple" : "border-line"}`}
                  >
                    <span className="font-ui text-muted">{String(l.order).padStart(2, "0")} </span>
                    <span className="text-lg text-ink">{l.title}</span>
                    <span className={`mt-1 block text-sm ${status === "completed" ? "text-purple" : "text-muted"}`}>
                      {LABEL[status]} · {l.estimated_minutes} min · {l.xp} XP{l.lab ? " · lab" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
