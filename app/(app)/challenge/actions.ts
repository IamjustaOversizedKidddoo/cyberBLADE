"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank } from "@/lib/progress/access";
import { abandonChallenge, startChallenge, submitChallengeObjective } from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";
import { rateLimit } from "@/lib/security/rate-limit";

const rankSchema = z.number().int().min(0).max(2);

export async function startChallengeAction(rank: number) {
  const r = rankSchema.parse(rank);
  const operator = await requireOperator();
  if (!canAccessRank(operator.rank, r)) {
    redirect(`/learn/core?locked=${r}`);
  }

  try {
    await startChallenge(getCtx(), operator.id, r);
  } catch {
    // Already running, cooling down or passed (stale tab, double click): the page shows the real state.
  }
  redirect(`/challenge/${r}`);
}

export async function submitChallengeObjectiveAction(attemptId: string, objectiveId: string, answer: string) {
  const [a, o, text] = z.tuple([z.string().min(1).max(100), z.string().min(1).max(50), z.string().max(500)]).parse([attemptId, objectiveId, answer]);
  const operator = await requireOperator();

  const rate = await rateLimit(`sub:${operator.id}`, 10, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded: too many submissions. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s before trying again.`);
  }

  return submitChallengeObjective(getCtx(), operator.id, a, o, text);
}

export async function abandonChallengeAction(attemptId: string, rank: number) {
  const a = z.string().min(1).max(100).parse(attemptId);
  const r = rankSchema.parse(rank);
  const operator = await requireOperator();
  await abandonChallenge(getCtx(), operator.id, a);
  redirect(`/challenge/${r}`);
}
