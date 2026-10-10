import type { Metadata } from "next";
import Link from "next/link";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { PosterSection } from "@/components/art/PosterSection";
import { PosterHeading } from "@/components/art/PosterHeading";
import { SystemLabel } from "@/components/art/SystemLabel";
import { CourseMap } from "@/components/dashboard/CourseMap";
import { CertReadinessSection } from "@/components/dashboard/CertReadinessSection";
import { BadgesWall } from "@/components/dashboard/BadgesWall";
import { StreakWidget } from "@/components/dashboard/StreakWidget";
import { HalftoneField } from "@/components/art/HalftoneField";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";
import { nextMission } from "@/lib/progress/next-mission";
import { calculateCertReadiness } from "@/lib/readiness/calculator";
import { calculateStreak } from "@/lib/gamification/streaks";
import { evaluateBadges } from "@/lib/gamification/badges";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const [lessons, allCoreLessons, progress, xp, xpEvents, attempts] = await Promise.all([
    getLessons({ track: "core", rank: operator.rank }),
    getLessons({ track: "core" }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
    ctx.repo.listXpEvents(operator.id),
    ctx.repo.listAttempts(operator.id),
  ]);

  const completedLessons = progress.filter((p) => p.status === "completed");
  const completedLessonIds = new Set(completedLessons.map((p) => p.lessonId));

  const done = lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const pct = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;
  const next = nextMission(operator.rank, lessons, progress);

  // Compute Cert Readiness
  const readiness = await calculateCertReadiness({
    completedLessonIds,
    lessons: allCoreLessons,
  });

  // Compute Streak & Activity
  const timestamps = [
    ...xpEvents.map((e) => e.createdAt),
    ...completedLessons.filter((p) => p.completedAt).map((p) => p.completedAt!),
    ...attempts.map((a) => a.startedAt),
  ];
  const streak = calculateStreak(timestamps, ctx.now());

  // Compute Badges
  const badges = evaluateBadges({
    operatorRank: operator.rank,
    completedLessons,
    attempts,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  });

  return (
    <main>
      {/* ── OPERATOR DOSSIER HERO ─────────────────────────────────────────── */}
      <PosterSection
        tone="paper"
        labelledBy="dashboard-heading"
        backdrop={<NoiseLayer kind="photocopy" />}
        className="neon-hero border-b-2 border-void py-10 sm:py-16"
      >
        <div className="col-span-full mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 gap-px bg-void/10 sm:grid-cols-[1fr_auto]">
            {/* Left: rank + handle */}
            <div>
              <p className="sr-only">{`> welcome, ${operator.handle}`}</p>
              <div className="flex flex-wrap items-center gap-4">
                <SystemLabel>OPERATOR FILE // {operator.handle.toUpperCase()}</SystemLabel>
                <span className="border border-void/30 px-2 py-0.5 font-ui text-xs tracking-widest text-void/60">
                  {`Rank ${operator.rank} · ${rankName(operator.rank)}`}
                </span>
              </div>
              <PosterHeading
                id="dashboard-heading"
                as="h1"
                lines={[`RANK_${operator.rank}`]}
                size="section"
                className="mt-3"
              />
              <p className="mt-2 font-ui text-sm tracking-widest text-void/60">
                {`Rank ${operator.rank} · ${rankName(operator.rank)} · ${xp} XP`}
              </p>
            </div>

            {/* Right: mission progress readout */}
            <div className="flex flex-col justify-end">
              <div className="border-2 border-void/20 p-4 sm:p-6">
                <SystemLabel className="text-void/60 mb-3 block">MISSION PROGRESS</SystemLabel>
                {/* Progress bar */}
                <div className="relative h-2 w-48 bg-void/10 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-void transition-all duration-700"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${done} of ${lessons.length} lessons completed`}
                  />
                </div>
                <p className="mt-2 font-ui text-2xl font-bold text-void leading-none">
                  {String(done).padStart(2, "0")}/{String(lessons.length).padStart(2, "0")}
                </p>
                <p className="font-ui text-xs text-void/50 tracking-widest mt-0.5">
                  LESSONS · RANK_{operator.rank}
                </p>
              </div>
            </div>
          </div>
        </div>
      </PosterSection>

      {/* ── BRIEFING STRIP ─────────────────────────────────────────────────── */}
      <div className="bg-void border-b border-line">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-cyan/20 scale-150" />
              <div className="relative h-3 w-3 rounded-full bg-cyan" />
            </div>
            <p className="font-ui text-xs tracking-widest text-muted truncate">
              {next.kind === "lesson"
                ? `> NEXT MISSION: ${next.lesson.order.toString().padStart(2, "0")} — ${next.lesson.title.toUpperCase()}`
                : next.kind === "challenge"
                ? `> NEXT MISSION: RANK_${operator.rank} CHALLENGE DEPLOYED`
                : "> ACTIVE CAMPAIGN: SHARED CORE"}
            </p>
          </div>
          {next.kind !== "none" && (
            <Link
              href={next.kind === "lesson" ? `/learn/${next.lesson.id}` : `/challenge/${next.rank}`}
              className="btn-glitch inline-flex min-h-[44px] items-center justify-center border-2 border-cyan px-4 py-2 font-ui text-xs tracking-wider text-cyan hover:bg-cyan hover:text-void"
            >
              {next.kind === "lesson" ? (next.resume ? "RESUME MISSION →" : "START MISSION →") : "DEPLOY CHALLENGE →"}
            </Link>
          )}
        </div>
      </div>

      {/* ── OPERATIONAL TELEMETRY & STREAK ───────────────────────────────────── */}
      <div className="border-b border-line bg-console-deep">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <StreakWidget streak={streak} />
            </div>
            <div className="border border-line bg-console p-5 md:col-span-2 flex flex-col justify-between">
              <div>
                <SystemLabel className="text-muted mb-2 block">CLEARANCE TELEMETRY</SystemLabel>
                <h3 className="font-display text-2xl text-ink">
                  {operator.rank === 0
                    ? "CORE INITIATION IN PROGRESS"
                    : operator.rank === 1
                    ? "FOUNDATION MASTERY ACTIVE"
                    : "WATCHER SECURITY CORE DEPLOYED"}
                </h3>
                <p className="mt-2 font-sans text-sm text-muted">
                  Total Experience Points: <strong className="font-mono text-cyan">{xp} XP</strong> across{" "}
                  <strong className="font-mono text-ink">{completedLessons.length}</strong> verified orders and{" "}
                  <strong className="font-mono text-purple">{attempts.filter((a) => a.completedAt).length}</strong> solved lab operations.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap gap-4 font-ui text-xs text-muted">
                <span>ACTIVE STREAK: <strong className="text-cyan">{streak.currentStreak}d</strong></span>
                <span>LONGEST STREAK: <strong className="text-purple">{streak.longestStreak}d</strong></span>
                <span>STATUS: <strong className="text-ink">AUTHENTICATED</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── COURSE MAP ─────────────────────────────────────────────────────── */}
      <div className="relative bg-void border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <HalftoneField tone="cyan" density={4} fade="radial" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <CourseMap currentRank={operator.rank} xp={xp} rankProgress={{ done, total: lessons.length }} />
        </div>
      </div>

      {/* ── EXAM READINESS SECTION ─────────────────────────────────────────── */}
      <div className="bg-void border-b border-line py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <CertReadinessSection readiness={readiness} />
        </div>
      </div>

      {/* ── BADGES & HONORS WALL ───────────────────────────────────────────── */}
      <div className="bg-console-deep py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <BadgesWall badges={badges} />
        </div>
      </div>
    </main>
  );
}
