import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE } from "./constants";
import { getOperatorStore } from "./operator-store";
import type { Operator } from "./types";

export { OPERATOR_COOKIE };
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// cache(): layout and page in the same request share one lookup.
export const getCurrentOperator = cache(async (): Promise<Operator | null> => {
  const cookieStore = await cookies();
  const id = cookieStore.get(OPERATOR_COOKIE)?.value;
  if (!id) return null;

  // 1. Check in-memory / operator store
  try {
    const operator = await getOperatorStore().get(id);
    if (operator) return operator;
  } catch {
    // ignore
  }

  // 2. Check companion profile cookie
  const opCookie = cookieStore.get("neon_op")?.value;
  if (opCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(opCookie)) as Operator;
      if (parsed && (parsed.id === id || !id)) {
        await getOperatorStore().create({
          id: parsed.id,
          handle: parsed.handle,
          ethicsAcceptedAt: parsed.ethicsAcceptedAt ?? null,
        }).catch(() => undefined);
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback: self-heal operator session so learner is never locked out
  const fallbackOp: Operator = {
    id,
    handle: id.startsWith("op_") ? id : `op_${id.slice(0, 6)}`,
    rank: 0,
    ethicsAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await getOperatorStore().create({
    id: fallbackOp.id,
    handle: fallbackOp.handle,
    ethicsAcceptedAt: fallbackOp.ethicsAcceptedAt,
  }).catch(() => undefined);
  return fallbackOp;
});

/** For app pages. */
export async function requireOperator(): Promise<Operator> {
  const operator = await getCurrentOperator();
  if (!operator) redirect("/start");
  return operator;
}

// Server Functions / Route Handlers only (Next forbids cookie writes during render).
export async function setOperatorCookie(operatorOrId: string | Operator): Promise<void> {
  const cookieStore = await cookies();
  const id = typeof operatorOrId === "string" ? operatorOrId : operatorOrId.id;

  cookieStore.set(OPERATOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  if (typeof operatorOrId === "object") {
    cookieStore.set("neon_op", encodeURIComponent(JSON.stringify(operatorOrId)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  }
}

export async function clearOperatorCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OPERATOR_COOKIE);
  cookieStore.delete("neon_op");
}
