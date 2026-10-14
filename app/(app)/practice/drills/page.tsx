import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HeroBand } from "@/components/theme/HeroBand";
import { isSocQueryEnabled } from "@/lib/config/env";
import { requireOperator } from "@/lib/identity/session";
import { publicDrills } from "@/lib/lab-engine/soc/query/drill-check";
import { canAccessRank } from "@/lib/progress/access";
import { DRILL_MIN_RANK } from "./rank";

export const metadata: Metadata = { title: "Query drills · CyberBLADE" };

export default async function DrillsPage() {
  const operator = await requireOperator();
  if (!isSocQueryEnabled()) notFound();
  if (!canAccessRank(operator.rank, DRILL_MIN_RANK)) redirect(`/learn/core?locked=${DRILL_MIN_RANK}`);
  const drills = publicDrills();
  const categories = [...new Set(drills.map((d) => d.category))];
  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand title="Query drills" kicker={`> soc_l1 · bladeql · ${drills.length} drills`}>
        Short practice queries on one small, fixed log dataset. Answers are checked on the server; nothing here counts toward XP.
      </HeroBand>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        {categories.map((c) => (
          <section key={c} aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="mb-3 font-ui text-sm font-bold uppercase tracking-wider text-cyan">
              {c}
            </h2>
            <ol className="divide-y divide-line rounded-sm border border-line bg-surface">
              {drills
                .filter((d) => d.category === c)
                .map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/practice/drills/${d.id}`}
                      className="flex min-h-[44px] items-center px-4 py-2 font-sans text-[15px] text-ink transition-colors duration-150 hover:bg-surface-raised hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan"
                    >
                      {d.title}
                    </Link>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
