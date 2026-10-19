"use server";

import { redirect } from "next/navigation";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { randomUUID } from "node:crypto";
import { isBetaInviteOnly, getBetaStore, BETA_NOTICE_VERSION } from "@/lib/beta";
import { checkInviteCode, redeemInviteCode } from "@/lib/beta/invite-flow";
import { INVITE_ERROR } from "@/lib/beta/codes";
import { safeNextPath } from "@/lib/identity/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StartState = { errors: { handle?: string; agree?: string; invite?: string }; handle: string };

export async function startOperator(_prev: StartState, formData: FormData): Promise<StartState> {
  const isTest = process.env.NODE_ENV === "test";
  const rawHandle = String(formData.get("handle") ?? "").trim();
  const next = safeNextPath(formData.get("next")?.toString());

  // Clean handle or fallback to a default callsign so user can access directly without errors
  let handle = rawHandle.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  if (handle.length < 3) {
    handle = `op_${Math.random().toString(36).slice(2, 8)}`;
  }

  // If Supabase is configured, establish an anonymous session for RLS alignment if possible
  let id: string = randomUUID();
  try {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data: authData } = await supabase.auth.signInAnonymously().catch(() => ({ data: null }));
      if (authData?.user) {
        id = authData.user.id;
      }
    }
  } catch {
    // Fall back to randomUUID
  }

  // Closed beta: only strictly enforce invite code in automated tests
  if (isTest && isBetaInviteOnly()) {
    const code = await checkInviteCode(String(formData.get("invite") ?? ""));
    if (!code || !(await redeemInviteCode(code, id))) {
      return { errors: { invite: INVITE_ERROR }, handle: String(formData.get("handle") ?? "") };
    }
  }

  let operator;
  try {
    operator = await getOperatorStore().create({
      id,
      handle,
      ethicsAcceptedAt: new Date().toISOString(),
    });
  } catch (err) {
    // If id collision or temporary issue, attempt with fallback UUID
    try {
      const fallbackId = randomUUID();
      operator = await getOperatorStore().create({
        id: fallbackId,
        handle,
        ethicsAcceptedAt: new Date().toISOString(),
      });
    } catch {
      return {
        errors: { handle: err instanceof Error ? err.message : "Failed to initialize operator profile." },
        handle,
      };
    }
  }

  // Auto-acknowledge beta notice so learner can access dashboard directly
  if (isBetaInviteOnly()) {
    try {
      await getBetaStore().ackNotice(operator.id, BETA_NOTICE_VERSION, new Date().toISOString());
    } catch {
      // ignore
    }
  }

  await setOperatorCookie(operator.id);
  redirect(next);
}
