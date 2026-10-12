import type { Metadata } from "next";
import Link from "next/link";
import { TerminalPanel } from "@/components/theme/TerminalPanel";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "Accessibility standards, keyboard navigation, known limitations, and feedback mechanisms for CyberBLADE.",
};

export default function AccessibilityPage() {
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
          <span>DOC: ACCESSIBILITY-STATEMENT</span>
          <span>TARGET: WCAG 2.2 AA</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-ink tracking-tight">
          ACCESSIBILITY STATEMENT
        </h1>
        <p className="mt-2 text-sm text-secondary font-sans leading-relaxed">
          CyberBLADE is committed to digital accessibility. We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA.
        </p>
      </header>

      <div className="space-y-8 font-sans text-sm text-secondary leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-ui font-semibold text-ink">Our Commitment</h2>
          <p>
            Security operations should be accessible to all practitioners. We continuously design, test, and audit our platform to ensure readable contrast, semantic markup, full keyboard operability, and support for assistive technologies including screen readers and screen magnifiers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-ui font-semibold text-ink">Core Accessibility Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="raised" edge="cyan">
              <CardHeader className="pb-1">
                <span className="font-mono text-xs text-cyan font-bold uppercase">Keyboard Control</span>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-muted">
                  All interactive controls, navigation menus, and lesson knowledge checks are fully reachable and operable via keyboard. Visible 2px focus outlines with 3:1+ contrast indicate active focus.
                </p>
              </CardBody>
            </Card>

            <Card variant="raised" edge="emerald">
              <CardHeader className="pb-1">
                <span className="font-mono text-xs text-success font-bold uppercase">High-Contrast Contrast</span>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-muted">
                  Text colors achieve WCAG AA contrast (minimum 4.5:1 for body copy; 3:1 for large headings and UI icons). Windows Forced Colors mode and High Contrast mode are supported natively.
                </p>
              </CardBody>
            </Card>

            <Card variant="raised" edge="purple">
              <CardHeader className="pb-1">
                <span className="font-mono text-xs text-purple font-bold uppercase">Motion Control</span>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-muted">
                  Users with vestibular sensitivities can enable <code className="text-cyan">prefers-reduced-motion</code> or toggle motion preferences to immediately silence 3D blade rotation, scanlines, and kinetic animations.
                </p>
              </CardBody>
            </Card>

            <Card variant="raised" edge="amber">
              <CardHeader className="pb-1">
                <span className="font-mono text-xs text-warning font-bold uppercase">Multi-Signal Status</span>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-muted">
                  Status and severity information is never conveyed by color alone. Every badge pairs color with distinctive geometric icons and text labels.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-ui font-semibold text-ink">Known Limitations & Workarounds</h2>
          <p>
            While we strive for comprehensive conformance, certain specialized simulation engines present unique challenges:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted">
            <li>
              <strong className="text-ink">Virtual Terminal (xterm.js):</strong> Terminal canvases can capture focus. We provide an accessible Screen Reader Mode toggle, an Escape-then-Tab exit mechanism, and one-click &quot;Copy Output&quot; transcript export for screen reader users.
            </li>
            <li>
              <strong className="text-ink">Timed Capstone Challenges:</strong> Operational challenges feature a countdown timer as part of the core evaluation criteria. Users can query remaining time on-demand via an &quot;Announce time remaining&quot; button to avoid overwhelming speech synthesizer chatter.
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-line pt-6">
          <h2 className="text-xl font-ui font-semibold text-ink">Feedback & Assistance</h2>
          <p>
            If you encounter an accessibility barrier or have difficulty using any part of CyberBLADE, please reach out to our team at{" "}
            <a href="mailto:accessibility@cyberblade.dev" className="text-cyan underline">
              accessibility@cyberblade.dev
            </a>
            . We review all reports within 2 business days.
          </p>
        </section>
      </div>
    </main>
  );
}
