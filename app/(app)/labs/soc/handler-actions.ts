"use server";

/**
 * Handler in the SOC workspace (Stage 1, behind SOC_HANDLER_ENABLED). The browser sends only the
 * attempt, the alert it is looking at and the message; the context is rebuilt on the server from
 * the learner's own work.
 */
import { z } from "zod";
import { headers } from "next/headers";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { checkRateLimit } from "@/lib/progress/rate-limit";
import { isSocHandlerEnabled } from "@/lib/config/env";
import { askSocHandler } from "@/lib/handler/soc-mode";
import type { HandlerResponse } from "@/lib/handler/types";

const inputSchema = z.object({
  attemptId: z.string().uuid(),
  alertId: z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/).optional(),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).default([]),
});

export async function askSocHandlerAction(raw: unknown): Promise<HandlerResponse> {
  if (!isSocHandlerEnabled()) throw new Error("The Handler is not enabled in the SOC workspace.");
  const input = inputSchema.parse(raw);
  const operator = await requireOperator();
  const forwardedFor = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const isTest = process.env.NODE_ENV === "test" || process.env.CYBERBLADE_ALLOW_LOCAL_E2E === "true";
  const ip = checkRateLimit(`handler:ip:${forwardedFor}`, isTest ? 1000 : 30, 60_000);
  if (!ip.allowed) {
    return { reply: `[TRANSMISSION THROTTLED] Please wait ${Math.ceil(ip.retryAfterMs / 1000)}s before transmitting again.`, blocked: true, providerUsed: "heuristic" };
  }
  return askSocHandler(getCtx(), operator.id, input);
}
