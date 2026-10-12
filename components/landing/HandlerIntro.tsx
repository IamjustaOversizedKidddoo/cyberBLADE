import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/icons";

export function HandlerIntro() {
  return (
    <section id="handler" className="scroll-mt-24 py-16 sm:py-24 border-t border-line bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald tracking-widest uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              <span>SOCRATIC AI TUTOR // PEDAGOGICAL INTEGRITY</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl text-ink tracking-tight">
              MEET THE HANDLER
            </h2>
            <p className="text-base sm:text-lg text-muted leading-relaxed font-sans">
              Most AI assistants spoil answers, depriving learners of genuine problem-solving intuition. <strong className="text-ink">The Handler</strong> is engineered with a strict Socratic pedagogy: it guides your investigative process with targeted questions and structured clues, never handing over flags or raw solutions.
            </p>

            <ul className="space-y-3 font-sans text-sm text-secondary">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full p-1 bg-cyan/10 text-cyan">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                <span><strong>4 Progressive Hint Tiers</strong>: Orientation → Investigation → Strategy → Technical Cue.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full p-1 bg-cyan/10 text-cyan">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                <span><strong>Leak-Proof Architecture</strong>: Multi-layer guardrails prevent flag reveals, even under prompt injection.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full p-1 bg-cyan/10 text-cyan">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                <span><strong>Capstone Integrity Lockout</strong>: During rank promotions, The Handler goes dark so you prove what you know alone.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6">
            <Card variant="raised" edge="purple" className="p-2">
              <CardHeader className="flex items-center justify-between border-b border-line/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                  <span className="font-mono text-xs text-ink uppercase tracking-wider">THE HANDLER // LIVE SIMULATION</span>
                </div>
                <Badge variant="purple" size="sm">SOCRATIC MODE</Badge>
              </CardHeader>
              <CardBody className="space-y-4 pt-4 font-mono text-xs">
                <div className="rounded-xs border border-line bg-surface-subtle p-3 space-y-1">
                  <span className="text-muted block text-[11px] uppercase">OPERATOR:</span>
                  <p className="text-ink">How do I find the world-writable file in /shared?</p>
                </div>
                <div className="rounded-xs border border-cyan/40 bg-surface-raised p-4 space-y-2">
                  <span className="text-cyan font-bold block text-[11px] uppercase">THE HANDLER:</span>
                  <p className="text-secondary leading-relaxed font-sans text-xs">
                    Look at the permission bits with <code className="text-cyan bg-canvas px-1 py-0.5 rounded">ls -l /shared</code>. A file that anyone can write to has the <strong className="text-ink font-mono">w</strong> bit set in the last three permission flags. What permissions do you see on the three files in that directory?
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
