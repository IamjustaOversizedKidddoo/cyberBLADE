"use server";

import { redirect } from "next/navigation";
import { requireOperator, clearOperatorCookie } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { logSecurityEvent } from "@/lib/security/audit-logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAiGradingStore } from "@/lib/lab-engine/soc/ai-grading/runtime";
import { buildLearnerExport } from "./learner-export";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Exports all data held for the authenticated operator as a JSON object (Right to Portability / Access).
 */
export async function exportUserDataAction() {
  const operator = await requireOperator();
  const ctx = getCtx();
  if (!(await rateLimit(`data_export:${operator.id}`, 5, 3_600_000)).allowed) {
    throw new Error("You can export your data a few times per hour. Please try again later.");
  }

  // Allowlisted per table (S6): no seeds, scenario hashes, ground truth, raw AI outputs or prompts.
  const progress = await buildLearnerExport(ctx, operator.id, await getAiGradingStore().exportUserData(operator.id));

  return {
    exportedAt: new Date().toISOString(),
    operator: {
      id: operator.id,
      handle: operator.handle,
      rank: operator.rank,
      ethicsAcceptedAt: operator.ethicsAcceptedAt,
      createdAt: operator.createdAt,
    },
    progress,
  };
}


/**
 * Hard-deletes the authenticated operator account and cascades removal across all progress records (Right to Erasure).
 * Logs an anonymized audit entry and invalidates active sessions.
 */
export async function deleteAccountAction() {
  const operator = await requireOperator();
  const ctx = getCtx();

  // 1. Audit account deletion without preserving PII
  await logSecurityEvent({
    userId: null,
    eventType: "account.deleted",
    severity: "info",
    metadata: { anonymized_id: operator.id },
  });

  // 2. Cascade deletion in progress repository (covers SOC attempts/decisions/cases)
  await ctx.repo.deleteUserData(operator.id);
  // AI grading rows, raw outputs, review items, requests, consent and usage counters.
  await getAiGradingStore().deleteUserData(operator.id);

  // 3. Cascade deletion in operator store
  await ctx.operators.delete(operator.id);

  // 4. Invalidate Supabase session if present
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore error if session already revoked
    }
  }

  // 4. Clear operator cookie and redirect
  await clearOperatorCookie();
  redirect("/");
}
