import type { Metadata } from "next";
import { CourseMap } from "@/components/dashboard/CourseMap";
import { HeroBand } from "@/components/theme/HeroBand";
import { requireOperator } from "@/lib/identity/session";
import { rankName } from "@/lib/progress/ranks";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const operator = await requireOperator();
  return (
    <main>
      <HeroBand title={`rank_${operator.rank}`} kicker={`> welcome, ${operator.handle}`}>
        <p>
          Rank {operator.rank} · {rankName(operator.rank)}
        </p>
      </HeroBand>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <CourseMap currentRank={operator.rank} />
      </div>
    </main>
  );
}
