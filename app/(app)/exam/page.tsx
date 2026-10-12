import type { Metadata } from "next";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import { CertReadinessSection } from "@/components/dashboard/CertReadinessSection";
import { ExamReportDialog } from "@/components/exam/ExamReportDialog";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLessons } from "@/lib/content/lessons";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { calculateCertReadiness } from "@/lib/readiness/calculator";

export const metadata: Metadata = { title: "Exam Readiness · CyberBLADE" };

export default async function ExamReadinessPage() {
  const operator = await requireOperator();
  const ctx = getCtx();

  const [allLessons, progress, reports] = await Promise.all([
    getLessons({ track: "core" }),
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.listExamReports(operator.id),
  ]);

  const completedLessonIds = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.lessonId),
  );

  const readiness = await calculateCertReadiness({
    completedLessonIds,
    lessons: allLessons,
  });

  const totalObjectives = readiness.reduce((sum, c) => sum + c.totalObjectives, 0);
  const completedObjectives = readiness.reduce((sum, c) => sum + c.completedObjectives, 0);
  const overallPct = totalObjectives > 0 ? Math.round((completedObjectives / totalObjectives) * 100) : 0;

  return (
    <main>
      <HeroBand
        title="exam_readiness_engine"
        kicker={`> CERTIFICATION PREPARATION MATRIX · ${readiness.length} TRACKED CERTS · ${overallPct}% OVERALL MASTERY`}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-10">
        {/* Strategic Overview Dossier */}
        <div className="rounded-xs border border-line bg-console p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-5">
            <div>
              <span className="font-ui text-xs text-cyan tracking-widest uppercase block mb-1">
                COMPREHENSIVE AUDIT REPORT // OPERATOR {operator.handle.toUpperCase()}
              </span>
              <h2 className="font-display text-2xl text-ink">
                INDUSTRY CREDENTIAL ALIGNMENT MATRIX
              </h2>
            </div>
            <div className="rounded-xs border border-cyan/40 bg-cyan/10 px-4 py-2 font-mono text-cyan text-sm">
              OVERALL READINESS: <strong className="text-ink">{overallPct}%</strong>
            </div>
          </div>

          <p className="mt-4 font-sans text-sm text-muted leading-relaxed max-w-4xl">
            CYBERBLADE maps every hands-on lesson and terminal check directly against the published objective domains
            of premier industry credentials. Completing the shared core provides verified practical mastery across
            CompTIA Security+, Network+, A+ (Security), and ISC2 CC.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3 font-ui text-xs">
            <div className="rounded-xs border border-line/80 bg-void p-3.5">
              <span className="text-muted block">TOTAL OBJECTIVES</span>
              <span className="font-mono text-xl font-bold text-ink mt-1 block">
                {completedObjectives} / {totalObjectives}
              </span>
            </div>
            <div className="rounded-xs border border-line/80 bg-void p-3.5">
              <span className="text-muted block">EXAM TARGETS</span>
              <span className="font-mono text-xl font-bold text-cyan mt-1 block">
                {readiness.length} Tracked
              </span>
            </div>
            <div className="rounded-xs border border-line/80 bg-void p-3.5">
              <span className="text-muted block">CURRENT OPERATOR CLEARANCE</span>
              <span className="font-mono text-xl font-bold text-purple mt-1 block">
                Rank {operator.rank}
              </span>
            </div>
          </div>
        </div>

        {/* Analytical Disclaimer */}
        <Callout variant="info" title="READINESS ESTIMATE & OBJECTIVE COVERAGE">
          Readiness percentages reflect completed hands-on lessons and verified terminal checks mapped to official certification domain objectives. Scores represent estimated practical knowledge alignment to guide your preparation, not an accredited examination score guarantee.
        </Callout>

        {/* Interactive Readiness Section with Objective Audit Breakdowns */}
        {readiness.length === 0 ? (
          <EmptyState
            title="No certification blueprints tracked"
            description="The exam readiness engine has not mapped any credential blueprints for this learning track."
          />
        ) : (
          <CertReadinessSection readiness={readiness} />
        )}

        {/* Real-World Exam Verification Self-Report Ledger */}
        <ExamReportDialog reports={reports} />

        {/* Quick Links Back to Study */}
        <div className="rounded-xs border border-line/80 bg-console-deep p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-ui text-base font-bold text-ink">
              READY TO CLOSE KNOWLEDGE GAPS?
            </h3>
            <p className="font-ui text-xs text-muted mt-0.5">
              Return to the curriculum to complete lessons and hands-on labs covering pending objectives.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/learn/core"
              className="rounded-xs border border-cyan px-5 py-2 font-ui text-xs text-cyan hover:bg-cyan hover:text-void transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              OPEN COURSE MAP →
            </Link>
            <Link
              href="/labs"
              className="rounded-xs border border-purple px-5 py-2 font-ui text-xs text-purple hover:bg-purple hover:text-void transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-purple"
            >
              VISIT LABS RANGE →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

