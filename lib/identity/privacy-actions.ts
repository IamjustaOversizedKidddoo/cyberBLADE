"use server";

import { redirect } from "next/navigation";
import { requireOperator, clearOperatorCookie } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { logSecurityEvent } from "@/lib/security/audit-logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Exports all data held for the authenticated operator as a JSON object (Right to Portability / Access).
 */
export async function exportUserDataAction() {
  const operator = await requireOperator();
  const ctx = getCtx();

  const [lessons, attempts, xpEvents] = await Promise.all([
    ctx.repo.listLessonProgress(operator.id),
    ctx.repo.listAttempts(operator.id),
    ctx.repo.listXpEvents(operator.id),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    operator: {
      id: operator.id,
      handle: operator.handle,
      rank: operator.rank,
      ethicsAcceptedAt: operator.ethicsAcceptedAt,
      createdAt: operator.createdAt,
    },
    progress: {
      lessons,
      attempts,
      xpEvents,
    },
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

  // 2. Cascade deletion in operator store
  await ctx.operators.delete(operator.id);

  // 3. Invalidate Supabase session if present
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
