import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChallengeTimer } from "@/components/challenge/ChallengeTimer";
import { HandlerDrawer } from "@/components/handler/HandlerDrawer";
import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { proseComponents } from "@/components/lesson/prose";
import { HalftoneField } from "@/components/art/HalftoneField";
import { PosterSection } from "@/components/art/PosterSection";
import { PosterHeading } from "@/components/art/PosterHeading";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { SystemLabel } from "@/components/art/SystemLabel";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { renderMdx } from "@/lib/content/mdx";
import { requireOperator } from "@/lib/identity/session";
import {
  findChallengeLab,
  getChallengeSession,
  getRankSummary,
} from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";
import { rankName } from "@/lib/progress/ranks";
import {
  abandonChallengeAction,
  startChallengeAction,
  submitChallengeObjectiveAction,
} from "../actions";

export const metadata: Metadata = { title: "Rank challenge" };

// ─── styled button variants ────────────────────────────────────────────────────
const BTN_START =
  "btn-glitch border-2 border-cyan px-8 py-3 font-ui text-lg text-cyan hover:bg-cyan hover:text-void";
const BTN_DANGER =
  "border border-pink px-5 py-2 font-ui text-sm text-pink hover:bg-pink hover:text-void transition-colors";
const BTN_GHOST =
  "border border-line px-5 py-2 font-ui text-sm text-muted hover:border-cyan hover:text-cyan transition-colors";

