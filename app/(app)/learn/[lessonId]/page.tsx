import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { socPracticeFlags } from "@/lib/config/env";
import { practiceTargetAvailable } from "@/lib/content/practice-availability";
import { GlossaryTerm } from "@/components/lesson/GlossaryTerm";
import { buildGlossary, groupModules, SOC_TRACK_BASE, tooltipTerms } from "@/lib/content/soc-curriculum";
import { keyTermsOf } from "@/lib/content/soc-lesson-lint";
import { loadTrackConfig } from "@/lib/content/soc-track";
import { remarkGlossary } from "@/lib/content/remark-glossary";
import { HandlerDrawer } from "@/components/handler/HandlerDrawer";
import { Callout } from "@/components/lesson/Callout";
import { DraftBanner } from "@/components/lesson/DraftBanner";
import { LessonNav } from "@/components/lesson/LessonNav";
import { proseComponents } from "@/components/lesson/prose";
import { TerminalCheck } from "@/components/lesson/TerminalCheck";
import { ReadingProgress } from "@/components/lesson/ReadingProgress";
import { TableOfContents } from "@/components/lesson/TableOfContents";
import { HeroBand } from "@/components/theme/HeroBand";
import { toPublicChecks } from "@/lib/content/checks";
import { loadChecks } from "@/lib/content/checks-server";
import { getLesson, getLessons } from "@/lib/content/lessons";
import { renderMdx, type PluggableList } from "@/lib/content/mdx";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank } from "@/lib/progress/access";
import { getCtx } from "@/lib/progress/context";
import { IconCheck, IconTerminal } from "@/components/ui/icons";
import { answerCheckAction } from "../actions";
import { checkLessonExerciseAction } from "../exercise-actions";
import { FlowDiagram } from "@/components/lesson/FlowDiagram";
import { KeyTerms } from "@/components/lesson/KeyTerms";
import { LogBlock } from "@/components/lesson/LogBlock";
import { MicroExercise } from "@/components/lesson/MicroExercise";
import { PracticeThis } from "@/components/lesson/PracticeThis";
import { loadExercises } from "@/lib/content/exercises-server";
import { toPublicExercises } from "@/lib/content/exercises";
import { resolvePracticeTarget, type PracticeCard } from "@/lib/content/practice";

export async function generateMetadata(props: PageProps<"/learn/[lessonId]">): Promise<Metadata> {
  const lesson = await getLesson((await props.params).lessonId);
  return { title: `${lesson?.title ?? "Lesson"} · CyberBLADE` };
}

