import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOperatorStore } from "@/lib/identity/operator-store";
import { setOperatorCookie } from "@/lib/identity/session";
import { safeNextPath } from "@/lib/identity/routes";
import { isReservedHandle } from "@/lib/identity/validation";
import { isBetaInviteOnly } from "@/lib/beta";
import { redeemStashedInvite } from "@/lib/beta/invite-flow";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(`${origin}/start?error=oauth_${encodeURIComponent(oauthError)}`);
  }

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

  if (!operator && isBetaInviteOnly()) {
    // Closed beta: a new learner needs the invite code they entered before signing in. Without
    // it the session is ended and no operator (and so no access) is created.
    if (!(await redeemStashedInvite(userId))) {
      await supabase.auth.signOut().catch(() => undefined);
      return NextResponse.redirect(`${origin}/start?error=invite_required`);
    }
  }

  if (!operator) {
    const emailPrefix = data.user.email?.split("@")[0] || `op_${userId.slice(0, 8)}`;
    let sanitizedHandle = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 15);

    if (!sanitizedHandle || sanitizedHandle.length < 3 || isReservedHandle(sanitizedHandle)) {
      sanitizedHandle = `op_${userId.slice(0, 8)}`;
    }

    try {
      operator = await store.create({
        id: userId,
        handle: sanitizedHandle,
        ethicsAcceptedAt: new Date().toISOString(),
      });
    } catch {
      // Handle potential collision safely by appending unique user segment
      operator = await store.create({
        id: userId,
        handle: `${sanitizedHandle.slice(0, 14)}_${userId.slice(0, 4)}`,
        ethicsAcceptedAt: new Date().toISOString(),
      });
    }
  }

  await setOperatorCookie(operator.id);

  return NextResponse.redirect(`${origin}${next}`);
}
