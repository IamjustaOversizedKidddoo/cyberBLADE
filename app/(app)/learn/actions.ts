"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { answerCheck } from "@/lib/progress/service";

const args = z.tuple([z.string().min(1).max(100), z.string().min(1).max(50), z.number().int().min(0).max(10)]);

/** Bound to a lesson id on the server; the browser supplies the question and the chosen option. */
export async function answerCheckAction(lessonId: string, questionId: string, optionIndex: number) {
  const [l, q, o] = args.parse([lessonId, questionId, optionIndex]);
  const operator = await requireOperator();
  return answerCheck(getCtx(), operator.id, l, q, o);
}
