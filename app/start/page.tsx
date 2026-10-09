import type { Metadata } from "next";
import { PosterSection } from "@/components/art/PosterSection";
import { PosterHeading } from "@/components/art/PosterHeading";
import { NoiseLayer } from "@/components/art/NoiseLayer";
import { SystemLabel } from "@/components/art/SystemLabel";
import { Scanlines } from "@/components/theme/Scanlines";
import { safeNextPath } from "@/lib/identity/routes";
import { BRAND } from "@/lib/brand";
import { StartForm } from "./StartForm";

export const metadata: Metadata = {
  title: "Start",
  description: `Register your operator identity and begin the ${BRAND.name} training programme.`,
};

const INTAKE_FIELDS = [
  { id: "OPSEC-01", label: "Identity protection" },
  { id: "OPSEC-02", label: "Handle validation" },
  { id: "OPSEC-03", label: "Ethical use agreement" },
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
              {`${BRAND.name} // OPERATOR INTAKE // PHASE 01`}
            </SystemLabel>

            {/* Giant heading */}
            <PosterHeading
              id="start-heading"
              as="h1"
              lines={["INITIATE_"]}
              size="section"
              cursor
              className="mt-3"
            />

            {/* Ruled separators with decoded kicker */}
            <div className="mt-8 grid grid-cols-[auto_1fr] items-center gap-4">
              <div aria-hidden="true" className="flex items-center gap-1.5 font-ui text-xs tracking-widest text-void/60">
                <span className="block h-2 w-2 rounded-full border-2 border-current" />
                &gt;&nbsp;NEW OPERATOR DETECTED
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
              {/* Terminal panel title bar */}
              <div className="flex items-center gap-0 border-2 border-line">
                <span className="border-r border-line bg-void px-4 py-2 font-ui text-xs tracking-widest text-cyan">
                  TERMINAL
                </span>
                <span className="px-4 py-2 font-ui text-xs tracking-widest text-muted">
                  register_operator
                </span>
                <span className="ml-auto flex gap-1.5 px-4 py-2" aria-hidden="true">
                  <span className="block h-2 w-2 rounded-full bg-pink/50" />
                  <span className="block h-2 w-2 rounded-full bg-cyan/30" />
                  <span className="block h-2 w-2 rounded-full bg-line" />
                </span>
              </div>

              {/* Form body with terminal inset */}
              <div className="border-2 border-t-0 border-line p-6 sm:p-8">
                <p className="mb-8 font-mono text-xs tracking-widest text-muted/60">
                  &gt; INTAKE SEQUENCE INITIATED — COMPLETE ALL FIELDS TO PROCEED
                </p>
                <StartForm next={safeNextPath(typeof next === "string" ? next : null)} />
              </div>
            </div>

            {/* ── TELEMETRY SIDEBAR ──────────────────────────────────────── */}
            <div className="hidden bg-void lg:block">
              {/* Header cell */}
              <div className="border-b border-line px-6 py-4">
                <SystemLabel className="text-cyan">INTAKE PROTOCOL</SystemLabel>
              </div>

              {/* Step-by-step intake fields */}
              <ul role="list" className="divide-y divide-line">
                {INTAKE_FIELDS.map((field, i) => (
                  <li key={field.id} className="grid grid-cols-[auto_1fr] gap-px bg-line">
                    <div className="flex items-center justify-center bg-void px-4 py-5">
                      <span className="font-ui text-2xl font-bold text-line">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="bg-void px-5 py-5">
                      <SystemLabel className="block text-cyan">{field.id}</SystemLabel>
                      <p className="mt-1 text-sm text-muted">{field.label}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Telemetry footer */}
              <div className="border-t border-line px-6 py-6 text-xs tracking-wider">
                <div className="space-y-2 font-ui text-muted/50">
                  <div className="flex justify-between">
                    <span>SESSION</span>
                    <span>LOCAL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLEARANCE</span>
                    <span>PENDING</span>
                  </div>
                  <div className="flex justify-between">
                    <span>STATUS</span>
                    <span className="text-pink">UNAUTHENTICATED</span>
                  </div>
                </div>

                <div className="mt-8 border-t border-line pt-6">
                  <p className="text-muted/40 leading-relaxed">
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
