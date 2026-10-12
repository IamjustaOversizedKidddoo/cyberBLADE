import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconTerminal, IconShield, IconSearch, IconFlame } from "@/components/ui/icons";

const STEPS = [
  {
    num: "01",
    title: "Master the Theory",
    badge: "FOUNDATION",
    badgeVariant: "cyan" as const,
    icon: IconTerminal,
    desc: "Read focused lessons with comfortable 68-character line measures. Test your understanding immediately with interactive inline terminal checks before touching a target.",
  },
  {
    num: "02",
    title: "Work in Simulated Labs",
    badge: "EXECUTION",
    badgeVariant: "emerald" as const,
    icon: IconShield,
    desc: "Deploy instantly into 4 deterministic browser engines: Linux/PowerShell terminals, Wireshark-grade packet tables, simulated web targets, and SIEM event logs.",
  },
  {
    num: "03",
    title: "Coached by The Handler",
    badge: "SOCRATIC",
    badgeVariant: "purple" as const,
    icon: IconSearch,
    desc: "Get unblocked without spoiling the breakthrough. The Handler AI guides you through 4 structured hint tiers, asking questions rather than giving away flags.",
  },
  {
    num: "04",
    title: "Prove It in Capstones",
    badge: "PROMOTION",
    badgeVariant: "amber" as const,
    icon: IconFlame,
    desc: "Lock out The Handler and enter the timed challenge arena. Solve multi-stage operational scenarios under realistic conditions to earn your next rank.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-24 border-t border-line bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-xs text-cyan tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
            <span>OPERATIONAL METHODOLOGY // 4-STEP TRAINING LOOP</span>
          </div>
          <h2 className="mt-3 font-display text-3xl sm:text-5xl text-ink tracking-tight">
            HOW CYBERBLADE WORKS
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-2xl">
            No passive video marathons. You operate simulated infrastructure from minute one, building verifiable muscle memory for real security operations.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.num} variant="raised" edge={step.badgeVariant} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="flex items-center justify-between pb-2">
                    <span className="font-mono text-2xl font-bold text-cyan/70">
                      {step.num}
                    </span>
                    <Badge variant={step.badgeVariant} size="sm">
                      {step.badge}
                    </Badge>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <div className="flex items-center gap-2 text-ink font-ui font-semibold text-lg">
                      <Icon className="h-5 w-5 text-cyan shrink-0" />
                      <h3>{step.title}</h3>
                    </div>
                    <p className="text-sm text-muted leading-relaxed font-sans">
                      {step.desc}
                    </p>
                  </CardBody>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
