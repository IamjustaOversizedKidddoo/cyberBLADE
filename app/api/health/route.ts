/** Liveness: cheap, no database, no details. Still answers in maintenance mode. */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
