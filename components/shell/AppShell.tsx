import Link from "next/link";
import { DisplaySettings } from "@/components/theme/DisplaySettings";
import { Scanlines } from "@/components/theme/Scanlines";
import { BladeMark } from "@/components/art/BladeMark";
import { BlinkCursor } from "@/components/theme/BlinkCursor";
import { SystemLabel } from "@/components/art/SystemLabel";
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

      {/* ─── FIXED TACTICAL HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-[var(--z-ui)] border-b border-line bg-void/90 backdrop-blur-sm">
        {/* Thin cyan accent line above nav */}
        <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />

        <nav
          aria-label="Application navigation"
          className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2 sm:px-6"
        >
          {/* LEFT — wordmark */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-display text-xl text-ink transition-colors hover:text-cyan sm:text-2xl"
          >
            <BladeMark className="h-7 w-7 text-cyan" />
            {BRAND.name}
            <BlinkCursor />
          </Link>

          {/* CENTRE — operator HUD badge */}
          <div className="flex items-center gap-0 border border-line">
            <span className="border-r border-line px-3 py-1.5 font-ui text-xs tracking-widest text-muted uppercase">
              OPERATOR
            </span>
            <span className="px-3 py-1.5 font-ui text-xs tracking-widest text-cyan">
              {operator.handle}
            </span>
          </div>

          {/* RIGHT — rank + controls */}
          <div className="flex items-center justify-end gap-3">
            <RankBadge rank={operator.rank} />
            <DisplaySettings />
            <form action="/session/end" method="post">
              <button
                type="submit"
                className="border border-line px-3 py-1.5 font-ui text-xs tracking-wider text-muted transition-colors hover:border-pink hover:text-pink"
              >
                [DISCONNECT]
              </button>
            </form>
          </div>
        </nav>
      </header>

      {children}
    </>
  );
}
