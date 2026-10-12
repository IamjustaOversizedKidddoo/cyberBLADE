"use client";

import { useState, useEffect, useRef } from "react";
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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
        <div className="pointer-events-auto flex items-center gap-4 sm:gap-5">
          <a href="#how-it-works" className="hidden font-ui text-sm tracking-wider underline-offset-4 hover:underline lg:inline">
            Method
          </a>
          <a href="#curriculum" className="hidden font-ui text-sm tracking-wider underline-offset-4 hover:underline md:inline">
            Curriculum
          </a>
          <a href="#tracks" className="hidden font-ui text-sm tracking-wider underline-offset-4 hover:underline sm:inline">
            Tracks
          </a>
          <a href="#faq" className="hidden font-ui text-sm tracking-wider underline-offset-4 hover:underline lg:inline">
            FAQ
          </a>

          {/* Mobile menu trigger */}
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen(!open)}
            className="md:hidden flex h-10 w-10 items-center justify-center border border-current text-xs font-mono"
          >
            {open ? "✕" : "☰"}
          </button>

          <Link href="/start" className="btn-glitch inline-flex min-h-[44px] items-center justify-center border-2 border-current px-4 py-1.5 font-ui text-sm tracking-wider">
            Start
          </Link>
        </div>
      </nav>

      {/* Mobile Drawer (visible when open) */}
      {open && (
        <div
          id="mobile-nav"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site Navigation"
          className="pointer-events-auto fixed inset-x-0 top-[60px] border-b-2 border-current bg-canvas p-6 text-ink shadow-2xl md:hidden"
        >
          <ul className="space-y-4 font-ui text-lg">
            <li>
              <a
                href="#how-it-works"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                01 // How It Works
              </a>
            </li>
            <li>
              <a
                href="#curriculum"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                02 // Curriculum & Ranks
              </a>
            </li>
            <li>
              <a
                href="#tracks"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                03 // Career Tracks
              </a>
            </li>
            <li>
              <a
                href="#engines"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                04 // Lab Engines
              </a>
            </li>
            <li>
              <a
                href="#handler"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                05 // The Handler AI
              </a>
            </li>
            <li>
              <a
                href="#faq"
                onClick={() => setOpen(false)}
                className="block py-2 text-cyan hover:underline"
              >
                06 // FAQ
              </a>
            </li>
            <li>
              <Link
                href="/legal/ethical-use"
                onClick={() => setOpen(false)}
                className="block py-2 text-muted hover:underline"
              >
                Ethical Use Charter
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
