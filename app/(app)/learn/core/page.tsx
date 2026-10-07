import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getRankSummary } from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";

export const metadata: Metadata = { title: "Shared core" };

const CHALLENGE_TEXT = {
  locked: "Finish every lesson above to unlock the timed Rank 0 challenge.",
  ready: "Unlocked. A timed, practical test on a machine generated just for you.",
  active: "Your challenge is running.",
  cooldown: "Cooling down after your last attempt. Review the lessons, then try again.",
  passed: "Passed — Rank 1 · Operator unlocked.",
} as const;

const LABEL = { not_started: "Not started", in_progress: "In progress", completed: "✓ Completed" } as const;

export default async function CoreMapPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const [lessons, progress, xp] = await Promise.all([
    getLessons({ track: "core", rank: 0 }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
  ]);
  const summary = await getRankSummary(ctx, operator.id, 0);
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
        <section aria-labelledby="challenge-heading" className="mt-12 border border-line p-6">
          <h2 id="challenge-heading" className="mb-2 text-3xl">
            rank_challenge
          </h2>
          <p className="mb-4 text-muted">
            {CHALLENGE_TEXT[summary.challenge.kind]}
          </p>
          {summary.challenge.kind !== "locked" && (
            <Link href="/challenge/0" className="border border-cyan px-5 py-2 font-ui text-cyan hover:bg-cyan hover:text-void">
              {summary.challenge.kind === "active" ? "Return to the challenge" : "Open the challenge"}
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
