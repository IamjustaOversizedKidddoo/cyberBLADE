import type { Metadata } from "next";
import Link from "next/link";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { PosterSection } from "@/components/art/PosterSection";
import { PosterHeading } from "@/components/art/PosterHeading";
import { SystemLabel } from "@/components/art/SystemLabel";
import { CourseMap } from "@/components/dashboard/CourseMap";
import { HalftoneField } from "@/components/art/HalftoneField";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";
import { nextMission } from "@/lib/progress/next-mission";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const [lessons, progress, xp] = await Promise.all([
    getLessons({ track: "core", rank: operator.rank }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.getXpTotal(operator.id),
  ]);
  const done = lessons.filter((l) =>
    progress.some((p) => p.lessonId === l.id && p.status === "completed")
  ).length;
  const pct = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;
  const next = nextMission(operator.rank, lessons, progress);

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

      {/* ── COURSE MAP ─────────────────────────────────────────────────────── */}
      <div className="relative bg-void">
        {/* Subtle halftone background */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <HalftoneField tone="cyan" density={4} fade="radial" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <CourseMap currentRank={operator.rank} xp={xp} rankProgress={{ done, total: lessons.length }} />
        </div>
      </div>
    </main>
  );
}
