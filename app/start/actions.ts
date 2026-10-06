"use server";

import { redirect } from "next/navigation";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { parseStartForm } from "@/lib/identity/validation";

export type StartState = { errors: { handle?: string; agree?: string }; handle: string };

export async function startOperator(_prev: StartState, formData: FormData): Promise<StartState> {
  const result = parseStartForm(formData);
  if (!result.ok) {
    return { errors: result.errors, handle: String(formData.get("handle") ?? "") };
  }
  const operator = await getOperatorStore().create({
    handle: result.handle,
    ethicsAcceptedAt: new Date().toISOString(),
  });
  await setOperatorCookie(operator.id);
  redirect(result.next);
}
