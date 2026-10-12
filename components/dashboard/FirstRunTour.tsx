"use client";

import { useEffect, useState } from "react";
import { IconSparkles } from "@/components/ui/icons";

const STORAGE_KEY = "cyberblade_first_run_dismissed";

export function FirstRunTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      try {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
          setIsOpen(true);
        }
      } catch {
        // LocalStorage unavailable
        setIsOpen(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  };

  const reopen = () => {
    setIsOpen(true);
  };

  if (!mounted) return null;

  if (!isOpen) {
    return (
      <div className="border-b border-line bg-surface/30 px-4 py-1.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between text-xs text-secondary">
          <span className="font-mono text-[11px] text-muted">TACTICAL GUIDE // STANDBY</span>
          <button
            onClick={reopen}
            className="font-ui text-cyan hover:underline underline-offset-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan text-xs inline-flex items-center gap-1.5"
          >
            <IconSparkles className="size-3" />
            <span>Show Operator Primer</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="How CyberBLADE Works Primer"
      className="border-b border-cyan/40 bg-surface-raised px-4 py-5 sm:px-6 relative"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-xs bg-cyan/15 text-cyan border border-cyan/30">
              <IconSparkles className="size-4" />
            </span>
            <div>
              <h2 className="font-ui text-sm font-bold uppercase tracking-wider text-ink">
                OPERATOR PRIMER // HOW CYBERBLADE WORKS
              </h2>
              <p className="font-sans text-xs text-secondary mt-0.5">
                Master tactical cybersecurity through real sandboxed execution.
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="rounded-xs border border-line bg-surface px-3 py-1 font-mono text-xs text-secondary hover:border-cyan hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
            aria-label="Dismiss operator primer"
          >
            Dismiss [✕]
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xs border border-line bg-surface/80 p-3.5 space-y-1">
            <div className="font-mono text-[11px] text-cyan font-semibold">01 // STUDY</div>
            <h3 className="font-ui text-xs font-bold text-ink">Bite-sized Lessons</h3>
            <p className="font-sans text-xs text-secondary leading-relaxed">
              Read focused tactical doctrine with real protocol dissections, terminal syntax, and architectural diagrams.
            </p>
          </div>

          <div className="rounded-xs border border-line bg-surface/80 p-3.5 space-y-1">
            <div className="font-mono text-[11px] text-cyan font-semibold">02 // EXECUTE</div>
            <h3 className="font-ui text-xs font-bold text-ink">In-Browser Labs</h3>
            <p className="font-sans text-xs text-secondary leading-relaxed">
              Hands-on Linux & PowerShell terminals, packet sniffers, WebApp exploits, and mini-SIEMs with zero installation.
            </p>
          </div>

          <div className="rounded-xs border border-line bg-surface/80 p-3.5 space-y-1">
            <div className="font-mono text-[11px] text-cyan font-semibold">03 // SOCRATIC AI</div>
            <h3 className="font-ui text-xs font-bold text-ink">The Handler</h3>
            <p className="font-sans text-xs text-secondary leading-relaxed">
              Get intelligent coaching when stuck. The Handler provides pedagogical hints and questions, never answers.
            </p>
          </div>

          <div className="rounded-xs border border-line bg-surface/80 p-3.5 space-y-1">
            <div className="font-mono text-[11px] text-cyan font-semibold">04 // PROVE</div>
            <h3 className="font-ui text-xs font-bold text-ink">Rank Capstones</h3>
            <p className="font-sans text-xs text-secondary leading-relaxed">
              Complete timed multi-objective challenges to validate genuine competency and promote your rank.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
