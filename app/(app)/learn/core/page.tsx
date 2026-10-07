import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { getLessons } from "@/lib/content/lessons";
import type { Lesson } from "@/lib/content/schema";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank, lockedNotice } from "@/lib/progress/access";
import { findChallengeLab, getRankSummary, type RankSummary } from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";
import { RANKS, rankName } from "@/lib/progress/ranks";
import type { LessonProgress } from "@/lib/progress/types";

export const metadata: Metadata = { title: "Shared core" };

const CHALLENGE_TEXT = {
  locked: "Finish every lesson above to unlock the timed challenge.",
  ready: "Unlocked. A timed, practical test on a machine generated just for you.",
  active: "Your challenge is running.",
  cooldown: "Cooling down after your last attempt. Review the lessons, then try again.",
  passed: "Passed.",
} as const;

const LABEL = { not_started: "Not started", in_progress: "In progress", completed: "✓ Completed" } as const;

function LessonList({ lessons, progress, open }: { lessons: Lesson[]; progress: LessonProgress[]; open: boolean }) {
  const statusOf = (id: string) => progress.find((p) => p.lessonId === id)?.status ?? "not_started";
  if (lessons.length === 0) return <p className="text-muted">No lessons are published here yet. Check back soon.</p>;
  return (
    <ol className="space-y-3">
      {lessons.map((l) => {
        const status = statusOf(l.id);
        const body = (
          <>
            <span className="font-ui text-muted">{String(l.order).padStart(2, "0")} </span>
            <span className={`text-lg ${open ? "text-ink" : "text-muted"}`}>{l.title}</span>
            <span className={`mt-1 block text-sm ${status === "completed" ? "text-purple" : "text-muted"}`}>
              {open ? `${LABEL[status]} · ` : "🔒︎ "}
              {l.estimated_minutes} min · {l.xp} XP{l.lab ? " · lab" : ""}
            </span>
          </>
        );
        return (
          <li key={l.id}>
            {open ? (
              <Link
                href={`/learn/${l.id}`}
                className={`block border p-4 hover:border-cyan ${status === "completed" ? "border-purple" : "border-line"}`}
              >
                {body}
              </Link>
            ) : (
              <div className="block border border-line/50 p-4 opacity-60">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ChallengeCard({ rank, summary }: { rank: number; summary: RankSummary }) {
  const kind = summary.challenge.kind;
  return (
    <section aria-labelledby={`challenge-${rank}`} className="mt-8 border border-line p-6">
      <h3 id={`challenge-${rank}`} className="mb-2 text-2xl">
        rank_{rank}_challenge
      </h3>
      <p className="mb-4 text-muted">
        {kind === "passed" ? `Passed — Rank ${rank + 1} · ${rankName(rank + 1)} unlocked.` : CHALLENGE_TEXT[kind]}
      </p>
      {kind !== "locked" && (
        <Link href={`/challenge/${rank}`} className="border border-cyan px-5 py-2 font-ui text-cyan hover:bg-cyan hover:text-void">
          {kind === "active" ? "Return to the challenge" : "Open the challenge"}
        </Link>
      )}
    </section>
  );
}

export default async function CoreMapPage(props: PageProps<"/learn/core">) {
  const { locked } = await props.searchParams;
  const lockedRank = typeof locked === "string" && /^[1-5]$/.test(locked) ? Number(locked) : null;
  const operator = await requireOperator();
  const ctx = getCtx();
  const [progress, xp] = await Promise.all([ctx.repo.listLessonProgress(operator.id), ctx.repo.getXpTotal(operator.id)]);

  const ranks = await Promise.all(
    RANKS.map(async ({ rank, name }) => {
      const lessons = await getLessons({ track: "core", rank });
      const hasChallenge = await findChallengeLab(ctx, rank).then(
        () => true,
        () => false,
      );
      const summary = hasChallenge ? await getRankSummary(ctx, operator.id, rank) : null;
      return { rank, name, lessons, summary, open: canAccessRank(operator.rank, rank) };
    }),
  );
  const current = ranks.find((r) => r.rank === operator.rank) ?? ranks[0];
  const done = current.lessons.filter((l) => progress.some((p) => p.lessonId === l.id && p.status === "completed")).length;

  return (
    <main>
      <HeroBand title={`rank_${current.rank}`} kicker={`> ${current.name} · ${done}/${current.lessons.length} lessons · ${xp} XP`} />
      <div className="mx-auto max-w-3xl space-y-16 px-4 py-12">
        {lockedRank !== null && (
          <p role="status" className="border border-pink px-4 py-3 text-pink">
            {lockedNotice(lockedRank)}
          </p>
        )}
        {ranks.map((r) => (
          <section key={r.rank} id={`rank-${r.rank}`} aria-labelledby={`rank-heading-${r.rank}`}>
            <h2 id={`rank-heading-${r.rank}`} className={`mb-6 text-4xl ${r.open ? "" : "text-muted"}`}>
              rank_{r.rank} · {r.name}
              {!r.open && <span className="ml-3 align-middle font-ui text-base">🔒︎ Locked</span>}
            </h2>
            <LessonList lessons={r.lessons} progress={progress} open={r.open} />
            {r.open && r.summary && <ChallengeCard rank={r.rank} summary={r.summary} />}
          </section>
        ))}
      </div>
    </main>
  );
}
