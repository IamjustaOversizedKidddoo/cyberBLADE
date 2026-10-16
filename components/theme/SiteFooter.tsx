import Link from "next/link";
import { BladeMark } from "@/components/art/BladeMark";
import { BlinkCursor } from "@/components/theme/BlinkCursor";
import { SystemLabel } from "@/components/art/SystemLabel";
import { BRAND } from "@/lib/brand";
import { AudioToggle } from "@/components/theme/AudioToggle";

const BUILD_ID = "REV 2.6 / BUILD 2026-10-09";
const CLEARANCE = "PUBLIC // UNCLASSIFIED";

export function SiteFooter() {
  return (
    <footer className="relative border-t-2 border-line bg-void" role="contentinfo">
      {/* Grid separator line — top phosphor stripe */}
      <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />

      {/* Upper row: brand + nav columns */}
      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-px bg-line md:grid-cols-12">
        {/* Brand cell */}
        <div className="col-span-4 bg-void px-6 py-8 md:col-span-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-3 font-display text-2xl text-ink transition-colors hover:text-cyan"
          >
            <BladeMark className="h-8 w-8 text-cyan" />
            {BRAND.name}
            <BlinkCursor />
          </Link>
          <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-secondary">
            {BRAND.fullName}. Practical cybersecurity training from zero to job-ready.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              [&nbsp;{CLEARANCE}&nbsp;]
            </span>
            <AudioToggle />
          </div>
        </div>

        {/* Platform links */}
        <div className="col-span-2 bg-void px-6 py-8 md:col-span-2">
          <SystemLabel className="mb-4 block text-cyan">PLATFORM</SystemLabel>
          <ul className="space-y-2 text-sm text-secondary">
            <li><Link href="/learn/core" className="hover:text-cyan transition-colors">Course map</Link></li>
            <li><Link href="/dashboard" className="hover:text-cyan transition-colors">Dashboard</Link></li>
            <li><Link href="/labs" className="hover:text-cyan transition-colors">Labs Range</Link></li>
            <li><Link href="/exam" className="hover:text-cyan transition-colors">Exam Readiness</Link></li>
            <li><Link href="/start" className="hover:text-cyan transition-colors">Get started</Link></li>
          </ul>
        </div>

        {/* Tracks */}
        <div className="col-span-2 bg-void px-6 py-8 md:col-span-2">
          <SystemLabel className="mb-4 block text-cyan">TRACKS</SystemLabel>
          <ul className="space-y-2 text-sm text-secondary">
            <li>SOC Analyst</li>
            <li>Penetration Tester</li>
            <li>Cloud Security</li>
            <li><span className="text-muted">Purple Team ↗</span></li>
          </ul>
        </div>

        {/* Legal / credits */}
        <div className="col-span-2 bg-void px-6 py-8 md:col-span-2">
          <SystemLabel className="mb-4 block text-cyan">LEGAL & SEC</SystemLabel>
          <ul className="space-y-2 text-sm text-secondary">
            <li><Link href="/help" className="hover:text-cyan transition-colors">Help</Link></li>
            <li><Link href="/account" className="hover:text-cyan transition-colors">Account &amp; your data</Link></li>
            <li><Link href="/legal/ethical-use" className="hover:text-cyan transition-colors">Ethical use</Link></li>
            <li><Link href="/accessibility" className="hover:text-cyan transition-colors">Accessibility</Link></li>
            <li><Link href="/credits" className="hover:text-cyan transition-colors">Credits</Link></li>
            <li>
              <a href="/.well-known/security.txt" className="hover:text-cyan transition-colors">
                Security disclosure
              </a>
            </li>
            <li>
              <a href="https://hackedfont.com" className="hover:text-cyan transition-colors text-xs" target="_blank" rel="noreferrer">
                Hacked font by David Libeau
              </a>
            </li>
          </ul>
        </div>

        {/* System telemetry cell */}
        <div className="col-span-2 hidden bg-void px-6 py-8 md:col-span-2 md:block">
          <SystemLabel className="mb-4 block text-cyan">SYSTEM</SystemLabel>
          <ul className="space-y-1.5 font-mono text-xs tracking-wider text-muted">
            <li>STATUS: ONLINE</li>
            <li>NODE: PUBLIC-01</li>
            <li className="pt-1 text-muted">{BUILD_ID}</li>
          </ul>
        </div>
      </div>

      {/* Bottom strip */}
      <div aria-hidden="true" className="h-px w-full bg-line" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <SystemLabel className="text-muted">
          © 2026 {BRAND.name} · {BRAND.fullName}
        </SystemLabel>
        <SystemLabel className="text-muted hidden sm:inline">
          {BUILD_ID}
        </SystemLabel>
      </div>
    </footer>
  );
}
