import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { SCENES } from "@/lib/art/landing";
import { BladeMark } from "./BladeMark";
import { SceneReadout } from "./SceneReadout";

/**
 * The landing page's fixed header. Drawn in white with `mix-blend-difference`, so it flips to black
 * over the paper bands without knowing which band it is over. Returning operators also use Start:
 * /start forwards anyone already signed in to their dashboard.
 */
export function LandingHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 text-ink mix-blend-difference">
      <nav aria-label="Primary" className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label={`${BRAND.name} home`} className="pointer-events-auto flex items-center gap-2 font-display text-xl sm:text-2xl">
          <BladeMark className="h-7 w-7" />
          <span aria-hidden="true">{BRAND.name}</span>
        </Link>
        <span className="hidden md:inline">
          <SceneReadout scenes={SCENES} />
        </span>
        <div className="pointer-events-auto flex items-center gap-5">
          <a href="#tracks" className="hidden font-ui text-sm tracking-wider underline-offset-4 hover:underline sm:inline">
            Tracks
          </a>
          <Link href="/start" className="btn-glitch inline-flex min-h-[44px] items-center justify-center border-2 border-current px-4 py-1.5 font-ui text-sm tracking-wider">
            Start
          </Link>
        </div>
      </nav>
    </header>
  );
}
