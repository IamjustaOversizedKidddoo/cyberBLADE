import React from "react";
import Link from "next/link";
import { HeroBand } from "@/components/theme/HeroBand";
import type { Track } from "@/lib/catalog/tracks";

interface Props {
  track: Track;
}

const ROADMAP_MODULES: Record<string, { weeks: number; modules: Array<{ title: string; desc: string }> }> = {
  pentest: {
    weeks: 18,
    modules: [
      { title: "Methodology, Scope & Indian Cyber Law", desc: "Test types, rules of engagement, written authorization, IT Act 2000 legal boundaries." },
      { title: "Lab & Testing Tooling Setup", desc: "Command-line toolset, proxy interception, safe artifact collection and evidence logs." },
      { title: "Reconnaissance & OSINT Mapping", desc: "Passive DNS, footprinting, domain correlation, and attack surface enumeration." },
      { title: "Vulnerability Assessment & CVSS", desc: "Automated & manual vulnerability assessment, false-positive elimination, EPSS prioritization." },
      { title: "Network & Service Exploitation", desc: "Port scanning, service fingerprinting, protocol weaknesses, and banner analysis." },
      { title: "OWASP Top 10 Web Exploitation", desc: "SQL injection, XSS, SSRF, IDOR, and authentication bypass in realistic sandbox apps." },
      { title: "API & Microservice Penetration", desc: "GraphQL & REST API flaws, JWT tampering, broken object-level authorization." },
      { title: "Credential Access & Password Security", desc: "Hash identification, offline cracking theory, credential stuffing defense." },
      { title: "Linux Privilege Escalation", desc: "SUID abuse, sudo misconfigurations, kernel exploit caveats, secure permissions." },
      { title: "Windows & Active Directory Testing", desc: "Kerberoasting, DCSync principles, BloodHound graph analysis, defensible domain architecture." },
      { title: "Lateral Movement & Pivoting", desc: "SOCKS proxies, SSH port forwarding, network segmentation bypass concepts." },
      { title: "Vulnerability Research & Safe PoC", desc: "Public CVE root-cause analysis, isolated reproduction, weaponization refusal." },
      { title: "Executive Reporting & Risk Remediation", desc: "Industry-standard VAPT report authoring, executive summaries, defense remediation." },
      { title: "Capstone Scoped Engagement", desc: "24-hour multi-machine practical assessment with full deliverable report grading." },
    ],
  },
  cloud: {
    weeks: 14,
    modules: [
      { title: "Cloud Architecture & Shared Responsibility", desc: "AWS, Azure, and GCP foundational security, identity boundaries, resource isolation." },
      { title: "IAM & Role Escalation Paths", desc: "Over-permissive policies, cross-account trusts, assume-role escalation chains." },
      { title: "Cloud Storage & Data Exposure", desc: "Bucket policies, anonymous access remediation, client-side encryption." },
      { title: "Serverless & Container Security", desc: "Docker sandbox escape prevention, Kubernetes RBAC, Lambda runtime hardening." },
      { title: "Cloud Incident Response & CloudTrail", desc: "Log telemetry analysis, GuardDuty alerts, automated quarantine lambdas." },
      { title: "Infrastructure as Code (Terraform) Auditing", desc: "Static analysis of HCL, drift detection, policy-as-code with OPA." },
    ],
  },
  purple: {
    weeks: 16,
    modules: [
      { title: "Purple Team Foundations & MITRE ATT&CK", desc: "Tactics, techniques, and procedures (TTPs), threat emulation vs defense verification." },
      { title: "Adversary Emulation & Signal Tuning", desc: "Executing known atomic tests and validating corresponding SIEM log generation." },
      { title: "Telemetry Gap Analysis", desc: "Finding blind spots across Sysmon, Windows Event Logs, and Linux auditd." },
      { title: "Detection Engineering & Sigma Rules", desc: "Authoring resilient, generic detection rules that survive tool-renaming and evasion." },
      { title: "Joint Threat Hunting Operations", desc: "Cooperative hunts between attack and defense units, hypothesis validation." },
    ],
  },
};

export function TrackRoadmapPreview({ track }: Props) {
  const roadmap = ROADMAP_MODULES[track.id] ?? {
    weeks: 12,
    modules: [
      { title: "Core Fundamentals", desc: "Prerequisite theory, protocol foundations, and ethical boundaries." },
      { title: "Practical Labs", desc: "Hands-on browser simulations in isolated sandbox environments." },
      { title: "Certification Preparation", desc: "Capstone assessments mapped to industry vendor credentials." },
    ],
  };

  return (
    <main className="min-h-screen bg-canvas pb-24 text-ink">
      <HeroBand
        title={track.title}
        kicker={`> roadmap · ${track.group.toUpperCase()} TRACK · ${roadmap.weeks} WEEKS`}
      >
        Structured career curriculum in active development. This roadmap details the core modules,
        practical lab competencies, and capstone deliverables planned for release.
      </HeroBand>

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
        {/* Status Callout Banner */}
        <section className="rounded-xs border-2 border-line bg-surface p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan animate-pulse" />
                <span className="font-ui text-xs font-bold uppercase tracking-widest text-cyan">
                  CURRICULUM IN DEVELOPMENT // PREVIEW MODE
                </span>
              </div>
              <h2 className="font-display text-2xl text-ink uppercase">
                {track.title}
              </h2>
              <p className="mt-1 text-sm text-secondary max-w-prose">
                Direct exercises for this specialized track unlock upon completion of the Shared Core (Ranks 0–2).
                Review the authored module syllabus below.
              </p>
            </div>

            <Link
              href="/learn/core"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xs border-2 border-cyan bg-cyan/15 px-6 font-ui text-xs font-bold tracking-wider text-cyan hover:bg-cyan/25 transition-colors"
            >
              ← RETURN TO CORE TRAINING
            </Link>
          </div>
        </section>

        {/* Module Syllabus Outline */}
        <section aria-labelledby="syllabus-h" className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h3 id="syllabus-h" className="font-ui text-sm font-bold uppercase tracking-wider text-muted">
              PLANNED CURRICULUM SYLLABUS ({roadmap.modules.length} MODULES)
            </h3>
            <span className="font-mono text-xs text-muted">
              EST. {roadmap.weeks} WEEKS
            </span>
          </div>

          <ol className="grid gap-3">
            {roadmap.modules.map((m, idx) => (
              <li
                key={idx}
                className="flex items-start gap-4 rounded-xs border border-line bg-surface p-4 transition-colors hover:border-line/80"
              >
                <span className="font-mono text-sm font-bold text-cyan shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4 className="font-ui text-base font-semibold text-ink">
                    {m.title}
                  </h4>
                  <p className="mt-1 font-sans text-xs text-muted leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Action Link Footer */}
        <div className="pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/learn/core"
            className="text-xs font-ui text-muted hover:text-cyan transition-colors"
          >
            ← Back to Shared Core Missions
          </Link>
          <Link
            href="/learn/soc-l1"
            className="text-xs font-ui text-cyan hover:underline underline-offset-4"
          >
            Looking for live hands-on training? Explore the SOC Analyst L1 Track →
          </Link>
        </div>
      </div>
    </main>
  );
}
