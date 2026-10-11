import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Reached when the cookie points at an operator that no longer exists (e.g. account deleted).
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  }
  const response = NextResponse.redirect(new URL("/start", request.url));
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
