import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { IconBook, IconCheck, IconChevronRight, IconClock } from "@/components/ui/icons";
import { resolvePracticeTarget } from "@/lib/content/practice";
import { loadPracticePaths, pathMinutes, practiceMinutes, SOC_TRACK_BASE } from "@/lib/content/soc-curriculum";
import { isSocQueryEnabled } from "@/lib/config/env";
import { loadSocTrack, skillTitles, socCoverage } from "./track-data";

export const metadata: Metadata = { title: "SOC Analyst L1 · CyberBLADE" };

const linkFocus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

export default async function SocTrackPage() {
  const data = await loadSocTrack();
  const { modules, lessons, statusOf } = data;
  const done = lessons.filter((l) => statusOf(l.id) === "completed").length;
  const totalMinutes = modules.reduce((n, m) => n + m.minutes, 0);
  const paths = loadPracticePaths().paths;
  const titles = new Map(lessons.map((l) => [l.id, l.title]));
  const skills = skillTitles();
  const coverage = socCoverage();
  const drillsOn = isSocQueryEnabled();

  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand title="SOC Analyst L1" kicker={`> soc_l1 · ${lessons.length} lessons · ${Math.round(totalMinutes / 60)} h`}>
        Twelve modules that take you from what a SOC does to running a full shift: triage, phishing, network, endpoint,
        identity and cloud evidence, the SIEM, incident response and reporting.
      </HeroBand>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        <section aria-labelledby="progress-h" className="rounded-sm border border-line bg-surface p-5">
          <h2 id="progress-h" className="font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Your progress
          </h2>
          <p className="mt-2 font-sans text-[15px] text-ink">
            {done} of {lessons.length} lessons completed.
          </p>
          <ProgressBar value={done} max={Math.max(1, lessons.length)} className="mt-3" label={`${done} of ${lessons.length} lessons completed`} />
          <ul className="mt-4 flex flex-wrap gap-3 font-ui text-sm">
            <li>
              <Link href={`${SOC_TRACK_BASE}/glossary`} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-line px-4 text-ink hover:border-cyan/60 hover:text-cyan ${linkFocus}`}>
                <IconBook className="h-4 w-4" aria-hidden="true" /> Glossary
              </Link>
            </li>
            {drillsOn && (
              <li>
                <Link href="/practice/drills" className={`inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-line px-4 text-ink hover:border-cyan/60 hover:text-cyan ${linkFocus}`}>
                  Query drills
                </Link>
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="map-h">
          <h2 id="map-h" className="mb-4 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Curriculum map
          </h2>
          {lessons.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line p-6 text-center font-sans text-sm text-muted">
              No lessons are published in this track yet.
            </p>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2" aria-label="Modules">
              {modules.map((m) => {
                const mDone = m.lessons.filter((l) => statusOf(l.id) === "completed").length;
                const complete = m.lessons.length > 0 && mDone === m.lessons.length;
                return (
                  <li key={m.key}>
                    <Link
                      href={`${SOC_TRACK_BASE}/${m.key}`}
                      className={`group flex h-full min-h-[44px] flex-col gap-2 rounded-sm border border-line bg-surface p-4 transition-colors duration-150 hover:border-cyan/60 ${linkFocus}`}
                    >
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Module {m.order}</span>
                      <span className="font-sans text-[16px] font-semibold text-ink group-hover:text-cyan">{m.title}</span>
                      <span className="flex flex-wrap items-center gap-3 font-ui text-xs text-muted">
                        <span>{m.lessons.length} lessons</span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="h-3 w-3" aria-hidden="true" /> {m.minutes} min
                        </span>
                        <span className={`inline-flex items-center gap-1 ${complete ? "text-success" : ""}`}>
                          {complete && <IconCheck className="h-3 w-3" aria-hidden="true" />}
                          {complete ? "Complete" : `${mDone} of ${m.lessons.length} done`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="paths-h">
          <h2 id="paths-h" className="mb-1 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Practice paths
          </h2>
          <p className="mb-4 font-sans text-sm text-muted">
            Short routes through lessons and hands-on practice for one job skill. Times combine lesson times with each
            practice item&apos;s own estimate.
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {paths.map((p) => {
              // With drills switched off, drill steps are hidden and must not count towards the time either.
              const steps = drillsOn ? p.steps : p.steps.filter((st) => !("practice" in st && st.practice.startsWith("drill:")));
              const t = pathMinutes(steps, lessons);
              return (
                <li key={p.id} className="rounded-sm border border-line bg-surface p-4">
                  <h3 className="font-sans text-[16px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-1 font-sans text-sm text-muted">{p.description}</p>
                  <p className="mt-2 inline-flex items-center gap-1 font-ui text-xs text-muted">
                    <IconClock className="h-3 w-3" aria-hidden="true" /> about {t.min === t.max ? t.min : `${t.min}-${t.max}`} min
                  </p>
                  <ol className="mt-3 space-y-1.5">
                    {steps.map((s, i) => {
                      if ("lesson" in s) {
                        return (
                          <li key={i} className="flex items-start gap-2 font-sans text-sm">
                            <span className="mt-0.5 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                            <Link href={`/learn/${s.lesson}`} className={`text-ink underline-offset-4 hover:text-cyan hover:underline ${linkFocus}`}>
                              {titles.get(s.lesson) ?? s.lesson}
                            </Link>
                          </li>
                        );
                      }
                      const card = resolvePracticeTarget(s.practice, (id) => titles.get(id) ?? null);
                      if (typeof card === "string" || (card.kind === "drill" && !drillsOn)) return null;
                      const pm = practiceMinutes(s.practice);
                      return (
                        <li key={i} className="flex items-start gap-2 font-sans text-sm">
                          <span className="mt-0.5 font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                          <Link href={card.href} className={`text-ink underline-offset-4 hover:text-cyan hover:underline ${linkFocus}`}>
                            Practice: {card.title}
                          </Link>
                          <span className="font-ui text-xs text-muted">({pm.min === pm.max ? pm.min : `${pm.min}-${pm.max}`} min)</span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="skills-h">
          <h2 id="skills-h" className="mb-1 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Skills coverage
          </h2>
          <p className="mb-4 font-sans text-sm text-muted">Which lessons teach each skill, how it is practised, and where coverage is still thin.</p>
          {/* Phones: one card per skill (a 4-column table is unreadable at 390 px). */}
          <ul className="space-y-2 sm:hidden">
            {coverage.skills.map((s) => (
              <li key={s.id} className="rounded-sm border border-line bg-surface p-3">
                <p className="font-sans text-[15px] font-semibold text-ink">{skills.get(s.id) ?? s.id}</p>
                <p className="mt-1 font-ui text-xs text-muted">
                  {s.lessons.length} lessons · {s.practice.length} practice items
                </p>
                <p className="mt-1 font-sans text-[13px] text-muted">{s.gap ?? "Covered"}</p>
              </li>
            ))}
          </ul>
          <div tabIndex={0} role="region" aria-label="Skills coverage table" className={`hidden overflow-x-auto rounded-sm border border-line bg-surface sm:block ${linkFocus}`}>
            <table className="w-full border-collapse text-left font-sans text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line bg-surface-raised px-3 py-2 font-ui text-xs uppercase tracking-wider text-muted">Skill</th>
                  <th scope="col" className="border-b border-line bg-surface-raised px-3 py-2 font-ui text-xs uppercase tracking-wider text-muted">Lessons</th>
                  <th scope="col" className="border-b border-line bg-surface-raised px-3 py-2 font-ui text-xs uppercase tracking-wider text-muted">Practice</th>
                  <th scope="col" className="border-b border-line bg-surface-raised px-3 py-2 font-ui text-xs uppercase tracking-wider text-muted">Note</th>
                </tr>
              </thead>
              <tbody>
                {coverage.skills.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="border-b border-line/40 px-3 py-2 align-top font-normal text-ink">{skills.get(s.id) ?? s.id}</th>
                    <td className="border-b border-line/40 px-3 py-2 align-top text-muted">{s.lessons.length}</td>
                    <td className="border-b border-line/40 px-3 py-2 align-top text-muted">{s.practice.length}</td>
                    <td className="border-b border-line/40 px-3 py-2 align-top text-muted">{s.gap ?? "Covered"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="font-ui text-sm">
          <Link href="/learn/core" className={`inline-flex min-h-[44px] items-center gap-1 text-cyan underline-offset-4 hover:underline ${linkFocus}`}>
            Back to the core curriculum <IconChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </main>
  );
}
