import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE } from "./constants";
import { getOperatorStore } from "./operator-store";
import type { Operator } from "./types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export { OPERATOR_COOKIE };
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// cache(): layout and page in the same request share one lookup.
export const getCurrentOperator = cache(async (): Promise<Operator | null> => {
  const id = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (!id) return null;
  // Hosted: the operator cookie is only a pointer; it must match the signed-in Supabase user
  // (defence in depth on top of the operators RLS policy, which already limits reads to auth.uid()).
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (!data.user || data.user.id !== id) return null;
  }
  return getOperatorStore().get(id);
});

/** For app pages. A cookie whose operator no longer exists is cleared via /session/stale. */
export async function requireOperator(): Promise<Operator> {
  const operator = await getCurrentOperator();
  if (!operator) redirect("/session/stale");
  return operator;
}

// Server Functions / Route Handlers only (Next forbids cookie writes during render).
export async function setOperatorCookie(id: string): Promise<void> {
  (await cookies()).set(OPERATOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function clearOperatorCookie(): Promise<void> {
  (await cookies()).delete(OPERATOR_COOKIE);
}
