import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TerminalCheck } from "@/components/lesson/TerminalCheck";
import { HeroBand } from "@/components/theme/HeroBand";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClock } from "@/components/ui/icons";
import { toPublicChecks } from "@/lib/content/checks";
import { loadChecks } from "@/lib/content/checks-server";
import { checkpointIds, SOC_TRACK_BASE } from "@/lib/content/soc-curriculum";
import { answerCheckpointAction } from "../actions";
import { loadSocTrack } from "../track-data";

export const metadata: Metadata = { title: "SOC L1 module · CyberBLADE" };

const linkFocus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

export default async function SocModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: key } = await params;
  const data = await loadSocTrack();
  const i = data.modules.findIndex((m) => m.key === key);
  if (i === -1) notFound();
  const mod = data.modules[i];
  const prev = data.modules[i - 1];
  const next = data.modules[i + 1];
  const titles = new Map(data.lessons.map((l) => [l.id, l.title]));

  // Checkpoint: the last two check questions of each lesson in the module, shuffled per learner.
  const sets = await Promise.all(mod.lessons.map((l) => loadChecks(l.id)));
  const ids = checkpointIds(
    mod.lessons.map((l) => l.id),
    new Map(sets.map((s) => [s.lesson, s.questions.map((q) => q.id)])),
  );
  const questions = sets.flatMap((s) =>
    toPublicChecks(s, data.operatorId)
      .filter((q) => ids.includes(`${s.lesson}~${q.id}`))
      .map((q) => ({ ...q, id: `${s.lesson}~${q.id}` })),
  );

  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand title={mod.title} kicker={`> soc_l1 · module_${String(mod.order).padStart(2, "0")} · ${mod.minutes} min`} />
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="font-ui text-xs text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href={SOC_TRACK_BASE} className={`text-cyan underline-offset-4 hover:underline ${linkFocus}`}>
                SOC Analyst L1
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Module {mod.order}</li>
          </ol>
        </nav>

        <section aria-labelledby="lessons-h">
          <h2 id="lessons-h" className="mb-3 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Lessons
          </h2>
          {mod.lessons.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line p-6 text-center font-sans text-sm text-muted">No lessons are published in this module yet.</p>
          ) : (
            <ol className="space-y-3">
              {mod.lessons.map((l, n) => {
                const status = data.statusOf(l.id);
                const prereqs = (l.prerequisites ?? []).map((p) => titles.get(p) ?? null).filter((t): t is string => !!t);
                return (
                  <li key={l.id} className="rounded-sm border border-line bg-surface p-4">
                    <Link href={`/learn/${l.id}`} className={`group block min-h-[44px] ${linkFocus}`}>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Lesson {n + 1}</span>
                      <span className="mt-1 block font-sans text-[16px] font-semibold text-ink group-hover:text-cyan">{l.title}</span>
                    </Link>
                    <p className="mt-2 flex flex-wrap items-center gap-3 font-ui text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <IconClock className="h-3 w-3" aria-hidden="true" /> {l.estimated_minutes} min
                      </span>
                      <span className={`inline-flex items-center gap-1 ${status === "completed" ? "text-success" : ""}`}>
                        {status === "completed" && <IconCheck className="h-3 w-3" aria-hidden="true" />}
                        {status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not started"}
                      </span>
                    </p>
                    {prereqs.length > 0 && <p className="mt-2 font-sans text-[13px] text-muted">Builds on: {prereqs.join("; ")}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {questions.length > 0 && (
          <section aria-labelledby="checkpoint-h">
            <h2 id="checkpoint-h" className="font-ui text-sm font-bold uppercase tracking-wider text-cyan">
              Module checkpoint
            </h2>
            <p className="mt-1 font-sans text-sm text-muted">
              {questions.length} questions drawn from this module&apos;s lessons. Use it to check what has stuck; answers are not saved and earn no XP.
            </p>
            <TerminalCheck questions={questions} initialPassed={[]} answer={answerCheckpointAction.bind(null, mod.key)} variant="readable" />
          </section>
        )}

        <nav aria-label="Module navigation" className="flex flex-col gap-3 font-ui text-sm sm:flex-row sm:justify-between">
          {prev ? (
            <Link href={`${SOC_TRACK_BASE}/${prev.key}`} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-line px-4 text-ink hover:text-cyan ${linkFocus}`}>
              <IconChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`${SOC_TRACK_BASE}/${next.key}`} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xs border border-line px-4 text-ink hover:text-cyan ${linkFocus}`}>
              {next.title} <IconChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