export default async function LessonPage(props: PageProps<"/learn/[lessonId]">) {
  const { lessonId } = await props.params;
  const lesson = await getLesson(lessonId);
  if (!lesson) notFound();

  const operator = await requireOperator();
  if (!canAccessRank(operator.rank, lesson.rank)) redirect(`/learn/core?locked=${lesson.rank}`);
  const ctx = getCtx();
  const [checks, progress, siblings, exerciseSet, allLessons] = await Promise.all([
    loadChecks(lesson.id),
    ctx.repo.getLessonProgress(operator.id, lesson.id),
    getLessons({ rank: lesson.rank, track: lesson.track }),
    loadExercises(lesson.id),
    lesson.practice?.length || lesson.track === "soc" ? getLessons() : Promise.resolve([]),
  ]);
  // Track lessons (SOC L1): exercises are checked server-side; practice targets resolve to real pages.
  const exercises = exerciseSet ? toPublicExercises(exerciseSet) : {};
  const practiceCards = (lesson.practice ?? [])
    .map((t) => resolvePracticeTarget(t, (id) => allLessons.find((l) => l.id === id)?.title ?? null))
    .filter((c): c is PracticeCard => typeof c !== "string")
    // Practice pages sit behind SOC feature flags; hide cards whose feature is off rather than link
    // to a "not enabled" page (drills: query flag; scenarios, shifts, reports: workspace; tools: enrichment).
    .filter((c) => practiceTargetAvailable(c.target, socPracticeFlags()));
  const labDone = lesson.lab ? await ctx.repo.hasCompletedAttempt(operator.id, lesson.lab, "practice") : false;
  const completed = progress?.status === "completed";

  // SOC track: first-use glossary tooltips for terms defined in other lessons, and module breadcrumbs.
  const isSoc = lesson.track === "soc";
  const ownTerms = new Set(keyTermsOf(lesson.body).map((t) => t.term.toLowerCase()));
  const glossaryPlugins: PluggableList = isSoc
    ? [
        [
          remarkGlossary,
          {
            terms: tooltipTerms(buildGlossary(allLessons))
              .filter((g) => !ownTerms.has(g.term.toLowerCase()))
              .map((g) => ({ term: g.term, definition: g.definition, href: `${SOC_TRACK_BASE}/glossary#${g.anchor}` })),
          },
        ],
      ]
    : [];
  const socModule = isSoc ? groupModules(loadTrackConfig(), allLessons).find((m) => m.key === lesson.module) : undefined;
  const socIndex = socModule ? socModule.lessons.findIndex((l) => l.id === lesson.id) : -1;

  const body = await renderMdx(lesson.body, {
    ...proseComponents,
    Callout,
    LogBlock,
    FlowDiagram,
    KeyTerms,
    GlossaryTerm,
    PracticeThis: () => <PracticeThis cards={practiceCards} />,
    MicroExercise: ({ id }: { id: string }) =>
      exercises[id] ? <MicroExercise exercise={exercises[id]} check={checkLessonExerciseAction.bind(null, lesson.id)} /> : null,
    TerminalCheck: () => (
      <TerminalCheck
        questions={toPublicChecks(checks, operator.id)}
        initialPassed={progress?.checksPassed ?? []}
        answer={answerCheckAction.bind(null, lesson.id)}
        variant={isSoc ? "readable" : "terminal"}
        lessonId={lesson.id}
      />
    ),
    LabLink: () =>
      lesson.lab ? (
        <div className="not-prose my-8 rounded-sm border border-cyan/40 bg-surface-raised p-5 shadow-[0_4px_20px_rgba(15,190,255,0.1)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xs border border-cyan/40 bg-cyan/15 flex items-center justify-center text-cyan shrink-0">
                <IconTerminal className="h-5 w-5" />
              </div>
              <div>
                <span className="font-ui text-[11px] text-cyan font-bold tracking-widest uppercase">
                  PRACTICAL LAB WORKSPACE CLEARED
                </span>
                <h4 className="font-sans text-sm font-semibold text-ink">
                  Interactive Hands-On Exercise
                </h4>
              </div>
            </div>
            <Link
              href={`/labs/${lesson.lab}?lesson=${lesson.id}`}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xs border-2 border-cyan bg-cyan/15 px-5 py-2 font-ui text-xs font-bold tracking-wider text-cyan hover:bg-cyan hover:text-void transition-all shadow-[0_0_12px_rgba(15,190,255,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              {labDone ? (
                <>
                  <IconCheck className="h-3.5 w-3.5" />
                  <span>✓ Lab solved — open again</span>
                </>
              ) : (
                <span>Open the lab</span>
              )}
            </Link>
          </div>
        </div>
      ) : null,
  }, "mdx", glossaryPlugins);

  return (
    <main className="min-h-screen bg-canvas text-ink pb-24">
      <ReadingProgress />
      <DraftBanner status={lesson.status} />

      <HeroBand
        title={lesson.title}
        kicker={
          lesson.track === "soc"
            ? `> soc_l1 · ${lesson.module} · ${lesson.estimated_minutes} min`
            : `> rank_${lesson.rank} · ${lesson.module} · ${lesson.estimated_minutes} min`
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-0.5 font-ui text-xs font-semibold uppercase tracking-wider ${
              completed
                ? "border-success/50 bg-success/15 text-success"
                : "border-cyan/40 bg-cyan/10 text-cyan"
            }`}
          >
            {completed ? "✓ COMPLETED" : `${lesson.xp} XP`}
          </span>
          {lesson.mitre.length > 0 && (
            <span className="font-mono text-xs text-muted">
              MITRE ATT&CK: {lesson.mitre.join(", ")}
            </span>
          )}
        </div>
      </HeroBand>

      {/* Main content grid: Article + Sticky Table of Contents */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 flex flex-col xl:flex-row xl:justify-center gap-8 xl:gap-12">
        <article className="w-full min-w-0 max-w-[70ch] leading-relaxed">
          {socModule && (
            <nav aria-label="Breadcrumb" className="mb-6 font-ui text-xs text-muted">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <li>
                  <Link href={SOC_TRACK_BASE} className="text-cyan underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
                    SOC Analyst L1
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`${SOC_TRACK_BASE}/${socModule.key}`} className="text-cyan underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
                    {socModule.title}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">
                  Lesson {socIndex + 1} of {socModule.lessons.length}
                </li>
              </ol>
            </nav>
          )}
          {body}
          <LessonNav lessons={siblings} currentId={lesson.id} />
        </article>

        {/* Sticky Table of Contents */}
        <TableOfContents />
      </div>

      <HandlerDrawer
        context={{
          kind: "lesson",
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          module: lesson.module,
          rank: lesson.rank,
          lessonExcerpt: lesson.body.slice(0, 1500),
        }}
        operatorHandle={operator.handle}
      />
    </main>
  );
}