export default async function ChallengePage(props: PageProps<"/challenge/[rank]">) {
  const { rank: raw } = await props.params;
  if (!/^[0-2]$/.test(raw)) notFound();
  const rank = Number(raw);

  const operator = await requireOperator();
  const ctx = getCtx();
  let lab;
  try {
    lab = await findChallengeLab(ctx, rank);
  } catch {
    notFound();
  }
  const summary = await getRankSummary(ctx, operator.id, rank);
  const state = summary.challenge;
  const next = rankName(rank + 1);

  // ─── STATE: PASSED ──────────────────────────────────────────────────────────
  if (state.kind === "passed") {
    return (
      <main>
        {/* Full-bleed ACCESS GRANTED hero */}
        <PosterSection
          tone="void"
          labelledBy="rankup-heading"
          backdrop={
            <>
              <HalftoneField tone="cyan" density={7} fade="radial" className="opacity-20" />
              <NoiseLayer kind="crt" />
            </>
          }
          className="min-h-[100dvh] flex items-center"
        >
          <div className="col-span-full mx-auto w-full max-w-5xl py-20">
            {/* Blinking status indicator */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 scale-150 rounded-full bg-cyan/20 animate-ping"
                />
                <div className="relative h-3 w-3 rounded-full bg-cyan" />
              </div>
              <SystemLabel className="text-cyan">
                RANK CHALLENGE COMPLETE // OBJECTIVE CLEARED
              </SystemLabel>
            </div>

            {/* Giant rank unlock heading */}
            <PosterHeading
              id="rankup-heading"
              as="h1"
              lines={[`rank_${rank + 1}_unlocked`]}
              size="wordmark"
              cursor
              className="text-cyan"
            />

            <div className="mt-10 grid gap-px bg-line sm:grid-cols-3">
              {/* New rank cell */}
              <div className="bg-void px-6 py-6">
                <SystemLabel className="text-muted block mb-2">NEW CLEARANCE</SystemLabel>
                <p className="font-display text-5xl text-cyan leading-none">
                  RANK_{rank + 1}
                </p>
              </div>
              {/* Title cell */}
              <div className="bg-void px-6 py-6">
                <SystemLabel className="text-muted block mb-2">DESIGNATION</SystemLabel>
                <p className="font-display text-3xl text-ink leading-none uppercase">{next}</p>
              </div>
              {/* Status cell */}
              <div className="bg-void px-6 py-6 flex flex-col justify-between">
                <SystemLabel className="text-muted block mb-2">STATUS</SystemLabel>
                <p className="font-ui text-xs tracking-widest text-cyan">
                  NEW MISSIONS AVAILABLE
                </p>
                <Link href="/dashboard" className={`${BTN_START} mt-4 inline-block`}>
                  RETURN TO BASE →
                </Link>
              </div>
            </div>

            <p className="mt-10 max-w-[52ch] text-muted">
              Rank {rank + 1} · {next} unlocked. You proved you can work the machine on your
              own. New missions are available.
            </p>
          </div>
        </PosterSection>
      </main>
    );
  }

  // ─── STATE: ACTIVE ──────────────────────────────────────────────────────────
  if (state.kind === "active") {
    const session = await getChallengeSession(ctx, operator.id, rank);
    if (!session) notFound();
    const briefing = await renderMdx(session.briefingText, proseComponents, "md");
    return (
      <main>
        {/* Live HUD header */}
        <div className="sticky top-0 z-30 border-b border-line bg-void/90 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2 sm:px-6">
            {/* Left: mission id */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 scale-150 rounded-full bg-pink/30 animate-ping"
                />
                <div className="relative h-2.5 w-2.5 rounded-full bg-pink" />
              </div>
              <SystemLabel className="text-pink">MISSION LIVE</SystemLabel>
            </div>
            {/* Centre: lab title */}
            <SystemLabel className="text-ink text-center hidden sm:block truncate max-w-xs">
              {session.labTitle.toUpperCase()}
            </SystemLabel>
            {/* Right: countdown */}
            <div className="flex justify-end">
              <ChallengeTimer expiresAt={session.expiresAt} />
            </div>
          </div>
          {/* Pink scan line indicator */}
          <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-pink/60 to-transparent" />
        </div>

        {/* Briefing + workspace */}
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
          {/* Briefing card */}
          <section aria-labelledby="briefing-heading" className="border-2 border-pink">
            <div className="flex items-center gap-0 border-b border-pink">
              <span className="border-r border-pink px-4 py-2 font-ui text-xs tracking-widest text-pink">
                BRIEFING
              </span>
              <span className="px-4 py-2 font-ui text-xs tracking-widest text-muted">
                rank_{rank}_challenge // LIVE MACHINE
              </span>
            </div>
            <div className="px-6 py-6 max-w-[72ch] prose-cyberblade">
              <h2 id="briefing-heading" className="sr-only">
                Mission Briefing
              </h2>
              {briefing}
            </div>
          </section>

          {/* Lab workspace */}
          <LabWorkspace
            env={session.env}
            objectives={session.objectives}
            onSubmit={submitChallengeObjectiveAction.bind(null, session.attemptId)}
            doneMessage={`Rank ${rank + 1} · ${next} unlocked`}
          />

          {/* Abandon */}
          <div className="border-t border-line pt-6">
            <form action={abandonChallengeAction.bind(null, session.attemptId, rank)}>
              <button type="submit" className={BTN_DANGER}>
                ABORT MISSION — START COOLDOWN
              </button>
            </form>
          </div>
        </div>
        <HandlerDrawer
          context={{
            kind: "lab",
            isChallenge: true,
            labTitle: session.labTitle,
          }}
          operatorHandle={operator.handle}
        />
      </main>
    );
  }

  // ─── STATE: LOBBY (locked / ready / cooldown) ───────────────────────────────
  return (
    <main>
      {/* Mission briefing hero */}
      <PosterSection
        tone="void"
        labelledBy="challenge-heading"
        backdrop={
          <>
            <HalftoneField tone="cyan" density={9} fade="right" className="opacity-10" />
            <NoiseLayer kind="crt" />
          </>
        }
        className="border-b border-line py-14 sm:py-20"
      >
        <div className="col-span-full mx-auto w-full max-w-5xl">
          <SystemLabel className="text-cyan">
            RANK CHALLENGE // {rankName(rank).toUpperCase()} → {next.toUpperCase()}
          </SystemLabel>
          <PosterHeading
            id="challenge-heading"
            as="h1"
            lines={[`RANK_${rank}`, "CHALLENGE_"]}
            size="section"
            className="mt-3"
          />
        </div>
      </PosterSection>

      {/* Rules + action area */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-px bg-line sm:grid-cols-[1fr_auto]">

          {/* Rules panel */}
          <div className="bg-void">
            <TerminalPanel title="mission_parameters">
              <ul className="space-y-3 text-muted">
                <li className="flex gap-3">
                  <span className="font-ui text-cyan">01</span>
                  <span>
                    <strong className="text-ink">{summary.timeLimitMinutes} minutes</strong>, starting the moment you
                    press START. The clock is enforced on the server.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-ui text-cyan">02</span>
                  <span>
                    Your machine is seeded uniquely — answers differ from every other operator&apos;s.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-ui text-cyan">03</span>
                  <span>
                    If time runs out or you abort, retry after a{" "}
                    <strong className="text-ink">{lab.challenge!.cooldown_minutes}-minute cooldown</strong> with a
                    freshly seeded machine.
                  </span>
                </li>
              </ul>
            </TerminalPanel>
          </div>

          {/* Status + action cell */}
          <div className="bg-void px-6 py-6 min-w-[280px] flex flex-col justify-between">
            {/* Status badge */}
            <div>
              <SystemLabel className="text-muted block mb-3">MISSION STATUS</SystemLabel>
              {state.kind === "locked" && (
                <div className="border-2 border-line px-4 py-3">
                  <p className="font-ui text-xs tracking-widest text-muted/60 mb-4">
                    ▒ LOCKED — COMPLETE ALL RANK_{rank} LESSONS
                  </p>
                  <ul className="space-y-2">
                    {summary.lessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-2">
                        <span
                          className={`font-ui text-xs ${
                            l.status === "completed" ? "text-cyan" : "text-muted/40"
                          }`}
                        >
                          {l.status === "completed" ? "✓" : "○"}
                        </span>
                        <Link
                          href={`/learn/${l.id}`}
                          className="text-sm text-muted hover:text-cyan transition-colors"
                        >
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {state.kind === "cooldown" && (
                <div className="border-2 border-pink px-4 py-4">
                  <SystemLabel className="text-pink block mb-2">COOLDOWN ACTIVE</SystemLabel>
                  <p className="text-muted">
                    Retry available after{" "}
                    <time dateTime={state.retryAt} className="text-ink">
                      {new Date(state.retryAt).toUTCString().slice(17, 22)} UTC
                    </time>
                    . Use the time to review your weak lessons.
                  </p>
                </div>
              )}
              {state.kind === "ready" && (
                <div className="border-2 border-cyan px-4 py-4 mb-6">
                  <SystemLabel className="text-cyan block mb-1">READY TO DEPLOY</SystemLabel>
                  <p className="text-muted text-sm">
                    Machine will be generated when you start. The clock begins immediately.
                  </p>
                </div>
              )}
            </div>

            {/* CTA */}
            {state.kind === "ready" && (
              <form action={startChallengeAction.bind(null, rank)} className="mt-2">
                <button type="submit" aria-label="Start the challenge" className={BTN_START}>
                  DEPLOY MISSION →
                </button>
              </form>
            )}
            {state.kind !== "ready" && (
              <Link href="/learn/core" className={`${BTN_GHOST} inline-block mt-4`}>
                ← BACK TO MISSIONS
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
