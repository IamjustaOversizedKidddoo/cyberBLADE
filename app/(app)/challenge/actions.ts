"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { abandonChallenge, startChallenge, submitChallengeObjective } from "@/lib/progress/challenge";
import { getCtx } from "@/lib/progress/context";

const rankSchema = z.number().int().min(0).max(2);

export async function startChallengeAction(rank: number) {
  const r = rankSchema.parse(rank);
  const operator = await requireOperator();
  await startChallenge(getCtx(), operator.id, r);
  redirect(`/challenge/${r}`);
}

export async function submitChallengeObjectiveAction(attemptId: string, objectiveId: string, answer: string) {
  const [a, o, text] = z.tuple([z.string().min(1).max(100), z.string().min(1).max(50), z.string().max(500)]).parse([attemptId, objectiveId, answer]);
  const operator = await requireOperator();
  return submitChallengeObjective(getCtx(), operator.id, a, o, text);
}

export async function abandonChallengeAction(attemptId: string, rank: number) {
  const a = z.string().min(1).max(100).parse(attemptId);
  const r = rankSchema.parse(rank);
  const operator = await requireOperator();
  await abandonChallenge(getCtx(), operator.id, a);
  redirect(`/challenge/${r}`);
}
