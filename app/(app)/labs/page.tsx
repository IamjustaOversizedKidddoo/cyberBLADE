import type { Metadata } from "next";
import { HeroBand } from "@/components/theme/HeroBand";
import { LabsDirectory } from "@/components/labs/LabsDirectory";
import { listLabs } from "@/lib/lab-engine/labs";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import Link from "next/link";
import { isSocExamsEnabled, isSocWorkspaceEnabled } from "@/lib/config/env";

export const metadata: Metadata = { title: "Tactical Labs Range · CyberBLADE" };

export default async function LabsIndexPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const socEnabled = isSocWorkspaceEnabled();

  const [allRawLabs, allLessons, attempts] = await Promise.all([
    listLabs(),
    getLessons({ track: "core" }),
    ctx.repo.listAttempts(operator.id),
  ]);

  const rawLabs = socEnabled ? allRawLabs : allRawLabs.filter((l) => l.type !== "soc");

  // Build lesson lookup: labId -> Lesson
  const lessonByLab = new Map<string, { id: string; title: string }>();
  for (const l of allLessons) {
    if (l.lab) {
      lessonByLab.set(l.lab, { id: l.id, title: l.title });
    }
  }

  // Set of solved lab IDs
  const solvedLabIds = new Set(
    attempts.filter((a) => a.completedAt !== null).map((a) => a.labId),
  );

  const labSummaries = rawLabs.map((l) => {
    const linked = lessonByLab.get(l.id);
    return {
      id: l.id,
      title: l.title,
      type: l.type,
      rank: l.rank,
      estimatedMinutes: l.estimated_minutes,
      xp: l.xp,
      mitre: l.mitre,
      isChallenge: Boolean(l.challenge),
      solved: solvedLabIds.has(l.id),
      linkedLessonId: linked?.id,
      linkedLessonTitle: linked?.title,
    };
  });

  return (
    <main>
      <HeroBand
        title="tactical_labs_range"
        kicker={`> BROWSE & DEPLOY · ${rawLabs.length} SIMULATED LABS · TERMINAL / PACKET / WEBAPP / SIEM / SOC`}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {socEnabled && isSocExamsEnabled() && (
          <p className="mb-8 flex flex-wrap items-center gap-3 rounded-xs border border-line bg-surface p-4 font-sans text-sm text-secondary">
            <span>Ready to test yourself under time? SOC practice exams are timed, unproctored and provisional.</span>
            <Link href="/labs/soc/exams" className="inline-flex min-h-[44px] items-center rounded-xs border border-cyan px-4 font-ui text-cyan hover:bg-cyan/15">Open practice exams</Link>
          </p>
        )}
        <LabsDirectory labs={labSummaries} operatorRank={operator.rank} />
      </div>
    </main>
  );
}
