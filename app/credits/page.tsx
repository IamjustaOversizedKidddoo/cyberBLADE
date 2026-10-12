import type { Metadata } from "next";
import Link from "next/link";
import { TerminalPanel } from "@/components/theme/TerminalPanel";

export const metadata: Metadata = {
  title: "Credits & Attribution",
  description: "Open source software, typography, and community assets utilized in CyberBLADE.",
};

export default function CreditsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 print:py-4 print:text-black">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-xs text-cyan hover:underline print:hidden"
        >
          ‹ RETURN TO CYBERBLADE
        </Link>
      </div>

      <header className="border-b border-line pb-6 mb-8">
        <div className="flex items-center justify-between text-xs font-mono text-muted mb-2">
          <span>DOC: OPEN-SOURCE-ATTRIBUTION</span>
          <span>LAST UPDATED: OCTOBER 2026</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-ink tracking-tight">
          CREDITS & ATTRIBUTION
        </h1>
        <p className="mt-2 text-sm text-secondary font-sans leading-relaxed">
          CyberBLADE is built with pride on open-source software, type design, and community standards.
        </p>
      </header>

      <div className="space-y-6">
        <TerminalPanel title="typography">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-ui font-semibold text-ink">Hacked Font</h2>
              <p className="text-sm text-secondary">
                By David Libeau —{" "}
                <a href="https://hackedfont.com" className="text-cyan underline" target="_blank" rel="noreferrer">
                  hackedfont.com
                </a>
                . Licensed under Creative Commons Attribution (CC-BY).
              </p>
            </div>
            <div>
              <h2 className="text-lg font-ui font-semibold text-ink">Pixel Operator</h2>
              <p className="text-sm text-secondary">
                By Jayvee Enaguas (HarvettFox96). Released under Creative Commons Zero (CC0) 1.0 Universal Public Domain.
              </p>
            </div>
            <div>
              <h2 className="text-lg font-ui font-semibold text-ink">IBM Plex Sans & JetBrains Mono</h2>
              <p className="text-sm text-secondary">
                Released under the SIL Open Font License 1.1 by IBM and JetBrains.
              </p>
            </div>
          </div>
        </TerminalPanel>

        <TerminalPanel title="core_libraries">
          <div className="space-y-3 text-sm text-secondary">
            <p>
              <strong>Terminal Simulation:</strong> Powered by <a href="https://xtermjs.org" className="text-cyan underline" target="_blank" rel="noreferrer">xterm.js</a> (MIT License).
            </p>
            <p>
              <strong>3D Engine:</strong> Powered by <a href="https://threejs.org" className="text-cyan underline" target="_blank" rel="noreferrer">Three.js</a> by Ricardo Cabello and contributors (MIT License).
            </p>
            <p>
              <strong>Icons:</strong> Derived from <a href="https://lucide.dev" className="text-cyan underline" target="_blank" rel="noreferrer">Lucide Icons</a> (ISC License).
            </p>
          </div>
        </TerminalPanel>
      </div>
    </main>
  );
}
