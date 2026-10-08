import Link from "next/link";
import { DisplaySettings } from "@/components/theme/DisplaySettings";
import { Scanlines } from "@/components/theme/Scanlines";
import { BlinkCursor } from "@/components/theme/BlinkCursor";
import { BRAND } from "@/lib/brand";
import type { Operator } from "@/lib/identity/types";
import { RankBadge } from "./RankBadge";

export function AppShell({
  operator,
  children,
}: {
  operator: Operator;
  children: React.ReactNode;
}) {
  return (
    <>
      <Scanlines />
      <header className="border-b border-line">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="font-display text-2xl">
            {BRAND.name}
            <BlinkCursor />
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-ui text-muted">{operator.handle}</span>
            <RankBadge rank={operator.rank} />
            <DisplaySettings />
            <form action="/session/end" method="post">
              <button type="submit" className="neon-toggle">
                Switch operator
              </button>
            </form>
          </div>
        </nav>
      </header>
      {children}
    </>
  );
}
