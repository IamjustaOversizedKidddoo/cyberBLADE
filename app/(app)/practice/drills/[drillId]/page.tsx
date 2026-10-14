import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogBlock } from "@/components/lesson/LogBlock";
import { DrillRunner } from "@/components/practice/DrillRunner";
import { HeroBand } from "@/components/theme/HeroBand";
import { isSocQueryEnabled } from "@/lib/config/env";
import { requireOperator } from "@/lib/identity/session";
import { drillDatasetView, getPublicDrill, publicDrills } from "@/lib/lab-engine/soc/query/drill-check";
import { canAccessRank } from "@/lib/progress/access";
import { runDrillAction } from "../actions";
import { DRILL_MIN_RANK } from "../rank";

export const metadata: Metadata = { title: "Query drill · CyberBLADE" };

export default async function DrillPage({ params }: { params: Promise<{ drillId: string }> }) {
  const operator = await requireOperator();
  if (!isSocQueryEnabled()) notFound();
  if (!canAccessRank(operator.rank, DRILL_MIN_RANK)) redirect(`/learn/core?locked=${DRILL_MIN_RANK}`);
  const { drillId } = await params;
  const drill = getPublicDrill(drillId);
  if (!drill) notFound();
  const all = publicDrills();
  const next = all.find((d) => d.order === drill.order + 1);
  const data = drillDatasetView();

  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand title={drill.title.replace(/^\d+\.\s*/, "")} kicker={`> drill_${String(drill.order).padStart(2, "0")} · ${drill.category}`} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <nav aria-label="Drill navigation" className="flex flex-wrap gap-4 font-ui text-sm">
          <Link href="/practice/drills" className="text-cyan underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
            All drills
          </Link>
          {next && (
            <Link href={`/practice/drills/${next.id}`} className="text-cyan underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              Next: {next.title}
            </Link>
          )}
        </nav>
        <section aria-labelledby="task" className="rounded-sm border border-line bg-surface p-4">
          <h2 id="task" className="mb-2 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
            Task
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink">{drill.prompt.replace(/`/g, "")}</p>
        </section>
        <DrillRunner drill={drill} run={runDrillAction.bind(null, drill.id)} />
        <section aria-labelledby="data">
          <h2 id="data" className="mb-2 font-ui text-sm font-bold uppercase tracking-wider text-muted">
            The practice dataset
          </h2>
          <p className="font-sans text-[14px] text-muted">
            Fields you can query: <span className="font-mono text-ink">{data.fields.join(", ")}</span>
          </p>
          <LogBlock title={`Drill dataset (${data.lines.length} synthetic events)`} lines={data.lines} />
        </section>
      </div>
    </main>
  );
}
