import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// "Switch operator": forget this browser's operator.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore error if session already revoked
    }
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
