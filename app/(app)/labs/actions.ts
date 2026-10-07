"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { submitObjective } from "@/lib/progress/service";

const args = z.tuple([z.string().min(1).max(100), z.string().min(1).max(50), z.string().max(500)]);

/** Bound to an attempt id on the server; answers are checked server-side against the regenerated key. */
export async function submitObjectiveAction(attemptId: string, objectiveId: string, answer: string) {
  const [a, o, text] = args.parse([attemptId, objectiveId, answer]);
  const operator = await requireOperator();
  return submitObjective(getCtx(), operator.id, a, o, text);
}
