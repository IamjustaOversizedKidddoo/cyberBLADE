import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { buildGlossary, SOC_TRACK_BASE } from "@/lib/content/soc-curriculum";
import { loadSocTrack } from "../track-data";

export const metadata: Metadata = { title: "SOC L1 glossary · CyberBLADE" };

const linkFocus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

export default async function SocGlossaryPage() {
  const data = await loadSocTrack();
  const entries = buildGlossary(data.lessons);
  const letters = [...new Set(entries.map((e) => e.term[0].toUpperCase()))];

  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand title="Glossary" kicker={`> soc_l1 · ${entries.length} terms`}>
        Every key term from the SOC L1 lessons, with the lesson that explains it.
      </HeroBand>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="font-ui text-xs text-muted">
          <Link href={SOC_TRACK_BASE} className={`text-cyan underline-offset-4 hover:underline ${linkFocus}`}>
            SOC Analyst L1
          </Link>
        </nav>
        <nav aria-label="Glossary letters">
          <ul className="flex flex-wrap gap-1.5">
            {letters.map((c) => (
              <li key={c}>
                <a href={`#letter-${c}`} className={`inline-flex h-11 w-11 items-center justify-center rounded-xs border border-line font-mono text-sm text-ink hover:border-cyan/60 hover:text-cyan ${linkFocus}`}>
                  {c}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {letters.map((c) => (
          <section key={c} aria-labelledby={`letter-${c}`}>
            <h2 id={`letter-${c}`} className="mb-2 font-mono text-lg font-bold text-cyan">
              {c}
            </h2>
            <dl className="divide-y divide-line rounded-sm border border-line bg-surface">
              {entries
                .filter((e) => e.term[0].toUpperCase() === c)
                .map((e) => (
                  <div key={e.anchor} id={e.anchor} className="scroll-mt-24 p-4">
                    <dt className="font-mono text-[14px] font-bold text-ink">{e.term}</dt>
                    <dd className="mt-1 font-sans text-[15px] leading-relaxed text-ink">{e.definition}</dd>
                    <dd className="mt-1 font-ui text-xs text-muted">
                      Explained in{" "}
                      <Link href={`/learn/${e.lessonId}#${e.anchor}`} className={`text-cyan underline-offset-4 hover:underline ${linkFocus}`}>
                        {e.lessonTitle}
                      </Link>
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
