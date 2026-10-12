import { Card, CardHeader, CardBody } from "@/components/ui/Card";

const FAQS = [
  {
    q: "Is CyberBLADE free during beta?",
    a: "Yes. CyberBLADE is completely free to use during our public beta. Both anonymous local mode and hosted authentication modes provide full access to all curriculum modules and lab engines.",
  },
  {
    q: "Can I use CyberBLADE without an account or offline?",
    a: "Yes. In local anonymous mode, your operator handle and learning progress are stored entirely in local browser session storage. No email or third-party sign-in is required to complete Rank 0 and Rank 1.",
  },
  {
    q: "Does CyberBLADE guarantee that I will pass certification exams?",
    a: "No. While our curriculum is factually aligned with the published exam objectives of CompTIA Security+, Network+, A+, and ISC2 CC, passing official exams requires dedicated study and comprehensive review. We build the practical muscle memory; we do not sell exam pass guarantees.",
  },
  {
    q: "Are the labs running in heavy cloud virtual machines?",
    a: "No. CyberBLADE labs run on custom deterministic in-browser engines (xterm.js + VFS, Wireshark parser, simulated web targets, and structured log triage). They launch in under 500 milliseconds without provisioning delays, VPN setups, or cloud hourly costs.",
  },
  {
    q: "What certifications are covered in the curriculum?",
    a: "Rank 0 covers IT fundamentals aligned with CompTIA A+ and Network basics. Rank 1 covers Linux, Windows administration, and networking aligned with CompTIA Network+ and Security+ core. Rank 2 covers web vulnerabilities and defense aligned with CompTIA Security+ and ISC2 CC domains.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 py-16 sm:py-24 border-t border-line bg-canvas">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-xs text-cyan tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
            <span>OPERATOR BRIEFING // FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="mt-3 font-display text-3xl sm:text-5xl text-ink tracking-tight">
            FREQUENTLY ASKED QUESTIONS
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted max-w-2xl">
            Clear, honest answers about our training platform, certification alignment, and simulator mechanics.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {FAQS.map((faq, idx) => (
            <Card key={idx} variant="default" className="border border-line">
              <CardHeader className="pb-2">
                <h3 className="font-ui font-semibold text-base sm:text-lg text-ink">
                  {faq.q}
                </h3>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted leading-relaxed font-sans">
                  {faq.a}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
