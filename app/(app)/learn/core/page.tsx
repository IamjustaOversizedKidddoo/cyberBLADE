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
import { nextMission } from "@/lib/progress/next-mission";
import type { LessonProgress } from "@/lib/progress/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RankBadge } from "@/components/ui/Badge";
import { IconCheck, IconLock, IconPlay, IconClock, IconTerminal } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Curriculum Roadmap · CyberBLADE" };

const CHALLENGE_TEXT = {
  locked: "Finish every lesson above to unlock the timed challenge.",
  ready: "Unlocked. A timed, practical test on a machine generated just for you.",
  active: "Your challenge is running.",
  cooldown: "Cooling down after your last attempt. Review the lessons, then try again.",
  passed: "Passed.",
} as const;

function LessonList({ lessons, progress, open }: { lessons: Lesson[]; progress: LessonProgress[]; open: boolean }) {
  const statusOf = (id: string) => progress.find((p) => p.lessonId === id)?.status ?? "not_started";
  if (lessons.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-line p-6 text-center text-xs text-muted">
        No lessons are published here yet. Check back soon.
      </div>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Curriculum lessons">
      {lessons.map((l) => {
        const status = statusOf(l.id);
        const isCompleted = status === "completed";

        const content = (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              {/* Order number or check status */}
              <div
                className={`h-8 w-8 rounded-xs flex items-center justify-center font-mono text-xs font-bold shrink-0 border ${
                  !open
                    ? "border-line/40 bg-surface-subtle text-muted/40"
                    : isCompleted
                    ? "border-success/40 bg-success/15 text-success"
                    : status === "in_progress"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                    : "border-cyan/40 bg-cyan/10 text-cyan"
                }`}
              >
                {!open ? (
                  <IconLock className="h-3.5 w-3.5" />
                ) : isCompleted ? (
                  <IconCheck className="h-4 w-4" />
                ) : (
                  String(l.order).padStart(2, "0")
                )}
              </div>

              {/* Title & metadata */}
              <div className="min-w-0">
                <span
                  className={`font-sans text-sm sm:text-base font-medium truncate block ${
                    open ? "text-ink group-hover:text-cyan transition-colors" : "text-muted/60"
                  }`}
                >
                  {l.title}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-2.5 font-ui text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <IconClock className="h-3 w-3" />
                    <span>{l.estimated_minutes} min</span>
                  </span>
                  <span>·</span>
                  <span className="font-mono text-cyan">{l.xp} XP</span>
                  {l.lab && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 rounded-xs border border-purple/40 bg-purple/10 px-1.5 py-0.2 text-[10px] text-purple">
                        <IconTerminal className="h-2.5 w-2.5" />
                        <span>LAB ENGINE</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status indicator on desktop */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {open && (
                <span
                  className={`rounded-xs border px-2 py-0.5 font-ui text-[11px] tracking-wider font-semibold ${
                    isCompleted
                      ? "border-success/40 bg-success/10 text-success"
                      : status === "in_progress"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {isCompleted ? "✓ Completed" : status === "in_progress" ? "In Progress" : "Available"}
                </span>
              )}
            </div>
          </div>
        );

        return (
          <li key={l.id}>
            {open ? (
              <Link
                href={`/learn/${l.id}`}
                className={`group block min-h-[44px] rounded-sm border p-4 sm:px-5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
                  isCompleted
                    ? "border-success/30 bg-surface hover:border-success/60 hover:bg-surface-raised"
                    : status === "in_progress"
                    ? "border-amber-500/40 bg-surface-raised hover:border-amber-500/70"
                    : "border-line bg-surface hover:border-cyan/50 hover:bg-surface-hover"
                }`}
              >
                {content}
              </Link>
            ) : (
              <div className="block rounded-sm border border-line/40 bg-surface-subtle/40 p-4 sm:px-5 opacity-60">
                {content}
              </div>
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
    <section
      aria-labelledby={`challenge-${rank}`}
      className={`mt-8 rounded-sm border p-6 transition-all ${
        kind === "passed"
          ? "border-success/40 bg-success/5"
          : kind === "active"
          ? "border-cyan bg-cyan/5 shadow-[0_0_20px_rgba(15,190,255,0.15)]"
          : kind === "ready"
          ? "border-cyan/50 bg-surface-raised"
          : "border-line/60 bg-surface-subtle opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 id={`challenge-${rank}`} className="font-ui text-base font-bold text-ink uppercase tracking-wider">
          RANK_{rank} CAPSTONE EVALUATION
        </h3>
        <span
          className={`rounded-xs border px-2 py-0.5 font-ui text-[11px] font-semibold uppercase tracking-wider ${
            kind === "passed"
              ? "border-success/50 bg-success/15 text-success"
              : kind === "active"
              ? "border-cyan/50 bg-cyan/15 text-cyan animate-pulse"
              : kind === "ready"
              ? "border-cyan/50 text-cyan bg-cyan/10"
              : "border-line text-muted"
          }`}
        >
          {kind.toUpperCase()}
        </span>
      </div>

      <p className="mb-5 font-sans text-xs text-muted leading-relaxed max-w-xl">
        {kind === "passed"
          ? `Passed — Rank ${rank + 1} · ${rankName(rank + 1)} unlocked.`
          : CHALLENGE_TEXT[kind]}
      </p>

      {kind !== "locked" && (
        <Link
          href={`/challenge/${rank}`}
          aria-label={kind === "active" ? "Return to the challenge" : "Open the challenge"}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xs border-2 border-cyan bg-cyan/10 px-5 py-2 font-ui text-xs font-bold tracking-wider text-cyan transition-all hover:bg-cyan hover:text-void shadow-[0_0_12px_rgba(15,190,255,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          <IconPlay className="h-3 w-3" />
          <span>{kind === "active" ? "Return to the challenge" : "Open the challenge"}</span>
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
  const [progress, xp] = await Promise.all([
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
  ]);

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
  const done = current.lessons.filter((l) =>
    progress.some((p) => p.lessonId === l.id && p.status === "completed"),
  ).length;

  const next = nextMission(operator.rank, current.lessons, progress);

  return (
    <main className="min-h-screen bg-canvas text-ink pb-20">
      <HeroBand
        title={`rank_${current.rank}`}
        kicker={`> ${current.name} · ${done}/${current.lessons.length} lessons · ${xp} XP`}
      />

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-10 sm:px-6">
        {lockedRank !== null && (
          <div role="status" className="rounded-sm border border-danger/40 bg-danger/10 px-4 py-3 text-xs font-ui text-danger">
            {lockedNotice(lockedRank)}
          </div>
        )}

        {/* ── PROMINENT CONTINUE WHERE YOU LEFT OFF BANNER ──────────────────── */}
        {next.kind === "lesson" && (
          <div className="rounded-sm border border-cyan/40 bg-gradient-to-r from-cyan/10 via-surface to-surface p-5 sm:p-6 shadow-[0_4px_25px_rgba(15,190,255,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs tracking-widest text-cyan uppercase font-semibold">
                  {next.resume ? "RESUME WHERE YOU LEFT OFF" : "NEXT RECOMMENDED MISSION"}
                </span>
                <h3 className="mt-1 font-display text-xl text-ink">
                  {String(next.lesson.order).padStart(2, "0")}: {next.lesson.title}
                </h3>
                <p className="mt-1 font-ui text-xs text-muted">
                  {next.lesson.estimated_minutes} min estimated · {next.lesson.xp} XP
                </p>
              </div>
              <Link
                href={`/learn/${next.lesson.id}`}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xs bg-cyan px-5 py-2.5 font-ui text-xs font-bold tracking-wider text-void shadow-[0_0_15px_rgba(15,190,255,0.4)] transition-all hover:bg-cyan/90 hover:shadow-[0_0_20px_rgba(15,190,255,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan active:translate-y-px"
              >
                <IconPlay className="h-3.5 w-3.5" />
                <span>{next.resume ? "RESUME LESSON →" : "START LESSON →"}</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── RANK ROADMAP SECTIONS ─────────────────────────────────────────── */}
        {ranks.map((r) => {
          const rankDone = r.lessons.filter((l) =>
            progress.some((p) => p.lessonId === l.id && p.status === "completed"),
          ).length;
          const rankPct = r.lessons.length > 0 ? Math.round((rankDone / r.lessons.length) * 100) : 0;

          return (
            <section
              key={r.rank}
              id={`rank-${r.rank}`}
              aria-labelledby={`rank-heading-${r.rank}`}
              className="rounded-sm border border-line bg-surface p-4 sm:p-8"
            >
              {/* Header with rank badge and progress */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-5">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <RankBadge rank={r.rank} />
                  <h2
                    id={`rank-heading-${r.rank}`}
                    className={`font-display text-xl sm:text-3xl ${r.open ? "text-ink" : "text-muted"}`}
                  >
                    rank_{r.rank} · {r.name}
                  </h2>
                </div>
                {r.open ? (
                  <div className="w-40 sm:w-48">
                    <ProgressBar
                      value={rankPct}
                      variant={r.rank === 0 ? "cyan" : r.rank === 1 ? "cyan" : "purple"}
                      size="sm"
                      label={`${rankDone}/${r.lessons.length} complete`}
                      showLabel
                    />
                  </div>
                ) : (
                  <span className="font-ui text-xs text-muted/60 flex items-center gap-1.5 border border-line/40 px-2.5 py-1 rounded-xs">
                    <IconLock className="h-3.5 w-3.5" />
                    <span>LOCKED</span>
                  </span>
                )}
              </div>

              {/* Lesson list */}
              <LessonList lessons={r.lessons} progress={progress} open={r.open} />

              {/* Capstone Challenge Card */}
              {r.open && r.summary && <ChallengeCard rank={r.rank} summary={r.summary} />}
            </section>
          );
        })}
      </div>
    </main>
  );
}
