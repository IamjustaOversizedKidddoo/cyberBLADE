import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { safeNextPath } from "@/lib/identity/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/start?error=missing_auth_code`);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/start?error=supabase_not_configured`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/start?error=auth_exchange_failed`);
  }

  const userId = data.user.id;
  const store = getOperatorStore();
  let operator = await store.get(userId);

  if (!operator) {
    const emailPrefix = data.user.email?.split("@")[0] || `op_${userId.slice(0, 8)}`;
    const sanitizedHandle = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20);

    operator = await store.create({
      id: userId,
      handle: sanitizedHandle || `op_${userId.slice(0, 8)}`,
      ethicsAcceptedAt: new Date().toISOString(),
    });
  }

  await setOperatorCookie(operator.id);

  return NextResponse.redirect(`${origin}${next}`);
}
