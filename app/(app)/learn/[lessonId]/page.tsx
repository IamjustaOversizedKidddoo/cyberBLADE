import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/components/lesson/Callout";
import { DraftBanner } from "@/components/lesson/DraftBanner";
import { LessonNav } from "@/components/lesson/LessonNav";
import { proseComponents } from "@/components/lesson/prose";
import { TerminalCheck } from "@/components/lesson/TerminalCheck";
import { HeroBand } from "@/components/theme/HeroBand";
import { toPublicChecks } from "@/lib/content/checks";
import { loadChecks } from "@/lib/content/checks-server";
import { getLesson, getLessons } from "@/lib/content/lessons";
import { renderMdx } from "@/lib/content/mdx";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { answerCheckAction } from "../actions";

export async function generateMetadata(props: PageProps<"/learn/[lessonId]">): Promise<Metadata> {
  const lesson = await getLesson((await props.params).lessonId);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage(props: PageProps<"/learn/[lessonId]">) {
  const { lessonId } = await props.params;
  const lesson = await getLesson(lessonId);
  if (!lesson) notFound();

  const operator = await requireOperator();
  const ctx = getCtx();
  const [checks, progress, siblings] = await Promise.all([
    loadChecks(lesson.id),
    ctx.repo.getLessonProgress(operator.id, lesson.id),
    getLessons({ rank: lesson.rank, track: lesson.track }),
  ]);
  const labDone = lesson.lab ? await ctx.repo.hasCompletedAttempt(operator.id, lesson.lab, "practice") : false;
  const completed = progress?.status === "completed";

  const body = await renderMdx(lesson.body, {
    ...proseComponents,
    Callout,
    TerminalCheck: () => (
      <TerminalCheck
        questions={toPublicChecks(checks)}
        initialPassed={progress?.checksPassed ?? []}
        answer={answerCheckAction.bind(null, lesson.id)}
      />
    ),
    LabLink: () =>
      lesson.lab ? (
        <p className="my-6">
          <Link
            href={`/labs/${lesson.lab}?lesson=${lesson.id}`}
            className="inline-block border border-cyan px-5 py-2 font-ui text-lg text-cyan hover:bg-cyan hover:text-void"
          >
            {labDone ? "✓ Lab solved — open again" : "Open the lab"}
          </Link>
        </p>
      ) : null,
  });

  return (
    <main>
      <DraftBanner status={lesson.status} />
      <HeroBand title={lesson.title} kicker={`> rank_${lesson.rank} · ${lesson.module} · ${lesson.estimated_minutes} min`}>
        <p>
          {completed ? "✓ Completed" : `${lesson.xp} XP`}
          {lesson.mitre.length > 0 && ` · MITRE ATT&CK ${lesson.mitre.join(", ")}`}
        </p>
      </HeroBand>
      <article className="mx-auto max-w-[72ch] px-4 py-12">
        {body}
        <div className="mt-16">
          <LessonNav lessons={siblings} currentId={lesson.id} />
        </div>
      </article>
    </main>
  );
}
