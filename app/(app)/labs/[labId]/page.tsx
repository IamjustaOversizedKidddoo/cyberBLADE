import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabWorkspace } from "@/components/labs/LabWorkspace";
import { proseComponents } from "@/components/lesson/prose";
import { HeroBand } from "@/components/theme/HeroBand";
import { renderMdx } from "@/lib/content/mdx";
import { requireOperator } from "@/lib/identity/session";
import type { LoadedLab } from "@/lib/lab-engine/lab-schema";
import { loadLab } from "@/lib/lab-engine/labs";
import { getCtx } from "@/lib/progress/context";
import { startLab } from "@/lib/progress/service";
import { submitObjectiveAction } from "../actions";

async function findLab(labId: string): Promise<LoadedLab | null> {
  try {
    return await loadLab(labId);
  } catch {
    return null;
  }
}

export async function generateMetadata(props: PageProps<"/labs/[labId]">): Promise<Metadata> {
  const lab = await findLab((await props.params).labId);
  return { title: lab?.title ?? "Lab" };
}

export default async function LabPage(props: PageProps<"/labs/[labId]">) {
  const { labId } = await props.params;
  const { lesson } = await props.searchParams;
  const lab = await findLab(labId);
  // Rank challenges are only reachable through /challenge (timed, separate attempts).
  if (!lab || lab.challenge) notFound();

  const operator = await requireOperator();
  const session = await startLab(getCtx(), operator.id, lab.id);
  const briefing = await renderMdx(lab.briefingText, proseComponents, "md");
  const back = typeof lesson === "string" && /^[a-z0-9-]+$/.test(lesson) ? `/learn/${lesson}` : "/learn/core";

  return (
    <main>
      <HeroBand title={lab.title} kicker={`> lab · ${lab.estimated_minutes} min · ${lab.xp} XP`} />
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <Link href={back} className="neon-toggle">
          ← Back to the lesson
        </Link>
        <section aria-labelledby="briefing-heading" className="max-w-[72ch]">
          <h2 id="briefing-heading" className="mb-4 text-3xl">
            briefing
          </h2>
          {briefing}
        </section>
        <LabWorkspace
          world={session.world}
          objectives={session.objectives}
          onSubmit={submitObjectiveAction.bind(null, session.attemptId)}
        />
      </div>
    </main>
  );
}
