import { DisplaySettings } from "@/components/theme/DisplaySettings";
import { HeroBand } from "@/components/theme/HeroBand";
import { Scanlines } from "@/components/theme/Scanlines";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main>
      <Scanlines />
      <HeroBand title={BRAND.name} kicker="> BE READY TO LEARN">
        <p>{BRAND.tagline}</p>
      </HeroBand>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
        <DisplaySettings />
        <TerminalPanel title="how_it_works">
          <p className="text-muted">
            Read a briefing, answer the terminal check, solve the lab, and get debriefed — then rank up.
          </p>
        </TerminalPanel>
      </div>
    </main>
  );
}
