import Link from "next/link";
import { Annotation } from "@/components/art/Annotation";
import { DossierCard } from "@/components/art/DossierCard";
import { EditorialIllustration } from "@/components/art/EditorialIllustration";
import { HalftoneField } from "@/components/art/HalftoneField";
import { InkEdge } from "@/components/art/InkEdge";
import { Magnetic } from "@/components/art/motion/Magnetic";
import { Parallax } from "@/components/art/motion/Parallax";
import { Reveal } from "@/components/art/motion/Reveal";
import { ScrollScene } from "@/components/art/motion/ScrollScene";
import { SmoothScroll } from "@/components/art/motion/SmoothScroll";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { PosterHeading } from "@/components/art/PosterHeading";
import { PosterSection } from "@/components/art/PosterSection";
import { SystemLabel } from "@/components/art/SystemLabel";
import { TechnicalDiagram } from "@/components/art/TechnicalDiagram";
import { Scanlines } from "@/components/theme/Scanlines";
import { TypingText } from "@/components/theme/TypingText";
import { stackVertically } from "@/lib/art/diagram";
import { LOOP_DIAGRAM, LOOP_STEPS, TRACK_GLYPHS, type LaunchTrackId } from "@/lib/art/landing";
import { BRAND } from "@/lib/brand";
import { TRACKS } from "@/lib/catalog/tracks";

const START_BUTTON = "inline-block border-2 px-8 py-3 font-ui text-xl transition-colors";

// The dossier wall: each file sits at its own angle and height, like papers pinned to a board.
const WALL = ["tilt--1", "tilt-1 md:mt-20", "tilt-1 md:-mt-4", "tilt--2 md:mt-14"];
const STAMP_TONE: Record<LaunchTrackId, "purple" | "cyan" | "pink"> = { purple: "purple", soc: "cyan", pentest: "pink", cloud: "cyan" };

