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
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconPlay, IconSparkles } from "@/components/ui/icons";
import { FirstRunTour } from "@/components/dashboard/FirstRunTour";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";
import { nextMission } from "@/lib/progress/next-mission";
import { calculateCertReadiness } from "@/lib/readiness/calculator";
import { calculateStreak } from "@/lib/gamification/streaks";
import { evaluateBadges } from "@/lib/gamification/badges";

export const metadata: Metadata = { title: "Dashboard · CyberBLADE" };

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

  const isBrandNew = completedLessons.length === 0 && operator.rank === 0;

  return (
    <main className="min-h-screen bg-canvas text-ink overflow-x-clip">
      {/* ── OPERATOR DOSSIER HERO ─────────────────────────────────────────── */}
      <PosterSection
        tone="void"
        labelledBy="dashboard-heading"
        backdrop={<NoiseLayer kind="photocopy" />}
        className="neon-hero border-b border-line py-8 sm:py-12 bg-void"
      >
        <div className="col-span-full mx-auto w-full max-w-7xl">
          <div className="rounded-sm border border-line bg-surface/90 p-4 sm:p-8 backdrop-blur-sm grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] items-center">
            {/* Left: rank + handle */}
            <div>
              <p className="sr-only">{`> welcome, ${operator.handle}`}</p>
              <div className="flex flex-wrap items-center gap-3">
                <SystemLabel>OPERATOR DOSSIER // {operator.handle.toUpperCase()}</SystemLabel>
                <span className="border border-line/60 bg-surface-raised px-2.5 py-0.5 font-ui text-xs tracking-widest text-cyan font-semibold rounded-xs">
                  {`Rank ${operator.rank} · ${rankName(operator.rank)}`}
                </span>
              </div>
              <PosterHeading
                id="dashboard-heading"
                as="h1"
                lines={[`RANK_${operator.rank}`]}
                size="section"
                className="mt-3 text-ink"
              />
              <p className="mt-2 font-ui text-sm tracking-widest text-muted">
                {`Rank ${operator.rank} · ${rankName(operator.rank)} · `}
                <span className="font-mono text-cyan font-semibold">{xp} XP</span>
              </p>
            </div>

            {/* Right: mission progress readout */}
            <div className="flex flex-col justify-end min-w-0 sm:min-w-[220px]">
              <div className="rounded-xs border border-line bg-surface-subtle p-4 sm:p-5">
                <SystemLabel className="text-muted mb-2.5 block">CURRICULUM PROGRESS</SystemLabel>
                <ProgressBar
                  value={pct}
                  variant="cyan"
                  size="md"
                  aria-label={`${done} of ${lessons.length} lessons completed`}
                />
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-ink leading-none">
                    {String(done).padStart(2, "0")}/{String(lessons.length).padStart(2, "0")}
                  </span>
                  <span className="font-ui text-[11px] text-muted tracking-wider">
                    LESSONS · R{operator.rank}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PosterSection>

      {/* ── FIRST RUN TOUR & HOW THIS WORKS ─────────────────────────────────── */}
      <FirstRunTour />

      {/* ── NEXT MISSION BRIEFING STRIP ──────────────────────────────────────── */}
      <div className="bg-surface-raised border-b border-line">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-cyan/30 scale-150" />
              <div className="relative h-3 w-3 rounded-full bg-cyan shadow-[0_0_8px_rgba(15,190,255,0.8)]" />
            </div>
            <div>
              <p className="font-ui text-xs tracking-widest text-cyan font-semibold truncate">
                {next.kind === "lesson"
                  ? `NEXT MISSION // ${next.lesson.order.toString().padStart(2, "0")}: ${next.lesson.title.toUpperCase()}`
                  : next.kind === "challenge"
                  ? `NEXT MISSION // RANK_${operator.rank} CHALLENGE DEPLOYED`
                  : "ACTIVE CAMPAIGN // SHARED CORE COMPLETE"}
              </p>
              {isBrandNew && (
                <p className="font-sans text-[11px] text-muted hidden sm:block">
                  Begin your foundational training. First objective: Linux filesystem navigation.
                </p>
              )}
            </div>
          </div>

          {next.kind !== "none" && (
            <Link
              href={next.kind === "lesson" ? `/learn/${next.lesson.id}` : `/challenge/${next.rank}`}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xs bg-cyan px-5 py-2 font-ui text-xs font-bold tracking-wider text-void shadow-[0_0_15px_rgba(15,190,255,0.35)] transition-all hover:bg-cyan/90 hover:shadow-[0_0_20px_rgba(15,190,255,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan active:translate-y-px"
            >
              <IconPlay className="h-3 w-3" />
              <span>
                {next.kind === "lesson"
                  ? (next.resume ? "RESUME MISSION →" : "START MISSION →")
                  : "DEPLOY CHALLENGE →"}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* ── BRAND-NEW OPERATOR ONBOARDING CALLOUT (EMPTY PROGRESS STATE) ──────── */}
      {isBrandNew && (
        <div className="border-b border-line bg-surface/40">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="rounded-sm border border-cyan/40 bg-cyan/5 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full border border-cyan/40 bg-cyan/15 flex items-center justify-center text-cyan shrink-0">
                  <IconSparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-ui text-xs font-bold tracking-wider text-cyan uppercase">
                    WELCOME TO THE BLADE RANGE
                  </h3>
                  <p className="font-sans text-xs text-muted mt-0.5 max-w-2xl">
                    You are cleared for Rank 0 Initiate training. No previous experience required.
                    Work through lessons, solve interactive terminal tasks, and earn your first clearance badges.
                  </p>
                </div>
              </div>
              <Link
                href={next.kind === "lesson" ? `/learn/${next.lesson.id}` : "/learn/core"}
                className="font-ui text-xs font-semibold text-cyan hover:underline flex items-center gap-1"
              >
                <span>OPEN FIRST LESSON</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── OPERATIONAL TELEMETRY & STREAK ───────────────────────────────────── */}
      <div className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <StreakWidget streak={streak} />
            </div>
            <div className="rounded-sm border border-line bg-surface p-6 md:col-span-2 flex flex-col justify-between">
              <div>
                <SystemLabel className="text-muted mb-2 block">CLEARANCE TELEMETRY</SystemLabel>
                <h3 className="font-display text-2xl text-ink">
                  {operator.rank === 0
                    ? "CORE INITIATION IN PROGRESS"
                    : operator.rank === 1
                    ? "FOUNDATION MASTERY ACTIVE"
                    : "WATCHER SECURITY CORE DEPLOYED"}
                </h3>
                <p className="mt-2.5 font-sans text-sm text-muted leading-relaxed">
                  Total Experience Points: <strong className="font-mono text-cyan">{xp} XP</strong> across{" "}
                  <strong className="font-mono text-ink">{completedLessons.length}</strong> verified orders and{" "}
                  <strong className="font-mono text-purple">{attempts.filter((a) => a.completedAt).length}</strong> solved lab operations.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/60 flex flex-wrap gap-6 font-ui text-xs text-muted">
                <span>ACTIVE STREAK: <strong className="text-cyan font-mono">{streak.currentStreak}d</strong></span>
                <span>LONGEST STREAK: <strong className="text-purple font-mono">{streak.longestStreak}d</strong></span>
                <span>SECURITY CLEARANCE: <strong className="text-success">ACTIVE</strong></span>
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
      <div className="bg-canvas border-b border-line py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <CertReadinessSection readiness={readiness} />
        </div>
      </div>

      {/* ── BADGES & HONORS WALL ───────────────────────────────────────────── */}
      <div className="bg-void py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <BadgesWall badges={badges} />
        </div>
      </div>
    </main>
  );
}
