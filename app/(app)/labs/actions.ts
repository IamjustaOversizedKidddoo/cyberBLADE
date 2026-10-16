"use server";

import { z } from "zod";
import { requireOperator } from "@/lib/identity/session";
import { getCtx } from "@/lib/progress/context";
import { rateLimit } from "@/lib/security/rate-limit";
import { submitObjective } from "@/lib/progress/service";
import { generateLab } from "@/lib/lab-engine/checks";
import { dispatchHttpRequest } from "@/lib/lab-engine/webapp/simulator";
import type { DispatchResult, HttpRequest } from "@/lib/lab-engine/webapp/types";

const args = z.tuple([z.string().min(1).max(100), z.string().min(1).max(50), z.string().max(500)]);

/** Bound to an attempt id on the server; answers are checked server-side against the regenerated key. */
export async function submitObjectiveAction(attemptId: string, objectiveId: string, answer: string) {
  const [a, o, text] = args.parse([attemptId, objectiveId, answer]);
  const operator = await requireOperator();

  const rate = await rateLimit(`sub:${operator.id}`, 10, 10_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded: too many submissions. Please wait ${Math.ceil(rate.retryAfterMs / 1000)}s before trying again.`);
  }

  return submitObjective(getCtx(), operator.id, a, o, text);
}

const httpRequestSchema = z.object({
  method: z.enum(["GET", "POST"]),
  url: z.string().min(1).max(2000),
  headers: z.record(z.string(), z.string()),
  body: z.string().optional(),
});

/**
 * Executes a simulated HTTP request on the server against the regenerated lab environment,
 * preventing solution flags from being exposed in client bundles or props.
 */
export async function dispatchWebAppRequestAction(
  attemptId: string,
  rawRequest: Omit<HttpRequest, "id" | "timestamp" | "path" | "query">,
  currentCookies: Record<string, string>,
  currentStorage: Record<string, string>,
  currentDatabase: Record<string, Array<Record<string, unknown>>>,
): Promise<DispatchResult> {
  const request = httpRequestSchema.parse(rawRequest);
  const operator = await requireOperator();
  const ctx = getCtx();
  const attempt = await ctx.repo.getAttempt(attemptId);
  if (!attempt || attempt.userId !== operator.id) throw new Error("not found");

  const lab = await ctx.content.loadLab(attempt.labId);
  if (attempt.mode === "challenge" && attempt.expiresAt && ctx.now() > new Date(attempt.expiresAt)) {
    throw new Error("attempt expired");
  }

  const { env } = generateLab(lab, attempt.seed, ctx.content.generators);
  if (env.kind !== "webapp") throw new Error("invalid lab type");

  return dispatchHttpRequest({
    env: env.app,
    request,
    currentCookies,
    currentStorage,
    currentDatabase,
  });
}
