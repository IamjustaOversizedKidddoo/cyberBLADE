"use server";

import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/identity/session";
import { BETA_NOTICE_VERSION, getBetaStore } from "@/lib/beta";
import { rateLimit } from "@/lib/security/rate-limit";

/** Records a timestamped acknowledgement of the current beta notice version. */
export async function acknowledgeBetaNoticeAction(): Promise<void> {
  const operator = await requireOperator();
  if (!(await rateLimit(`beta:notice:${operator.id}`, 10, 60_000)).allowed) throw new Error("Too many requests. Please wait a moment.");
  await getBetaStore().ackNotice(operator.id, BETA_NOTICE_VERSION, new Date().toISOString());
  redirect("/dashboard");
}
