import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { Scanlines } from "@/components/theme/Scanlines";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { BRAND } from "@/lib/brand";
import { TRACKS } from "@/lib/catalog/tracks";

const LOOP = [
  ["Briefing", "The idea in plain words first, then the full technical depth."],
  ["Terminal Check", "Quick questions that prove you understood, with an explanation for every answer."],
  ["Lab", "Do it yourself in a simulated machine, right in the browser."],
  ["Debrief", "What a professional does here, common mistakes, and a real incident."],
] as const;

export default function Home() {
  return (
    <main>
      <Scanlines />
      <HeroBand title={BRAND.name} kicker="> BE READY TO LEARN">
        <p>{BRAND.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/start" className="border border-void bg-void px-6 py-2 font-ui text-lg text-ink hover:bg-cyan hover:text-void">
            Start
          </Link>
        </div>
      </HeroBand>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16">
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="mb-6 text-4xl">
            how_it_works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {LOOP.map(([title, text], i) => (
              <li key={title}>
                <TerminalPanel title={`0${i + 1} ${title}`}>
                  <p className="text-muted">{text}</p>
                </TerminalPanel>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tracks-heading">
          <h2 id="tracks-heading" className="mb-6 text-4xl">
            tracks
          </h2>
          <p className="mb-4 text-muted">Everyone starts with the shared core. Then pick the job you want:</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TRACKS.filter((t) => t.status === "open").map((t) => (
              <li key={t.id} className="border border-line p-4 font-ui text-lg">
                {t.title}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="mb-4 text-4xl">
            get_started
          </h2>
          <p className="mb-6 text-muted">No experience needed. Choose a handle, accept the rules, and begin at Rank 0.</p>
          <Link href="/start" className="border border-cyan px-6 py-2 font-ui text-lg text-cyan hover:bg-cyan hover:text-void">
            Start
          </Link>
        </section>
      </div>
    </main>
  );
}
