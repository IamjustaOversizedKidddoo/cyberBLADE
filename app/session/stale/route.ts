import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/session";

// Reached when the cookie points at an operator that no longer exists (e.g. .data was deleted).
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/start", request.url));
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
