import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconTerminal, IconSearch, IconFlame } from "@/components/ui/icons";

const ENGINES = [
  {
    id: "terminal",
    title: "Linux & PowerShell Console",
    badge: "CLI SIMULATOR",
    desc: "A responsive xterm.js terminal connected to an in-memory virtual filesystem. Practice bash cmdlets, file permissions (chmod/chown), SUID binary hunting, process inspection, and Windows event log queries.",
    features: ["Realistic bash & PowerShell syntax", "Dynamic SUID & privilege escalations", "Zero slow VM boot times (instant init)"],
  },
  {
    id: "packet",
    title: "Wireshark-Grade Packet Inspector",
    badge: "PCAP ANALYSIS",
    desc: "A clean, dense packet dissecting environment. Filter traffic by protocol, inspect TCP/UDP handshakes, view synchronized Hex/ASCII dumps, and follow reconstructed TCP payload streams.",
    features: ["Wireshark-compatible display filters", "Live hex offset alignment", "Follow TCP Stream dialogue reconstructions"],
  },
  {
    id: "webapp",
    title: "Target Web Application Range",
    badge: "VULNERABILITY LAB",
    desc: "An isolated simulated target website framed within browser chrome. Features an integrated HTTP request/response inspector to intercept, analyze, and exploit real vulnerabilities.",
    features: ["SQL Injection with realistic database echo", "IDOR and authorization bypasses", "Persistent 'SIMULATED TARGET' indicator"],
  },
  {
    id: "siem",
    title: "Security Event Log Triage (SIEM)",
    badge: "SOC OPERATIONS",
    desc: "Triage real-world enterprise log streams. Analyze Windows Security Event IDs (4624, 4625, 7045), correlate brute force attempts with suspicious parent processes, and extract actionable indicators of compromise.",
    features: ["Virtualized dense event stream", "Multi-signal severity badges (shape+color)", "Structured key-value event drawer"],
  },
];

export function EngineShowcase() {
  return (
    <section id="engines" className="scroll-mt-24 py-16 sm:py-24 border-t border-line bg-surface-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-xs text-purple tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-purple" />
            <span>LAB ENGINE MATRIX // 4 HIGH-FIDELITY SIMULATORS</span>
          </div>
          <h2 className="mt-3 font-display text-3xl sm:text-5xl text-ink tracking-tight">
            THE LABS IN ACTION
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-2xl">
            Experience the actual tools security operators use every day. Built from scratch for instant browser execution without heavy cloud VM spin-ups.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {ENGINES.map((engine) => (
            <Card key={engine.id} variant="raised" edge="cyan" className="space-y-2">
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-ui font-semibold text-xl text-ink">
                  {engine.title}
                </h3>
                <Badge variant="cyan" size="sm">
                  {engine.badge}
                </Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-muted leading-relaxed font-sans">
                  {engine.desc}
                </p>
                <div className="border-t border-line/40 pt-3">
                  <ul className="space-y-1.5 font-mono text-xs text-cyan">
                    {engine.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-muted">›</span>
                        <span className="text-secondary">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
