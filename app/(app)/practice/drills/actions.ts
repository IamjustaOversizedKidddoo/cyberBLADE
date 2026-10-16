"use server";

/**
 * Runs a learner's BladeQL query against the fixed drill dataset and checks it on the server.
 * The reference query never leaves the server; the learner sees their own results and a verdict.
 * Formative practice: no XP.
 */
import { z } from "zod";
import { isSocQueryEnabled } from "@/lib/config/env";
import { requireOperator } from "@/lib/identity/session";
import { canAccessRank } from "@/lib/progress/access";
import { rateLimit } from "@/lib/security/rate-limit";
import { checkDrillAnswer, drillIds, type DrillCheckResult } from "@/lib/lab-engine/soc/query/drill-check";
import { DRILL_MIN_RANK } from "./rank";

export async function runDrillAction(drillId: string, query: string): Promise<DrillCheckResult> {
  const operator = await requireOperator();
  if (!isSocQueryEnabled()) throw new Error("Query drills are not enabled.");
  if (!canAccessRank(operator.rank, DRILL_MIN_RANK)) throw new Error("Drill not available.");
  const id = z.string().regex(/^drill-\d{2}$/).parse(drillId);
  if (!drillIds().includes(id)) throw new Error("Drill not available.");
  const q = z.string().min(1).max(2000).parse(query);
  const rate = await rateLimit(`bladeql_drill:${operator.id}`, 30, 60_000);
  if (!rate.allowed) throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s.`);
  return checkDrillAnswer(id, q);
}
