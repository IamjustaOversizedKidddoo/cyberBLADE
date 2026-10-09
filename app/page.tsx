import Link from "next/link";
import { Annotation } from "@/components/art/Annotation";
import { DefenceLayers } from "@/components/art/DefenceLayers";
import { DossierCard } from "@/components/art/DossierCard";
import { EditorialIllustration } from "@/components/art/EditorialIllustration";
import { HalftoneField } from "@/components/art/HalftoneField";
import { InkEdge } from "@/components/art/InkEdge";
import { LandingHeader } from "@/components/art/LandingHeader";
import { BladeObject } from "@/components/art/motion/BladeObject";
import { Magnetic } from "@/components/art/motion/Magnetic";
import { ScrollScene } from "@/components/art/motion/ScrollScene";
import { SmoothScroll } from "@/components/art/motion/SmoothScroll";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { PosterHeading } from "@/components/art/PosterHeading";
import { PosterSection } from "@/components/art/PosterSection";
import { SystemLabel } from "@/components/art/SystemLabel";
import { TechnicalDiagram } from "@/components/art/TechnicalDiagram";
import { TriageFunnel } from "@/components/art/TriageFunnel";
import { Scanlines } from "@/components/theme/Scanlines";
import { TypingText } from "@/components/theme/TypingText";
import { ring, turnUpright, zigzagNodes } from "@/lib/art/diagram";
import {
  ANALYZE_DIAGRAM,
  DEFENCE_LAYERS,
  SIGNAL_DIAGRAM,
  SYSTEM_STAGES,
  TRACE_DIAGRAM,
  TRACE_EVIDENCE,
  TRACK_GLYPHS,
  TRIAGE,
  type LaunchTrackId,
} from "@/lib/art/landing";
import { BRAND } from "@/lib/brand";
import { TRACKS } from "@/lib/catalog/tracks";

/** Scene-language helper: start values for the scene engine (lib/art/scene.ts). */
const fx = (vars: Record<string, number | string>) => JSON.stringify(vars);

const START_BUTTON = "btn-glitch inline-block border-2 px-8 py-3 font-ui text-xl";
const PLATE = "bg-void px-2 py-0.5 [box-decoration-break:clone]";
const STAGE ="relative col-span-full grid min-h-[100svh] content-center gap-x-6 gap-y-8 py-16 md:grid-cols-12";
const CAMERA = "contents md:col-span-12 md:grid md:grid-cols-12 md:gap-x-6 md:gap-y-8";
const WALL = ["tilt--1", "tilt-1 md:mt-16", "tilt-1 md:-mt-4", "tilt--2 md:mt-12"];
const STAMP_TONE: Record<LaunchTrackId, "purple" | "cyan" | "pink"> = { purple: "purple", soc: "cyan", pentest: "pink", cloud: "cyan" };

