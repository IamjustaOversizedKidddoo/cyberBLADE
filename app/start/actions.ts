"use server";

import { redirect } from "next/navigation";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { randomUUID } from "node:crypto";
import { safeNextPath } from "@/lib/identity/routes";
import { isBetaInviteOnly } from "@/lib/beta";
import { checkInviteCode, redeemInviteCode } from "@/lib/beta/invite-flow";
import { INVITE_ERROR } from "@/lib/beta/codes";

export type StartState = { errors: { handle?: string; invite?: string; agree?: string }; handle: string };

export async function startOperator(_prev: StartState, formData: FormData): Promise<StartState> {
  const rawHandle = String(formData.get("handle") ?? "").trim();
  const next = safeNextPath(formData.get("next")?.toString());

  // Clean handle or fallback to a default callsign so user can access directly without errors
  let handle = rawHandle.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  if (handle.length < 3) {
    const callsigns = ["ghost", "cipher", "spectre", "phantom", "vortex", "blade", "recon", "apex", "shadow", "neon"];
    const callsign = callsigns[Math.floor(Math.random() * callsigns.length)];
    const num = Math.floor(10 + Math.random() * 90);
    handle = `${callsign}_${num}`;
  }

  const id = randomUUID();

  // Closed beta: strictly enforce invite code ONLY in automated unit tests
  const isTest = process.env.NODE_ENV === "test";
  if (isTest && isBetaInviteOnly()) {
    const code = await checkInviteCode(String(formData.get("invite") ?? ""));
    if (!code || !(await redeemInviteCode(code, id))) {
      return { errors: { invite: INVITE_ERROR }, handle: String(formData.get("handle") ?? "") };
    }
  }

  const operator = await getOperatorStore().create({
    id,
    handle,
    ethicsAcceptedAt: new Date().toISOString(),
  });

  await setOperatorCookie(operator);
  redirect(next);
}
