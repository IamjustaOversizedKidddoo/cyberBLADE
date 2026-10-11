import Link from "next/link";
import { DisplaySettings } from "@/components/theme/DisplaySettings";
import { Scanlines } from "@/components/theme/Scanlines";
import { BladeMark } from "@/components/art/BladeMark";
import { BlinkCursor } from "@/components/theme/BlinkCursor";
import { BRAND } from "@/lib/brand";
import type { Operator } from "@/lib/identity/types";
import { RankBadge } from "./RankBadge";
import { NavLinks } from "./NavLinks";

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
      <header className="sticky top-0 z-[var(--z-ui)] border-b border-line bg-void/90 backdrop-blur-md">
        {/* Subtle glowing cyan top border line */}
        <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />

        <nav
          aria-label="Application navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6"
        >
          {/* LEFT — tactical wordmark */}
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 font-display text-lg text-ink transition-colors hover:text-cyan sm:gap-2 sm:text-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded-xs"
          >
            <BladeMark className="h-6 w-6 text-cyan sm:h-7 sm:w-7 shrink-0" />
            <span>{BRAND.name}</span>
            <BlinkCursor />
          </Link>

          {/* CENTRE — navigation links + operator HUD badge */}
          <div className="hidden md:flex items-center gap-3">
            <NavLinks />

            <div className="hidden xl:flex items-center gap-0 border border-line bg-surface rounded-xs">
              <span className="border-r border-line px-2.5 py-1 font-ui text-[11px] tracking-widest text-muted uppercase">
                OPERATOR
              </span>
              <span className="px-2.5 py-1 font-mono text-[11px] tracking-wider text-cyan font-semibold">
                {operator.handle}
              </span>
            </div>
          </div>

          {/* RIGHT — rank badge + display prefs + disconnect */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3">
            <div>
              <RankBadge rank={operator.rank} />
            </div>
            <div className="hidden sm:block">
              <DisplaySettings />
            </div>
            <form action="/session/end" method="post">
              <button
                type="submit"
                aria-label="Switch operator"
                className="border border-line bg-surface px-2.5 py-1 font-ui text-xs tracking-wider text-muted transition-colors hover:border-danger hover:text-danger hover:bg-danger/10 sm:px-3 sm:py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded-xs"
              >
                [DISCONNECT]
              </button>
            </form>
          </div>
        </nav>

        {/* Mobile navigation row */}
        <NavLinks mobile />
      </header>

      {children}
    </>
  );
}