export default function Home() {
  const launch = TRACKS.filter((t) => t.status === "open");

  return (
    <main>
      <SmoothScroll />
      <Scanlines />

      {/* ENTER — the poster: the wordmark collides with the operator you are about to become. */}
      <PosterSection
        tone="paper"
        labelledBy="enter-heading"
        className="neon-hero min-h-[100svh] pt-6"
        backdrop={
          <>
            <HalftoneField tone="current" density={7} angle={20} fade="right" className="opacity-[0.14]" />
            <NoiseLayer kind="grain" />
          </>
        }
      >
        <PosterSection.Labels className="col-span-full row-start-1 justify-between pb-8 opacity-80">
          <SystemLabel>SYS.BOOT 00:00:01</SystemLabel>
          <SystemLabel>NODE: PUBLIC</SystemLabel>
          <SystemLabel className="hidden sm:inline">x:0412 y:0088</SystemLabel>
          <SystemLabel>MODE: SIMULATION</SystemLabel>
        </PosterSection.Labels>

        <PosterSection.Type className="col-span-full row-start-2 self-center md:col-span-9 md:col-start-1 md:row-start-2">
          <p className="mb-2 text-lg sm:text-xl">
            <TypingText text="> BE READY TO LEARN" />
          </p>
          <PosterHeading as="h1" id="enter-heading" lines={[BRAND.name]} size="hero" cursor />
        </PosterSection.Type>

        <PosterSection.Art className="col-span-3 col-start-2 row-start-3 -mt-2 md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-2 md:-mt-6">
          <Parallax speed={-10}>
            <div className="relative">
              <EditorialIllustration slot="operator" alt="Ink-and-halftone portrait of an anonymous operator wearing a cyan simulation visor" />
              <Annotation from={[0, 12]} to={[40, 22]} label="OPERATOR: YOU" />
              <Annotation from={[64, 56]} to={[70, 34]} label="VISOR: SIM-ONLY" />
              <Annotation from={[0, 92]} to={[30, 78]} label="CLEARANCE: RANK_00" />
            </div>
          </Parallax>
        </PosterSection.Art>

        <PosterSection.Caption className="col-span-full row-start-4 pb-20 pt-8 md:col-span-6 md:col-start-1 md:row-start-3 md:self-end md:pt-0">
          <p className="text-lg sm:text-2xl">{BRAND.tagline}</p>
          <div className="mt-8">
            <Magnetic>
              <Link href="/start" className={`${START_BUTTON} border-void bg-void text-paper hover:border-pink hover:bg-pink hover:text-void`}>
                Start
              </Link>
            </Magnetic>
          </div>
        </PosterSection.Caption>
      </PosterSection>
      <InkEdge edge="bottom" tone="void" className="band-paper" />

      {/* DISCOVER — the claim, set as big as the wordmark. */}
      <PosterSection
        tone="void"
        labelledBy="discover-heading"
        className="py-20 sm:py-32"
        backdrop={<HalftoneField tone="cyan" density={9} fade="radial" className="opacity-30" />}
      >
        <PosterSection.Labels className="col-span-full mb-8">
          <SystemLabel tone="cyan">SEQ 02/05</SystemLabel>
        </PosterSection.Labels>
        <PosterSection.Type className="col-span-full md:col-span-11">
          <Reveal mode="mask">
            <PosterHeading id="discover-heading" lines={["YOU'RE NOT", "WATCHING", "A COURSE_"]} size="section" />
          </Reveal>
        </PosterSection.Type>
        <PosterSection.Caption className="col-span-full mt-12 md:col-span-5 md:col-start-8">
          <Reveal mode="rise">
            <p className="text-xl sm:text-2xl">
              You&apos;re entering a training system. Every rank is a set of missions: learn the idea, prove it, do it on a simulated machine, then
              debrief like a professional.
            </p>
          </Reveal>
        </PosterSection.Caption>
      </PosterSection>

      {/* UNDERSTAND — the learning loop as a circuit; scrolling walks through its four stations. */}
      <PosterSection tone="void" labelledBy="understand-heading" className="border-t border-line">
        <ScrollScene pin steps={LOOP_STEPS.length} className="col-span-full grid min-h-[100svh] content-center gap-x-6 gap-y-6 py-10 md:grid-cols-12">
          <PosterSection.Type className="md:col-span-7 md:row-start-1">
            <SystemLabel tone="cyan">SEQ 03/05</SystemLabel>
            <PosterHeading id="understand-heading" lines={["BREAKING INTO", "THE SYSTEM_"]} size="section" className="mt-2" />
            <p className="mt-4 max-w-[52ch] text-lg text-muted">Every lesson runs the same four-step loop. Finish it and the next briefing is waiting.</p>
          </PosterSection.Type>
          <PosterSection.Art className="relative md:col-span-7 md:row-start-2">
            <HalftoneField tone="cyan" density={7} fade="radial" className="opacity-20" />
            <TechnicalDiagram {...LOOP_DIAGRAM} mobileNodes={stackVertically(LOOP_DIAGRAM.nodes)} tone="cyan" style="hand" ratio="21 / 9" numbered />
          </PosterSection.Art>
          <PosterSection.Caption className="md:col-span-5 md:col-start-8 md:row-span-2 md:row-start-1 md:self-center">
            <ol className="space-y-5">
              {LOOP_STEPS.map((s, i) => (
                <li key={s.id} data-step-item={i} className="border-l-2 border-cyan pl-4">
                  <h3 className="font-ui text-xl text-cyan">{s.label}</h3>
                  <p className="text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </PosterSection.Caption>
        </ScrollScene>
      </PosterSection>

      {/* CHOOSE — the four launch tracks as files pinned to a wall, each with the shape of its work. */}
      <InkEdge edge="top" tone="paper" className="band-void" />
      <PosterSection tone="paper" labelledBy="choose-heading" className="py-20 sm:py-28" backdrop={<NoiseLayer kind="photocopy" />}>
        <PosterSection.Type className="col-span-full md:col-span-8">
          <SystemLabel>SEQ 04/05</SystemLabel>
          <PosterHeading id="choose-heading" lines={["CHOOSE", "YOUR PATH_"]} size="section" className="mt-2" />
          <p className="mt-4 max-w-[52ch] text-lg">Everyone starts with the shared core. Then pick the job you want.</p>
        </PosterSection.Type>
        <div className="col-span-full mt-14 grid gap-10 md:grid-cols-2 md:gap-x-12">
          {launch.map((t, i) => {
            const glyph = TRACK_GLYPHS[t.id as LaunchTrackId];
            return (
              <Reveal key={t.id} mode="rise" delay={i * 0.08} className={WALL[i]}>
                <DossierCard fileNo={`TRACK ${String(i + 1).padStart(2, "0")}`} title={t.title} stamp="OPEN" stampTone={STAMP_TONE[t.id as LaunchTrackId]}>
                  <TechnicalDiagram title={glyph.title} nodes={glyph.nodes} links={glyph.links} labels={false} ratio="16 / 6" className="my-4" />
                  <p>{glyph.line}</p>
                </DossierCard>
              </Reveal>
            );
          })}
        </div>
      </PosterSection>
      <InkEdge edge="bottom" tone="cyan" className="band-paper" />

      {/* START — the way in. */}
      <PosterSection
        tone="cyan"
        labelledBy="start-heading"
        className="py-20 sm:py-28"
        backdrop={<HalftoneField tone="current" density={6} fade="left" className="opacity-20" />}
      >
        <PosterSection.Type className="col-span-full md:col-span-8">
          <SystemLabel>SEQ 05/05</SystemLabel>
          <PosterHeading id="start-heading" lines={["START AT", "RANK_00"]} size="section" cursor className="mt-2" />
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
  );
}