export default function Home() {
  const launch = TRACKS.filter((t) => t.status === "open");

  return (
    <>
      <LandingHeader />
      <main>
        <SmoothScroll />
        <Scanlines />

        {/* 01 BOOT — the camera starts on fragments of the wordmark and pulls back until CYBERBLADE stands whole. */}
        <PosterSection tone="void" sceneId="boot" labelledBy="boot-heading" backdrop={<NoiseLayer kind="crt" />}>
          <ScrollScene pin length={2.6} mobile="play" className={STAGE}>
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[var(--z-ui)] flex flex-wrap justify-between gap-2 opacity-80">
              <SystemLabel tone="cyan">SYS.BOOT 00:00:01</SystemLabel>
              <SystemLabel>NODE: PUBLIC</SystemLabel>
              <SystemLabel className="hidden sm:inline">OPERATOR: UNKNOWN</SystemLabel>
              <SystemLabel tone="cyan">
                {BRAND.name} {"//"} SYSTEM ONLINE
              </SystemLabel>
            </div>

            <div data-from={fx({ scale: 0.3, opacity: 0 })} data-dur="0.6" className="pointer-events-none absolute inset-0">
              <HalftoneField tone="cyan" density={8} fade="radial" className="opacity-25" />
            </div>
            <div data-from={fx({ scale: 1.6, opacity: 0, rotate: -20 })} data-at="0.3" data-dur="0.5" className="pointer-events-none absolute right-[2%] top-1/2 -translate-y-1/2 max-md:hidden">
              <BladeObject className="h-[min(64vh,32rem)] w-[min(64vh,32rem)] text-ink" />
            </div>
            <p className="relative text-lg sm:text-xl md:col-span-12">
              <TypingText text="> INITIALIZING CYBERBLADE" />
            </p>
            <div data-camera={fx({ scale: 6, rotate: -4 })} data-dur="0.7" className="relative md:col-span-12">
              <div data-chars={fx({ y: 40, rotate: -8, stagger: 0.02 })} data-at="0.1" data-dur="0.5">
                <PosterHeading as="h1" id="boot-heading" lines={[BRAND.name]} size="wordmark" split="chars" cursor />
              </div>
            </div>

            <div data-from={fx({ y: 120 })} data-at="0.45" data-dur="0.35" className="relative z-[var(--z-type)] md:col-span-7">
              {/* Plates: the caption stays readable while the macro wordmark passes behind it (frame 00). */}
              <p className="font-ui text-sm leading-relaxed tracking-[0.25em] text-cyan sm:text-base">
                <span data-plate className={PLATE}>
                  {BRAND.fullName.toUpperCase()}
                </span>
              </p>
              <p className="mt-3 text-xl leading-snug sm:text-3xl">
                <span data-plate className={PLATE}>
                  {BRAND.tagline}
                </span>
              </p>
              <div className="mt-8">
                <Magnetic>
                  <Link href="/start" className={`${START_BUTTON} border-ink bg-void text-ink hover:border-cyan hover:bg-cyan hover:text-void`}>
                    Start
                  </Link>
                </Magnetic>
              </div>
            </div>
          </ScrollScene>
        </PosterSection>

        {/* 02 OPERATOR — the poster comes alive: layers of the portrait move at different depths as the camera slides past. */}
        <InkEdge edge="top" tone="paper" className="band-void" />
        <PosterSection tone="paper" sceneId="operator" labelledBy="operator-heading" className="neon-hero" backdrop={<NoiseLayer kind="grain" />}>
          <ScrollScene pin length={2.6} mobile="play" className={STAGE}>
            <div data-camera={fx({ x: "6%", rotateY: -10 })} className={CAMERA}>
              <div className="relative md:col-span-6 md:col-start-1 md:self-center">
                <SystemLabel>SEQ 02/07</SystemLabel>
                <PosterHeading id="operator-heading" lines={["YOU'RE NOT", "WATCHING", "A COURSE_"]} size="section" className="mt-2" />
                <p data-from={fx({ opacity: 0, y: 30 })} data-at="0.45" data-dur="0.25" className="mt-6 max-w-[48ch] text-lg sm:text-xl">
                  You&apos;re the operator. Every rank is a set of missions: learn the idea, prove it, practise it on a simulated machine, then debrief like a
                  professional.
                </p>
              </div>
              <div className="relative mx-auto w-3/4 md:col-span-6 md:col-start-7 md:w-full">
                <div data-from={fx({ x: "-12%", scale: 1.15 })} data-dur="0.9" className="absolute -inset-[8%]">
                  <HalftoneField tone="current" density={7} angle={20} fade="radial" className="opacity-20" />
                </div>
                <div data-from={fx({ x: "14%", rotateY: 18, scale: 1.08 })} data-dur="0.8" className="relative">
                  <EditorialIllustration slot="operator" alt="Ink-and-halftone portrait of an anonymous operator wearing a cyan simulation visor" />
                </div>
                <div data-from={fx({ x: "26%", opacity: 0 })} data-at="0.25" data-dur="0.5" className="absolute inset-0">
                  <Annotation from={[0, 12]} to={[40, 22]} label="OPERATOR: YOU" />
                  <Annotation from={[64, 56]} to={[70, 34]} label="VISOR: SIM-ONLY" />
                  <Annotation from={[0, 92]} to={[30, 78]} label="CLEARANCE: RANK_00" />
                </div>
              </div>
            </div>
          </ScrollScene>
        </PosterSection>
        <InkEdge edge="bottom" tone="void" className="band-paper" />

        {/* 03 SIGNAL — CYBERBLADE splits into CYBER + BLADE while scattered readings settle into a network. */}
        <PosterSection tone="void" sceneId="signal" labelledBy="signal-heading">
          <ScrollScene pin length={2.6} steps={SIGNAL_DIAGRAM.nodes.length} mobile="play" className={STAGE}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden font-display text-[length:var(--poster-section)] leading-none text-line max-md:hidden">
              <span data-from={fx({ x: "30vw", y: "30vh", scale: 1.6 })} data-dur="0.45" className="absolute left-[2%] top-[6%]">
                CYBER
              </span>
              <span data-from={fx({ x: "-30vw", y: "-30vh", scale: 1.6 })} data-dur="0.45" className="absolute bottom-[6%] right-[2%]">
                BLADE
              </span>
            </div>
            <div data-camera={fx({ scale: 0.82 })} className={CAMERA}>
              <div className="relative md:col-span-5 md:self-center">
                <SystemLabel tone="cyan">SEQ 03/07</SystemLabel>
                <div data-chars={fx({ yPercent: -90, rotate: -10, stagger: 0.03 })} data-at="0.3" data-dur="0.3" className="mt-2">
                  <PosterHeading id="signal-heading" lines={["SIGNAL_"]} size="section" split="chars" />
                </div>
                <p data-from={fx({ opacity: 0, y: 24 })} data-at="0.62" data-dur="0.18" className="mt-6 max-w-[44ch] text-lg text-muted">
                  Every system is talking: connections, logins, lookups. Before you can protect anything, you learn to hear it.
                </p>
              </div>
              <div data-morph-at="0.1" data-morph-dur="0.7" className="relative md:col-span-7">
                <HalftoneField tone="cyan" density={7} fade="radial" className="opacity-20" />
                <TechnicalDiagram {...SIGNAL_DIAGRAM} mobileNodes={ring(SIGNAL_DIAGRAM.nodes)} tone="cyan" style="hand" ratio="16 / 11" />
              </div>
            </div>
          </ScrollScene>
        </PosterSection>

        {/* 04 TRACE: an evidence board. The route draws itself hop by hop; each hop's log line lights up as the camera reaches it. */}
        <InkEdge edge="top" variant={2} tone="paper" className="band-void" />
        <PosterSection tone="paper" sceneId="trace" labelledBy="trace-heading" backdrop={<NoiseLayer kind="photocopy" />}>
          <ScrollScene pin length={2.6} steps={TRACE_DIAGRAM.nodes.length} mobile="play" className={STAGE}>
            <div className="relative md:col-span-7">
              <SystemLabel>SEQ 04/07</SystemLabel>
              <PosterHeading id="trace-heading" lines={["TRACE_"]} size="section" className="mt-2 text-pink" />
            </div>
            <p className="relative max-w-[52ch] text-lg md:col-span-5 md:self-end">
              Follow one route hop by hop: where it was first seen, what it touched, where it ended. That&apos;s how an investigation reconstructs what
              happened.
            </p>
            <div data-camera={fx({ xPercent: 18, rotateY: -8 })} className="draw-path relative md:col-span-12">
              <TechnicalDiagram {...TRACE_DIAGRAM} mobileNodes={zigzagNodes(TRACE_DIAGRAM.nodes)} tone="current" style="hand" ratio="21 / 5" numbered />
            </div>
            <ol aria-label="Evidence, hop by hop" className="relative grid gap-3 sm:grid-cols-2 md:col-span-12 md:grid-cols-5">
              {TRACE_EVIDENCE.map((e, i) => (
                <li
                  key={e.hop}
                  data-trail
                  style={{ "--trail-i": i, "--trail-n": TRACE_EVIDENCE.length } as React.CSSProperties}
                  className={`border-2 border-l-8 border-current border-l-pink bg-paper p-3 ${i % 2 ? "tilt-1" : "tilt--1"}`}
                >
                  <SystemLabel>
                    {String(i + 1).padStart(2, "0")} · {e.time}
                  </SystemLabel>
                  <p className="mt-1 text-sm leading-snug">{e.note}</p>
                </li>
              ))}
            </ol>
          </ScrollScene>
        </PosterSection>
        <InkEdge edge="bottom" variant={3} tone="void" className="band-paper" />

        {/* 05 ANALYZE: the word arrives out of depth, the network re-arranges into readings, and a day of alerts narrows to one incident. */}
        <PosterSection tone="void" sceneId="analyze" labelledBy="analyze-heading">
          <ScrollScene pin length={2.6} mobile="play" className={STAGE}>
            <div data-camera={fx({ rotateY: 16, rotateX: 6, scale: 0.88 })} className={CAMERA}>
              <div className="relative md:col-span-12">
                <SystemLabel tone="cyan">SEQ 05/07</SystemLabel>
                <div data-chars={fx({ z: -900, rotateY: 50, stagger: 0.035 })} data-dur="0.4" className="mt-2">
                  <PosterHeading id="analyze-heading" lines={["ANALYZE_"]} size="section" split="chars" />
                </div>
              </div>
              <div data-morph-at="0.2" data-morph-dur="0.6" className="relative md:col-span-7 md:self-center">
                <TechnicalDiagram {...ANALYZE_DIAGRAM} mobileNodes={turnUpright(ANALYZE_DIAGRAM.nodes)} tone="cyan" ratio="16 / 9" />
              </div>
              <div className="relative md:col-span-5 md:self-center">
                <TriageFunnel stages={TRIAGE} caption="EXAMPLE: ONE DAY OF ALERTS IN A SOC" />
                <p className="mt-6 text-lg text-muted">Logs, packets, processes: evidence tells you what happened. You&apos;ll learn to read it.</p>
              </div>
            </div>
          </ScrollScene>
        </PosterSection>

        {/* 06 DEFEND: defence in depth lands layer by layer, from the edge in to the data at the centre. */}
        <PosterSection
          tone="void"
          sceneId="defend"
          labelledBy="defend-heading"
          className="border-t border-cyan"
          backdrop={<HalftoneField tone="cyan" density={9} fade="right" className="opacity-15" />}
        >
          <ScrollScene pin length={2.6} mobile="play" className={STAGE}>
            <div data-camera={fx({ scale: 1.15 })} className={CAMERA}>
              <div className="relative md:col-span-6 md:self-center">
                <SystemLabel tone="cyan">SEQ 06/07</SystemLabel>
                <PosterHeading id="defend-heading" lines={["DEFEND_"]} size="section" className="mt-2 text-cyan" />
                <p className="mt-4 max-w-[44ch] text-lg text-muted">
                  Detect, contain, harden. The same understanding, turned into protection: one layer at a time, from the edge in to the data.
                </p>
                <ul aria-label="The four disciplines" className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-[length:var(--poster-label)]">
                  {["LEARN.", "TRACE.", "ANALYZE.", "DEFEND."].map((w, i) => (
                    <li key={w} data-from={fx({ y: 60, rotate: i % 2 ? 6 : -6, opacity: 0 })} data-at={String(0.6 + i * 0.07)} data-dur="0.15" className="font-display">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative md:col-span-6 md:self-center">
                <DefenceLayers layers={DEFENCE_LAYERS} className="mx-auto w-full max-w-[min(100%,68vh)] text-cyan" />
              </div>
            </div>
          </ScrollScene>
        </PosterSection>

        {/* 07 ENTER THE SYSTEM — everything resolves into the training system, the four paths, and the way in. */}
        <InkEdge edge="top" tone="paper" className="band-void" />
        <PosterSection tone="paper" sceneId="enter" labelledBy="enter-heading" className="py-20 sm:py-28" backdrop={<NoiseLayer kind="photocopy" />}>
          <ScrollScene scrub={false} mobile="play" className="col-span-full">
            <div className="max-w-3xl">
              <SystemLabel>SEQ 07/07</SystemLabel>
              <PosterHeading id="enter-heading" lines={["ENTER THE", "SYSTEM_"]} size="section" className="mt-2" />
            </div>
            <ol className="mt-12 grid gap-0.5 border-2 border-current bg-current sm:grid-cols-2 lg:grid-cols-3">
              {SYSTEM_STAGES.map((s, i) => (
                <li key={s.id} data-stage={s.label} data-from={fx({ y: 40, opacity: 0 })} data-at={String(0.05 + i * 0.07)} data-dur="0.2" className="band-paper p-5">
                  <SystemLabel>{String(i + 1).padStart(2, "0")}</SystemLabel>
                  <h3 className="mt-1 font-display text-3xl">{s.label}</h3>
                  <p className="mt-2">{s.text}</p>
                </li>
              ))}
            </ol>

            <h2 id="tracks" className="mt-20 scroll-mt-24 font-ui text-2xl">Then pick the job you want</h2>
            <p className="mt-2 max-w-[52ch] text-lg">Everyone starts with the shared core. After Rank 2 you choose a path.</p>
            <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-x-12">
              {launch.map((t, i) => {
                const glyph = TRACK_GLYPHS[t.id as LaunchTrackId];
                return (
                  <div key={t.id} data-from={fx({ y: 60, rotate: i % 2 ? 4 : -4, opacity: 0 })} data-at={String(0.45 + i * 0.06)} data-dur="0.2" className={WALL[i]}>
                    <DossierCard fileNo={`TRACK ${String(i + 1).padStart(2, "0")}`} title={t.title} stamp="OPEN" stampTone={STAMP_TONE[t.id as LaunchTrackId]}>
                      <TechnicalDiagram title={glyph.title} nodes={glyph.nodes} links={glyph.links} labels={false} ratio="16 / 6" className="my-4" />
                      <p>{glyph.line}</p>
                    </DossierCard>
                  </div>
                );
              })}
            </div>
          </ScrollScene>
        </PosterSection>
        <InkEdge edge="bottom" tone="cyan" className="band-paper" />

        <PosterSection tone="cyan" labelledBy="start-heading" className="py-20 sm:py-28" backdrop={<HalftoneField tone="current" density={6} fade="left" className="opacity-20" />}>
          <PosterSection.Type className="col-span-full md:col-span-8">
            <PosterHeading id="start-heading" lines={["START AT", "RANK_00"]} size="section" cursor />
          </PosterSection.Type>
          <PosterSection.Caption className="col-span-full mt-10 md:col-span-4 md:self-end">
            <p className="text-lg">No experience needed. Choose a handle, accept the rules, and begin at Rank 0.</p>
            <div className="mt-6">
              <Magnetic>
                <Link href="/start" className={`${START_BUTTON} border-void bg-void text-cyan hover:bg-paper hover:text-void`}>
                  Start
                </Link>
              </Magnetic>
            </div>
          </PosterSection.Caption>
        </PosterSection>
      </main>
    </>
  );
}
