import type { Metadata } from "next";
import Link from "next/link";
import { PosterSection } from "@/components/art/PosterSection";
import { PosterHeading } from "@/components/art/PosterHeading";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { SystemLabel } from "@/components/art/SystemLabel";
import { Scanlines } from "@/components/theme/Scanlines";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isBetaInviteOnly } from "@/lib/beta";
import { INVITE_ERROR } from "@/lib/beta/codes";
import { safeNextPath } from "@/lib/identity/routes";
import { BRAND } from "@/lib/brand";
import { StartForm } from "./StartForm";

export const metadata: Metadata = {
  title: "Start",
  description: `Register your operator identity and begin the ${BRAND.name} training programme.`,
};

const INTAKE_FIELDS = [
  { id: "OPSEC-01", label: "Anonymous callsign" },
  { id: "OPSEC-02", label: "Instant clearance" },
  { id: "OPSEC-03", label: "Full console access" },
] as const;

export default async function StartPage(props: PageProps<"/start">) {
  const { next } = await props.searchParams;
  return (
    <>
      <Scanlines />
      <main className="flex min-h-[100dvh] flex-col">

        {/* ── HERO BAND ─────────────────────────────────────────────────── */}
        <PosterSection
          tone="paper"
          labelledBy="start-heading"
          backdrop={<NoiseLayer kind="photocopy" />}
          className="neon-hero border-b-2 border-void py-14 sm:py-20"
        >
          <div className="col-span-full max-w-5xl mx-auto w-full">
            {/* Sequence label */}
            <SystemLabel>
              {`${BRAND.name} // OPERATOR INTAKE // DIRECT ACCESS`}
            </SystemLabel>

            {/* Giant heading */}
            <PosterHeading
              id="start-heading"
              as="h1"
              lines={["ENTER_", "CONSOLE"]}
              size="section"
              cursor
              className="mt-3"
            />

            {/* Ruled separators with decoded kicker */}
            <div className="mt-8 grid grid-cols-[auto_1fr] items-center gap-4">
              <div aria-hidden="true" className="flex items-center gap-1.5 font-ui text-xs tracking-widest text-void/60">
                <span className="block h-2 w-2 rounded-full border-2 border-current" />
                &gt;&nbsp;OPERATOR READY
              </div>
              <div aria-hidden="true" className="h-px bg-void/20" />
            </div>
          </div>
        </PosterSection>

        {/* ── FORM + SIDEBAR ─────────────────────────────────────────────── */}
        <div className="flex-1 bg-void">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-line lg:grid-cols-[2fr_1fr]">

            {/* ── MAIN FORM COLUMN ───────────────────────────────────────── */}
            <div className="bg-void px-6 py-10 sm:px-10 sm:py-14">
              {/* Back navigation */}
              <div className="mb-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-mono text-xs text-cyan hover:underline"
                >
                  ‹ RETURN TO BRIEFING
                </Link>
              </div>

              {/* Terminal panel title bar */}
              <div className="flex items-center gap-0 border-2 border-line">
                <span className="border-r border-line bg-void px-4 py-2 font-ui text-xs tracking-widest text-cyan">
                  TERMINAL
                </span>
                <span className="px-4 py-2 font-ui text-xs tracking-widest text-muted">
                  launch_session
                </span>
                <span className="ml-auto flex gap-1.5 px-4 py-2" aria-hidden="true">
                  <span className="block h-2 w-2 rounded-full bg-pink/50" />
                  <span className="block h-2 w-2 rounded-full bg-cyan/30" />
                  <span className="block h-2 w-2 rounded-full bg-line" />
                </span>
              </div>

              {/* Form body with terminal inset */}
              <div className="border-2 border-t-0 border-line p-6 sm:p-8">
                <p className="mb-8 font-mono text-xs tracking-widest text-secondary">
                  &gt; ENTER ANY CALLSIGN OR LEAVE BLANK TO INITIALIZE
                </p>
                <StartForm
                  next={safeNextPath(typeof next === "string" ? next : null)}
                />
              </div>
            </div>

            {/* ── TELEMETRY SIDEBAR ──────────────────────────────────────── */}
            <div className="hidden bg-void lg:block">
              {/* Header cell */}
              <div className="border-b border-line px-6 py-4">
                <SystemLabel className="text-cyan">DIRECT ACCESS</SystemLabel>
              </div>

              {/* Step-by-step intake fields */}
              <ul role="list" className="divide-y divide-line">
                {INTAKE_FIELDS.map((field, i) => (
                  <li key={field.id} className="grid grid-cols-[auto_1fr] gap-px bg-line">
                    <div className="flex items-center justify-center bg-void px-4 py-5">
                      <span className="font-ui text-2xl font-bold text-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="bg-void px-5 py-5">
                      <SystemLabel className="block text-cyan">{field.id}</SystemLabel>
                      <p className="mt-1 text-sm text-secondary">{field.label}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Telemetry footer */}
              <div className="border-t border-line px-6 py-6 text-xs tracking-wider">
                <div className="space-y-2 font-ui text-secondary">
                  <div className="flex justify-between">
                    <span>SESSION</span>
                    <span className="text-ink">DIRECT (ACTIVE)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLEARANCE</span>
                    <span className="text-cyan">GRANTED</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AUTHENTICATION</span>
                    <span className="text-ink">NOT REQUIRED</span>
                  </div>
                </div>

                <div className="mt-8 border-t border-line pt-6">
                  <p className="text-muted leading-relaxed font-sans text-xs">
                    This system stores only your operator handle — a pseudonym you choose. No email, no name, no tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
