import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconShield } from "@/components/ui/icons";

export function CharterSummary() {
  return (
    <section id="ethics" className="scroll-mt-24 py-16 sm:py-24 border-t border-line bg-surface-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Card variant="raised" edge="cyan" className="p-4 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs text-cyan tracking-widest uppercase">
                <IconShield className="h-4 w-4 text-cyan" />
                <span>ETHICAL USE & OPERATIONAL RULES // MANDATORY COMPLIANCE</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl text-ink tracking-tight">
                ETHICAL OPERATOR CHARTER
              </h2>
              <p className="text-sm sm:text-base text-muted leading-relaxed font-sans max-w-3xl">
                Every technique taught on CyberBLADE is intended solely for defensive engineering, threat hunting, and authorized testing. All simulated lab targets are isolated browser-based micro-environments. Attempting to use these techniques against systems you do not own or lack written authorization to test is strictly forbidden.
              </p>
              <div className="pt-2">
                <Link
                  href="/legal/ethical-use"
                  className="font-ui text-xs text-cyan underline underline-offset-4 hover:text-ink transition-colors tracking-wider uppercase"
                >
                  Read the full Ethical Use Agreement & Terms of Service ›
                </Link>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-3 font-mono text-xs text-muted border-t md:border-t-0 md:border-l border-line/60 pt-4 md:pt-0 md:pl-8">
              <div className="space-y-1">
                <span className="text-cyan block uppercase">RULE 01 // SCOPE</span>
                <p className="text-secondary text-xs">Only test targets inside the CyberBLADE sandbox.</p>
              </div>
              <div className="space-y-1">
                <span className="text-cyan block uppercase">RULE 02 // RESPONSIBILITY</span>
                <p className="text-secondary text-xs">Practice responsible vulnerability disclosure.</p>
              </div>
              <div className="space-y-1">
                <span className="text-cyan block uppercase">RULE 03 // INTEGRITY</span>
                <p className="text-secondary text-xs">Protect learner credentials and operational data.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
