import type { Metadata } from "next";
import Link from "next/link";
import { DailyReviewSession } from "@/components/review/DailyReviewSession";
import { HeroBand } from "@/components/theme/HeroBand";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { buildReviewQueue, type UserReviewItem } from "@/lib/review/session";

export const metadata: Metadata = {
  title: "Daily Review · CyberBLADE",
  description: "Spaced retrieval practice drill using SuperMemo 2 (SM-2) scheduling.",
};

export default async function ReviewPage() {
  const operator = await requireOperator();
  const ctx = getCtx();
  const rawItems = await ctx.repo.listReviewItems(operator.id);

  const userItems: UserReviewItem[] = rawItems.map((r) => ({
    id: r.id,
    userId: r.userId,
    cardId: r.cardId,
    lessonId: r.lessonId,
    state: {
      easeFactor: r.easeFactor,
      intervalDays: r.intervalDays,
      repetitions: r.repetitions,
      lapses: r.lapses,
      dueAt: r.dueAt,
      lastReviewedAt: r.lastReviewedAt,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const queue = buildReviewQueue(userItems, operator.rank, ctx.now());

  return (
    <main>
      <HeroBand
        title="SPACED RETRIEVAL DRILL"
        kicker="> review · SM-2 engine · 5 XP per target"
      />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="neon-toggle text-xs"
          >
            ← Back to Dashboard
          </Link>

          <span className="font-mono text-xs text-muted">
            OPERATOR: {operator.handle.toUpperCase()} // RANK_{operator.rank}
          </span>
        </div>

        <DailyReviewSession initialQueue={queue} />
      </div>
    </main>
  );
}
