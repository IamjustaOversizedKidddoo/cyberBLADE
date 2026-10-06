import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE } from "@/lib/identity/session";

// "Switch operator": forget this browser's operator. Their data stays in .data/.
export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
