# Phase 3: SOC Analyst Track — Certification-Outcome Design

**Status:** Design spec for owner review
**Date:** 2026-10-12
**Replaces:** Original Phase 3 (archived at `docs/archive/2026-10-12-phase-3-original.md`)
**Companion docs:** `phase-3-benchmark.md` (evidence), `phase-3-open-questions.md` (decisions needed)

---

## Executive Summary

Phase 3 builds a SOC analyst track that prepares learners to pass real practical SOC certifications — SAL1, BTL1, CDSA, SAL2, and CySA+ — on their first attempt. It does not promise guaranteed passes. Instead, it provides:

1. **A curriculum** structured around the skills those exams actually test (19 skill domains, §A2 of benchmark).
2. **A SOC simulator** with realistic alert queues, triage decisions, enrichment tools, and case management.
3. **Scenario variants** generated deterministically so no two learners see the same investigation.
4. **Report writing with graded feedback** — a hybrid AI+rubric grader calibrated against practitioner reviewers.
5. **Exam-format mock exams** matching each target cert's format, timing, and structure.
6. **A readiness gate** that tells learners honestly when they are and are not ready, with targeted study plans.

The key differentiator is not "more content" but **better practice**: realistic noise, decision-focused training, granular per-skill feedback, and honest readiness measurement.

### First Shippable Slice

L1 core modules (modules 1–8) + SOC simulator MVP + 3 scenario families × 5 variants + report grader v1 + SAL1-format mock exam + readiness gate v1.

---

## C1. Track Structure and Levels

### Prerequisites

All SOC track learners must complete the Shared Core (Ranks 0–2). This provides:
- Linux fundamentals, Windows & PowerShell, networking & protocols, web security basics, cryptography, security architecture, security tooling — reusing existing 38 lessons and 20 labs.

### Level Map

| Level | Name | Target Cert Alignment | Rank | Entry Criteria |
|:---|:---|:---|:---:|:---|
| **L1** | SOC Analyst Foundations | SAL1, BTL1 | 3 | Complete Shared Core (Rank 2) |
| **L2** | SOC Analyst Advanced | SAL2, CDSA | 4 | Complete L1 + L1 challenge exam |
| **CySA+ Layer** | Knowledge overlay (no separate rank) | CySA+ CS0-004 | — | Available alongside L1/L2; adds MCQ+PBQ prep |
| **L3** | To be defined | (No verified cert target) | 5 | **Deferred**: see §C1.L3 below |

### L3 Decision

L3 is deferred. SAL3 does not exist. No exam target justifies a third SOC level today. If TryHackMe or another vendor releases a senior-level SOC cert, or if employer demand for detection engineering / threat hunting depth justifies it, L3 can be scoped then. This is an owner decision (see `phase-3-open-questions.md`).

### Module List — L1 (SOC Analyst Foundations)

| # | Module | Skills Covered (§A2) | Estimated Lessons | Estimated Labs | Prerequisites |
|:--|:---|:---|:---:|:---:|:---|
| 1 | SOC Fundamentals & Telemetry Sources | 1, 10 | 4 | 1 | Core Rank 2 |
| 2 | SIEM Search & Dashboard | 1, 10 | 4 | 2 | Module 1 |
| 3 | Alert Triage & Escalation Workflow | 1, 17 | 3 | 2 (simulator) | Module 2 |
| 4 | Email & Phishing Analysis | 2, 9 | 4 | 2 | Module 1 |
| 5 | Endpoint Investigation (Windows) | 5, 8 | 5 | 2 | Core Win lessons |
| 6 | Endpoint Investigation (Linux) | 6 | 3 | 2 | Core Linux lessons |
| 7 | Network Investigation & Traffic Analysis | 3, 4 | 5 | 3 | Core packet labs |
| 8 | Incident Response Fundamentals | 11, 17 | 4 | 2 (report) | Modules 3–7 |
| — | **L1 Subtotal** | | **32** | **16** | |

### Module List — L2 (SOC Analyst Advanced)

| # | Module | Skills Covered (§A2) | Estimated Lessons | Estimated Labs | Prerequisites |
|:--|:---|:---|:---:|:---:|:---|
| 9 | Threat Intelligence & Enrichment | 9, 18 | 4 | 2 | L1 complete |
| 10 | Detection Engineering (Sigma, YARA) | 14 | 4 | 3 | Modules 2, 7 |
| 11 | Threat Hunting Methodology | 13 | 4 | 2 | Module 10 |
| 12 | Active Directory — Defender Perspective | 15 | 4 | 2 | Module 5 |
| 13 | Cloud & Identity Security Monitoring | 16 | 4 | 2 | Module 2 |
| 14 | Advanced IR, Malware Triage & Forensics Concepts | 8, 11, 12 | 5 | 3 (report) | Modules 9–13 |
| — | **L2 Subtotal** | | **25** | **14** | |

### CySA+ Knowledge Layer

CySA+ CS0-004 is MCQ+PBQ, testing breadth across all 19 skill domains plus vulnerability management (its largest domain at 26%). The CySA+ layer adds:
- A vulnerability management module (3 lessons, 1 lab): CVE/CVSS/EPSS, scanner output interpretation, risk-based prioritization.
- An MCQ question bank mapped to CS0-004's 4 domains (target: 400 original questions).
- PBQ simulations using the lab engine (target: 20 PBQ scenarios).
- Timed CySA+-format mock exams (85 Qs, 165 min).

This layer is available as an add-on for learners at any point after Module 2.

### Learning Objectives Per Module

Each module specifies 4–6 learning objectives in the format: "After this module, the learner can [observable action] using [tool/technique] in [context]." Objectives are mapped 1:1 to skill domains in the benchmark matrix and to specific certification exam domains/topics. Full objective list to be authored during module writing, not in this spec.

---

## C2. SOC Simulator Engine

### Overview

The SOC simulator is the central workspace for L1 and L2 practice. It is NOT a SIEM — it is a **SOC analyst's workstation** that includes a SIEM view as one of several tools.

### Workspace Components

| Component | What It Simulates | Engine Basis |
|:---|:---|:---|
| **Alert Queue** | A queue of alerts from SIEM rules, IDS, EDR, email gateway. Each alert has severity, source, timestamp, summary. Most are false positives or duplicates. | New component; extends `SiemEvent` types |
| **Triage Panel** | Learner classifies each alert: True/False Positive, sets severity, writes ticket notes, chooses: investigate, escalate, close. | New component |
| **SIEM Query Console** | Search/filter/group events from log sources. Supports SPL-like and KQL-like syntax over in-browser dataset. | Extends existing `siem` engine; needs query parser |
| **Enrichment Tools** | IP/domain/URL reputation lookup, WHOIS, email header analysis, sandbox-report style views (static analysis summary, process tree, network indicators). All simulated with generated data. | New component; deterministic from scenario seed |
| **PCAP & Network View** | Packet capture viewer for the scenario's network traffic. | Extends existing `packet` engine |
| **Endpoint Timeline** | Process creation, file modification, registry changes, login events for scenario hosts, displayed as a timeline. | Extends existing `terminal` engine data models |
| **Case Notes** | Learner's investigation notes, IOC tracking, evidence tagging. | New component (markdown editor with structured fields) |
| **Evidence Board** | Visual board linking alerts → enrichment results → timeline events → IOCs → MITRE techniques. | New component |
| **Report Editor** | Structured incident report with guided sections (verdict, timeline, IOCs, scope, MITRE, recommendations). | New component (planned `report` lab type from spec §7.1) |

### What Is Simulated vs. What Needs Real Tools

| Capability | CyberBLADE Can Simulate | Cannot Fully Simulate | Impact |
|:---|:---|:---|:---|
| SIEM query language (SPL/KQL) | SPL-like and KQL-like syntax over generated datasets; ~80% of common operators | Advanced SPL commands (stats, eval functions, subsearches), full Elastic DSL | Learners will need supplemental practice on real Splunk/Elastic for SAL2/CDSA exams |
| Endpoint investigation | Process tree, file listing, registry, event logs (from terminal engine data) | Live process debugging, memory analysis, Sysmon live filtering | State honestly: "foundational practice; supplement with free tools for exam readiness" |
| Packet analysis | Generated PCAP-like data in viewer; protocol decoding for common protocols | Full Wireshark functionality, custom display filters, pcapng format | Adequate for SAL1/BTL1 level; SAL2/CDSA may need Wireshark practice |
| Malware analysis | Static analysis summary views (PE headers, strings, imports); sandbox report reading | Live dynamic analysis, Volatility memory forensics, Autopsy disk forensics | Honestly: cannot replace hands-on Autopsy/Volatility. Recommend "build-your-own-lab" supplement |
| Report writing | Full report editor with rubric grading | N/A — this is a strength | Report grading is a differentiator |

### Engine Architecture

The SOC simulator reuses existing engines through a composition layer:

```
SOCSimulatorWorkspace (new)
├── AlertQueue (new) → fed by ScenarioGenerator
├── TriagePanel (new) → writes to CaseState
├── SiemConsole (extends lib/lab-engine/siem/) → needs query parser addition
├── EnrichmentPanel (new) → reads from ScenarioGenerator.enrichmentData
├── PacketViewer (extends lib/lab-engine/packet/) → reads ScenarioGenerator.pcapData
├── EndpointTimeline (new) → reads from terminal engine VFS/process data models
├── CaseNotes (new) → markdown editor with IOC fields
├── EvidenceBoard (new) → links CaseState entities
└── ReportEditor (new) → structured form + markdown + rubric grading
```

---

## C3. Scenario System

### Scenario Format

Each scenario is a folder: `content/tracks/soc/scenarios/<scenario-id>/`

```yaml
# scenario.yaml
id: soc-l1-phish-cred-theft
title: "Phishing to Credential Theft"
level: L1
family: phishing_credential_theft
estimated_minutes: 45
mitre: [T1566.002, T1078, T1110.001]

# Generator produces deterministic variants from a seed
generator:
  module: phishing_cred_theft  # TypeScript generator function
  variant_count: 8             # Minimum seeded variants
  params:
    noise_alert_count: [40, 80]   # Range: min-max alerts total
    fp_ratio: [0.6, 0.8]          # 60-80% false positives
    missing_telemetry: true       # Some log sources intentionally incomplete

# Ground truth (never sent to client)
ground_truth:
  incidents: 1
  attack_chain:
    - "Phishing email with credential harvesting link"
    - "Victim clicks link, enters credentials on fake login page"
    - "Attacker uses stolen credentials for remote login"
    - "Persistence via scheduled task or service installation"
  key_iocs:
    - type: ip
      role: attacker_c2
      source: generator.attackerIp
    - type: email
      role: phishing_sender
      source: generator.phishingSender
    - type: user
      role: compromised_account
      source: generator.targetUser

# Assessment rubric
rubric:
  verdict: { weight: 20, correct_answer_from: ground_truth }
  ioc_extraction: { weight: 20, minimum_iocs: 3 }
  timeline_accuracy: { weight: 15, tolerance_minutes: 5 }
  scope_and_impact: { weight: 15 }
  mitre_mapping: { weight: 10, expected_techniques: [T1566.002, T1078] }
  recommendations: { weight: 10 }
  clarity: { weight: 10 }

# Validation rules (CI enforced)
validation:
  every_variant_solvable: true      # Automated check: ground truth reachable in every variant
  no_client_side_answers: true      # Ground truth never in client bundle
  no_ambiguous_ground_truth: true   # Exactly one correct verdict per scenario
```

### Attack Chain Library

Target scenario families per level:

**L1 (≥8 base scenarios):**

| # | Family | Attack Chain Description | Key Skills Tested |
|:--|:---|:---|:---|
| 1 | Phishing → credential theft | Phishing email → credential harvesting → remote login → persistence | 2, 5, 10, 11 |
| 2 | Brute force → lateral movement | External brute force → valid credentials → internal pivot → data access | 1, 5, 6, 10 |
| 3 | Malware execution → C2 beacon | Malicious attachment → process execution → C2 callback → data staging | 3, 5, 8, 10 |
| 4 | Web application attack → data access | SQL injection or path traversal → database access → data exfiltration | 7, 10, 11 |
| 5 | Insider data theft | Legitimate user → unusual data access patterns → large download → external upload | 1, 6, 10, 17 |
| 6 | Ransomware precursors | Compromised RDP → reconnaissance → credential dumping → lateral movement (stops before encryption) | 3, 5, 10, 11 |
| 7 | DNS tunneling / data exfiltration | Malware communicates via DNS queries → unusual DNS patterns → data encoded in queries | 3, 4, 10 |
| 8 | Supply chain / trusted-tool abuse | Legitimate update mechanism delivers malicious payload → process injection → persistence | 5, 8, 10 |

**L2 (≥6 base scenarios):**

| # | Family | Attack Chain Description | Key Skills Tested |
|:--|:---|:---|:---|
| 1 | AD compromise chain | Kerberoasting → service account → DCSync → golden ticket indicators | 12, 15, 10 |
| 2 | Cloud credential compromise | Phished cloud credentials → API abuse → privilege escalation → resource creation | 16, 9, 11 |
| 3 | Multi-stage APT simulation | Initial access → persistence → discovery → lateral movement → data staging → exfiltration | 13, 14, 10, 11 |
| 4 | Living-off-the-land (LOLBins) | Trusted binaries used for download/execution/persistence | 5, 14, 10 |
| 5 | Insider threat + detection evasion | Legitimate access + anti-forensics + slow data exfiltration | 13, 6, 10 |
| 6 | Web shell → pivoting | Web app compromise → web shell deployment → internal reconnaissance → database access | 7, 3, 10, 11 |

### Variant Generation

Each base scenario has a TypeScript generator function (like the existing `siemInvestigation` generator) that accepts a seeded RNG and produces:
- Unique attacker IPs, target users, hostnames, file hashes, timestamps
- Varying numbers of noise events (within the configured range)
- Different benign background activity patterns
- Shuffled alert ordering

**Validation rules (CI-enforced):**
1. Every variant must be solvable: ground truth IOCs must appear in generated data.
2. No answers leak to the client: ground truth is never serialized in the browser bundle.
3. No ambiguous ground truth: exactly one correct verdict per scenario.
4. Noise events must not accidentally match ground truth patterns.

---

## C4. Report Writing and Grading

### Incident Report Format

The report editor provides a structured template:

1. **Executive Summary** (2–3 sentences: what happened, how bad, what to do)
2. **Verdict** (True Positive / False Positive / Benign Suspicious, with confidence)
3. **Attack Timeline** (chronological event sequence with timestamps)
4. **Indicators of Compromise** (structured IOC table: type, value, context)
5. **Scope & Impact Assessment** (affected systems, users, data, business impact)
6. **MITRE ATT&CK Mapping** (techniques observed, with evidence)
7. **Recommendations** (containment, eradication, recovery, prevention)
8. **Evidence References** (links to specific log entries, alerts, PCAP segments)

### Grading Rubric

| Section | Weight | Deterministic Checks | AI-Assisted Scoring |
|:---|:---:|:---|:---|
| Verdict correctness | 20% | Exact match against ground truth | — |
| IOC extraction accuracy | 20% | Count + exact match of IOC values against ground truth set | Partial credit for close matches |
| Timeline accuracy | 15% | Key events present within ±5 min tolerance | Sequence logic and completeness |
| Scope & impact | 15% | Key affected systems mentioned | Reasoning quality, business context |
| MITRE mapping | 10% | Expected technique IDs present | Correct evidence-to-technique linking |
| Recommendations | 10% | — | Actionable, specific, prioritized |
| Clarity & professionalism | 10% | — | Grammar, structure, conciseness |

### Grader Architecture

**Hybrid approach:**
- **Deterministic checks** (verdict, IOCs, timeline events, MITRE IDs): exact matching against scenario ground truth. These produce binary right/wrong scores.
- **AI-assisted scoring** (reasoning, recommendations, clarity): Handler in grading mode with the scenario rubric + ground truth as context. Produces a 1–4 scale per section with explanatory feedback.

### Grader Quality Validation

**Before showing AI-graded scores to learners as authoritative:**
1. Collect 50+ learner reports across at least 5 different scenarios.
2. Have 3 practitioner graders independently score each report on the same rubric.
3. Compute Cohen's kappa (κ) between AI grader and each practitioner pair.
4. **Threshold: κ ≥ 0.7** (substantial agreement) required before AI scores are shown as numbers.
5. Until threshold is met, AI grader provides qualitative feedback only ("areas for improvement") without a numeric score.

### Anti-Gaming Measures

- Report similarity detection across submissions (cosine similarity on text embeddings).
- Minimum word count per section (prevents copy-paste of IOC tables without analysis).
- Time-on-task tracking (reports submitted in <5 minutes flagged for review).
- Scenario seed ensures each learner's specific IOCs differ, making report sharing useless for the factual sections.

### Cost Control

AI grading uses the same cost-control mechanisms as the Handler:
- Smaller/faster model for factual checks; larger model for reasoning assessment.
- Per-user daily grading limit (e.g., 5 reports/day).
- Cached feedback templates for common patterns.
- Estimated cost: ~$0.05–$0.15 per report grading (assuming Claude Haiku for checks + Sonnet for reasoning, ~2K input + 1K output tokens).

---

## C5. Exam-Format Practice and Readiness Gate

### Mock Exam Formats

| Target Cert | Mock Format | Duration | Structure |
|:---|:---|:---|:---|
| SAL1 | MCQ section (80 Qs, 60 min) + SOC simulator triage (2h) + report | 3h (compressed from 24h window) | Randomized from question bank + scenario pool |
| SAL2 | 4 multi-stage investigation scenarios + reports | 4h (compressed from 72h window) | Scenarios from L2 pool with unique seeds |
| BTL1 | 20 task-based challenges in simulator (flag submission) | 4h (compressed from 24h window) | Tasks generated from scenario ground truth |
| CDSA | Full investigation + professional incident report | 6h (compressed from 7-day window) | Extended scenario with multiple attack phases |
| CySA+ | 85 MCQ+PBQ questions | 165 min (matches real exam) | Randomized from CySA+ question bank |

**Note:** Mock exam time compression is intentional — it trains time management. Real exams give more time but learners who can finish under time pressure are better prepared.

### Per-Skill Diagnostics

After each mock, the learner receives:
- Score per skill domain (mapped to the 19-skill matrix).
- Weak areas linked to specific modules and labs.
- Comparison to the readiness threshold.
- Specific study plan generated by the next-best-action engine.

### Readiness Gate

**"Ready" status criteria (provisional — to be calibrated):**

| Criterion | Threshold | Rationale |
|:---|:---|:---|
| All relevant modules completed | 100% | Ensures topic coverage |
| All relevant labs passed | 100% | Ensures hands-on practice |
| Mock exam passes | ≥3 different mocks passed above 75% | Tests consistency, not luck |
| Report quality | ≥3 reports graded above 70% | Ensures writing competence |
| Time management | ≥1 mock completed within target time | Tests exam-day stamina |
| Weak domains | No domain below 50% on latest mock | Ensures no critical gaps |

**"Not Ready" messaging:**
- Specific: "You are not ready for SAL1 yet. Your phishing analysis scores are below 50%. Complete Module 4 labs and retake the phishing-focused practice set."
- Encouraging: "You're making progress. 4 of 6 criteria met."
- Honest: "Readiness thresholds are provisional. They will be calibrated from real learner outcomes."

### Threshold Calibration

Initial thresholds are educated guesses. Calibration process:
1. Launch with provisional thresholds (stated as provisional).
2. Collect self-reported real exam outcomes via the exam report feature (already built, see `ExamReportDialog`).
3. After 30+ data points per cert: compute the correlation between readiness status at exam date and pass/fail outcome.
4. Adjust thresholds to maximize the positive predictive value of "Ready" status.
5. Publish calibration results (sample size, accuracy, confidence interval).

---

## C6. The Handler in SOC Mode

### Socratic Investigation Coaching

In SOC simulator labs, the Handler operates in "investigation coach" mode:

**Does:**
- Asks guiding questions that point at evidence: "What log sources might show this IP address's activity?" "Have you checked the email gateway logs?"
- Suggests methodology: "A good next step would be to timeline the events for this user."
- Explains concepts when asked: "What is a C2 beacon?" → full explanation.
- Provides graduated hints using the scenario's hint ladder.

**Doesn't:**
- Name specific IOCs or answers from the ground truth.
- Say "the attacker IP is X" or "the malware is Y."
- Confirm or deny learner guesses about specific findings.

### Exam-Mode Lockout

During mock exams and the track certification exam:
- Handler is fully disabled.
- The chat panel shows: "Handler is offline during exams. You've got this, Operator."

### Leak Resistance

The Handler's system prompt in SOC mode:
- Receives the scenario's rubric structure but NOT the ground truth values.
- Ground truth is stored server-side only; checks run server-side.
- The Handler can see the learner's current investigation state (which alerts they've triaged, what queries they've run) but not the correct answers.

---

## C7. Real-Tool Lab Option

### Honest Assessment

A browser simulator cannot fully replicate exams that use real tools. The practical certs (SAL2, BTL1, CDSA) involve:
- Real Splunk/Elastic instances
- Wireshark with full display filters
- Autopsy for disk forensics (BTL1)
- Volatility for memory forensics (BTL1)
- YARA rule testing on real samples (CDSA)

### Options Evaluated

| Option | Effort | Security Risks | Cost | Recommendation |
|:---|:---|:---|:---|:---|
| Containerized Elastic/OpenSearch (per session) | High (8–12 weeks) | Container escape, resource abuse, network isolation | ~$0.10–$0.50/hour per learner | Phase 3.5 or Phase 4 |
| Containerized Wazuh (per session) | High | Same as above | Same | Phase 3.5 or Phase 4 |
| "Build-your-own-lab" guides | Low (2–3 weeks) | None (learner's own machine) | $0 platform cost | **Include in Phase 3** |
| Pre-recorded tool walkthroughs (video/screenshots) | Medium (4 weeks) | None | $0 | Include in Phase 3 (supplement) |

### Phase 3 Recommendation

**Include in Phase 3:**
- "Build-your-own-lab" guides for: Elastic stack (local Docker), Wireshark practice, basic Volatility/Autopsy on provided sample files.
- Guided setup with evidence checklists (similar to spec §5.5 point 8).
- State honestly in the course: "Our simulator covers decision-making and investigation methodology. For tool-specific muscle memory on [Splunk/Elastic/Autopsy], we recommend supplementing with [free tool + our setup guide]."

**Defer to Phase 3.5 or Phase 4:**
- Containerized real-tool labs. These require significant infrastructure (container orchestration, isolation, abuse prevention, cost control) that is better built once the platform has paying users to fund the infrastructure.

---

## C8. Learning-Science Layer

### Existing Features Applied to SOC Skills

| Feature | SOC Application |
|:---|:---|
| SM-2 spaced review | SOC flashcards: Event IDs (4624, 4625, 4688, 7045, 1, etc.), common ports, SPL/KQL syntax, ATT&CK technique IDs, IOC types, log source names |
| Daily review session | SOC-specific card pool unlocked per module |
| Next-best-action engine | Extended to track SOC-specific states: "You have 3 overdue SOC review cards" → "Module 7 lab not yet passed" → "Ready for L1 mock exam" |
| Mastery overview | Extended with SOC skill domains: shows solid/developing/needs_review per skill area |
| Readiness calculator | Extended with SOC cert coverage matrix (see §C5) |
| Streak + XP | SOC modules award XP within the existing system |

### SOC Flashcard Library (Original Content)

Target: 100 flashcards across L1 + L2, each with:
- Front: question testing recall of a specific fact
- Back: concise answer with context
- Command snippet (where applicable)
- Mapped to skill domain and module

Example topics (all original formulations):
- "What Windows Event ID indicates a new service was installed?" → "7045 — a critical indicator of persistence."
- "In SPL, how do you count events grouped by source IP?" → "`stats count by src_ip`"
- "What MITRE ATT&CK technique covers credential dumping?" → "T1003 — OS Credential Dumping"

---

## C9. Practitioner Review Program

> **This is the single biggest credibility requirement for the SOC track.**

### Purpose

Working SOC analysts review scenarios and calibrate report grading to ensure:
1. Scenarios are realistic and solvable.
2. Report grading produces scores a practitioner would agree with.
3. Content is technically accurate and current.

### Recruitment

| Source | Target Count | Compensation |
|:---|:---:|:---|
| Indian MSSP/SOC analysts (1–3 years experience) | 5–8 | Paid review (₹2,000–5,000 per scenario review) or free platform access |
| International SOC practitioners (remote) | 2–3 | Paid review ($50–$100 per scenario review) or certification credit |
| InfoSec community volunteers (Beta testers) | 5–10 | Free lifetime platform access + public attribution (with consent) |

### Review Checklist (Per Scenario)

- [ ] Attack chain is realistic (would occur in a real enterprise)
- [ ] Alert noise level is realistic (not too clean, not impossible)
- [ ] Ground truth is unambiguous
- [ ] All variants are solvable within the estimated time
- [ ] IOCs are realistic (IPs in appropriate ranges, hashes plausible)
- [ ] MITRE mapping is correct
- [ ] Enrichment data is consistent with the attack narrative
- [ ] Report rubric is fair and covers what matters

### Report Grading Calibration

Process:
1. Collect 50+ learner reports from beta.
2. 3 practitioner reviewers independently grade each on the rubric (blind to AI grade).
3. Compute inter-rater reliability (Fleiss' κ for 3+ raters).
4. Compute AI-vs-practitioner agreement (Cohen's κ per pair).
5. Resolve disagreements via discussion; update rubric if systematic issues found.
6. Target: κ ≥ 0.7 before showing AI scores to learners.

### Disagreement Resolution

If κ < 0.7 after initial calibration:
- Identify rubric sections with highest disagreement.
- Refine criteria (e.g., "timeline accuracy" needs more specific definition).
- Re-calibrate with refined rubric.
- If still < 0.7 after 2 rounds: disable AI scoring for that section; show qualitative feedback only.

---

## C10. Certificate and Credential Policy

### What the CyberBLADE SOC Credential Means

"The holder completed the CyberBLADE SOC Analyst [L1/L2] curriculum, passed [N] simulated investigation scenarios with graded reports, and demonstrated readiness for real-world SOC certification exams."

### What It Does NOT Mean

- It is NOT an industry certification equivalent to SAL1, BTL1, CDSA, or CySA+.
- It does NOT guarantee passing any external exam.
- It does NOT imply endorsement by TryHackMe, Security Blue Team, Hack The Box, or CompTIA.

### Verification Page

`/verify/<credential-id>` shows:
- Credential holder name (as entered, not verified)
- Level completed (L1 or L2)
- Date issued
- Skills demonstrated (list from skill matrix)
- Exam format summary (simulated investigation + report)
- "This is a CyberBLADE completion credential. It is not affiliated with any external certification body."

### Wording Rules

- ✅ "Covers skills tested by SAL1, BTL1, and CySA+"
- ✅ "Includes [N] simulated SOC investigation scenarios"
- ✅ "Prepares learners to attempt real SOC certifications"
- ❌ "SAL1-certified" or "BTL1-equivalent"
- ❌ "Endorsed by TryHackMe" or "partnered with Security Blue Team"
- ❌ "Guaranteed to pass"
- ❌ "[Vendor logo] on any CyberBLADE page"

### Building Recognition

1. **Portfolio of graded reports:** Learners can share their investigation reports (with scenario details redacted for integrity) as portfolio pieces.
2. **Public verification:** Employers can verify credentials via the `/verify` page.
3. **Practitioner endorsements:** Reviewers who sign off on the track can be quoted (with consent) as "reviewed by working SOC analyst [name], [title]."
4. **Published pass rates:** After sufficient data, publish the correlation between CyberBLADE readiness status and real exam pass rates.
5. **Hiring partner outreach:** SOC teams at Indian MSSPs/enterprises as early adopters (Phase 4+).

---

## C11. Pricing and Access Considerations

### Tier Mapping

| Content | Free Tier | Pro Tier (paid) |
|:---|:---|:---|
| L1 Modules 1–3 (SOC Fundamentals) | ✅ | ✅ |
| L1 Modules 4–8 | ❌ | ✅ |
| L2 Modules 9–14 | ❌ | ✅ |
| SOC Simulator (practice mode, 3 scenario families) | ✅ (limited) | ✅ (all scenarios) |
| CySA+ question bank | ❌ | ✅ |
| Mock exams | ❌ | ✅ |
| Report grading | ❌ (1 free) | ✅ (5/day limit) |
| Handler in SOC mode | ❌ | ✅ |

### Marginal Cost Features

| Feature | Per-Use Cost | Mitigation |
|:---|:---|:---|
| AI report grading | ~$0.05–$0.15/report | Daily cap (5/day); cached templates |
| Handler in investigation mode | ~$0.01–$0.05/message | Existing metering system; daily token cap |
| Containerized real-tool labs (future) | ~$0.10–$0.50/hour | Defer to Phase 3.5+; time-limited sessions |

### Indian Pricing

Razorpay integration is Phase 4. Pricing recommendation for SOC track access:
- Pro monthly: ₹499/month (consistent with spec §12)
- Pro annual: ₹3,999/year
- SOC track exam fee: ₹2,999 (includes one retake)

This positions CyberBLADE at <₹7,000/year total — significantly below SAL1 ($349 = ~₹29,000) or CySA+ ($439 = ~₹37,000) exam costs alone, before training material costs.

---

## C12. Content Safety and Legal

### Ethical-Use Framing

All SOC scenarios include:
- Context: "You are an authorized SOC analyst investigating alerts in your organization's environment."
- No instructions on how to conduct attacks (scenarios show the defender's view of attacks).
- Ethical-use agreement required before accessing SOC track content.

### Malware Handling

- **No live malware.** All malware artifacts are inert, synthetic data:
  - File hashes are generated (not real malware hashes).
  - "Sandbox reports" are generated narrative text, not real analysis output.
  - PE headers and strings in static analysis views are fabricated.
  - Process trees show synthetic process names and paths.
- "Malware triage" teaches the methodology of safe handling, not the creation or execution of malware.

### Synthetic PII

All scenario data uses synthetic PII:
- Names from a generated set (not real people).
- Email addresses use `@example.com` or `@corp.internal` domains.
- IP addresses from RFC 5737 documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or private ranges.

### Scenario IP Originality

Every scenario is an original creation. Scenario families describe generic attack patterns (phishing, brute force, etc.) that are common knowledge. The specific implementations, alert sequences, noise patterns, and investigation paths are CyberBLADE originals. No scenario is designed to replicate any vendor's exam scenario, training room, or CTF challenge.

### Trademark Wording

Cert names (SAL1, BTL1, CDSA, CySA+) appear only in:
- "Covers skills tested by [cert name]"
- Coverage matrix documentation
- Readiness gate UI

They do NOT appear in:
- Course titles (use "SOC Analyst L1" not "SAL1 Prep")
- Marketing headlines
- Logo or badge designs

### Data Protection

Learner reports stored in Supabase with RLS. Reports contain only synthetic scenario data and learner's analysis text. No real PII from learners enters the report content. Existing DPDP Act compliance from spec §13 applies.

---

## Part D: Plan, Sizing, Risks

### D1. Dependency Map

| Phase 3 Component | Depends On (Existing) | Depends On (Improvement Passes) | Blocks |
|:---|:---|:---|:---|
| SOC curriculum (lessons) | Content pipeline, MDX schema | P2 content accuracy standards | All SOC labs |
| SIEM query parser | SIEM engine types | — | Modules 2–14, all simulator labs |
| Alert queue workspace | — (new) | P6 design system, P7 accessibility | Modules 3+, all simulator scenarios |
| Scenario generators | Existing generator framework, RNG | — | All scenario-based labs |
| Report editor + grader | Handler service, guardrails | P5 security (CSP for report content) | Modules 8, 14, mock exams |
| Readiness gate (SOC certs) | Readiness engine, coverage matrix | P8 Stage 1 (learning effectiveness) | Mock exams, exam-format practice |
| CySA+ question bank | Question bank schema (spec §5.5) | — | CySA+ mock exams |
| Flashcards (SOC) | SM-2 scheduler, flashcard library | P8 Stage 1 | Daily review sessions |
| Practitioner review | — (external people) | — | Content launch |

### D2. Work Breakdown and Milestones

#### Slice 1: MVP (first shippable value)

| # | Work Item | Agent Days | Owner Review Days | Notes |
|:--|:---|:---:|:---:|:---|
| 1 | SIEM query parser (SPL-like subset) | 5–8 | 1 | Core engine work |
| 2 | Alert queue component + triage panel | 5–7 | 1 | New UI components |
| 3 | SOC simulator workspace shell | 3–5 | 1 | Composition of engines |
| 4 | Enrichment panel (IP/domain/email) | 3–4 | 0.5 | Generated data, static views |
| 5 | 3 L1 scenario families × 5 variants each | 8–12 | 3 | **Bottleneck**: owner must verify attack chains |
| 6 | Report editor + deterministic grader | 4–6 | 1 | Rubric matching only (no AI scoring yet) |
| 7 | L1 Modules 1–8 content (32 lessons) | 15–20 | 5–8 | **Bottleneck**: technical review |
| 8 | L1 labs (16 labs) | 8–12 | 2–3 | Tied to scenario generators |
| 9 | SAL1-format mock exam | 3–4 | 1 | MCQ bank (initial 80 Qs) + simulator scenario |
| 10 | Readiness gate v1 (SOC certs) | 2–3 | 0.5 | Extends existing readiness engine |
| 11 | SOC flashcards (50 cards for L1) | 2–3 | 1 | Original content |
| — | **Slice 1 Total** | **58–84** | **16–20** | |

#### Slice 2: L2 + Advanced Features

| # | Work Item | Agent Days | Owner Review Days |
|:--|:---|:---:|:---:|
| 12 | L2 Modules 9–14 content (25 lessons) | 12–16 | 4–6 |
| 13 | L2 labs (14 labs) | 6–10 | 2–3 |
| 14 | 6 L2 scenario families × 5 variants | 10–15 | 3–5 |
| 15 | AI-assisted report grader (reasoning) | 5–7 | 1 |
| 16 | SAL2/CDSA/BTL1-format mock exams | 6–8 | 2 |
| 17 | Endpoint timeline view | 3–4 | 0.5 |
| 18 | Evidence board | 3–4 | 0.5 |
| 19 | CySA+ question bank + PBQs + mock | 8–12 | 2–3 |
| 20 | Build-your-own-lab guides | 3–4 | 1 |
| 21 | Practitioner calibration (50 reports) | 3–5 | 2–3 |
| 22 | SOC flashcards L2 (50 cards) | 2–3 | 1 |
| — | **Slice 2 Total** | **61–88** | **19–28** |

**Combined Phase 3 Total: 119–172 agent-days, 35–48 owner review-days.**

Owner review is the real bottleneck. An experienced SOC practitioner reviewing scenarios, content accuracy, and report grading calibration will be needed — this cannot be fully delegated to AI.

### D3. Risk Register

| # | Risk | L | I | Mitigation | Early Warning |
|:--|:---|:---:|:---:|:---|:---|
| 1 | **Grader unreliability** — AI report grading disagrees with practitioners | High | High | Validate with κ≥0.7 before showing scores; fall back to qualitative feedback | First calibration batch shows κ<0.5 |
| 2 | **Scenario realism** — generated scenarios feel artificial | Med | High | Practitioner review; real-world attack chain research; noise tuning | Beta testers report "too clean" or "too noisy" |
| 3 | **Content accuracy** — technical errors in SOC content | Med | High | Expert review program; "known error" reporting channel; quarterly review | First 5 expert reviews return >10 corrections per module |
| 4 | **Exam changes by vendors** — SAL1/SAL2/CySA+ update format | Med | Med | Cert registry version tracking; quarterly check; content flagging pipeline | Vendor announces new version within 6 months of launch |
| 5 | **Scope creep** — L2/CySA+/real-tool labs expand Phase 3 indefinitely | High | Med | Hard scope: Slice 1 first, then decide; kill criteria at checkpoint | Slice 1 takes >120 agent-days |
| 6 | **AI grading cost** — per-report cost exceeds budget at scale | Low | Med | Daily caps; cached templates; smaller model for factual checks | Cost >$0.20/report in production |
| 7 | **Containerization security** — real-tool labs lead to abuse | Med | High | Defer to Phase 3.5+; if built, use gVisor/Firecracker, network isolation, session time limits | Any container escape in testing |
| 8 | **Legal/trademark exposure** — cert vendor objects to naming | Low | High | Use only "covers skills tested by" wording; no logos; legal review before launch | Cease-and-desist from any vendor |
| 9 | **Lack of practitioner reviewers** — cannot recruit enough | Med | High | Offer paid review + free access; target Indian MSSP community; start recruitment in Slice 1 | <3 reviewers committed by Slice 1 end |
| 10 | **No real-outcome data** — cannot calibrate readiness without pass reports | High | Med | Provisional thresholds stated as provisional; incentivize self-reporting; no public claims until 30+ data points | <10 self-reports after 6 months |
| 11 | **Simulator fidelity gap** — learners fail real exams on tool-specific tasks | Med | Med | Honest fidelity statements; build-your-own-lab guides; don't overclaim simulator coverage | Self-reported failures cite "tool unfamiliarity" |
| 12 | **Query parser complexity** — SPL/KQL parser scope balloons | Med | Med | Start with 15 core operators (search, where, stats, table, top, rare, sort, head, tail, dedup, eval, rename, count, avg, sum); expand later | Parser work exceeds 10 agent-days |
| 13 | **Answer leakage** — ground truth appears in client bundle | Low | Critical | CI validation rule; no ground truth in client code; server-side-only checks | Any test or audit reveals ground truth in browser |
| 14 | **CySA+ CS0-003 retirement** — content targets wrong exam version | Low | Med | Target CS0-004 (launched June 2026, current); monitor retirement dates | CompTIA announces CS0-005 |
| 15 | **Learner drop-off** — SOC track is too long (57 lessons + 30 labs) | Med | Med | Chunk into visible milestones (module completion certificates); next-best-action keeps learners moving; weekly streak targets | <20% of starters reach Module 4 |

### D4. Kill Criteria and Checkpoints

**After Slice 1 (MVP):**

| Signal | Action |
|:---|:---|
| Beta testers (10+) complete L1; practitioner reviewers approve 3+ scenarios; readiness gate produces sensible scores | **Continue** to Slice 2 |
| Scenario realism rated "poor" by >50% of practitioners OR AI grader κ < 0.4 after calibration | **Change**: redesign scenario generator; switch to manual scenario authoring; revisit grader approach |
| <5 beta testers complete L1 after 3 months OR owner review backlog >30 days behind schedule | **Pause**: focus on core content quality; reduce scope to L1 only for launch |
| Legal issue (trademark complaint, content accuracy complaint) | **Stop** specific items; legal review before continuing |

### D5. How Phase 3 Changes Phases 4–8

| Phase | Original | Change | Reason |
|:---|:---|:---|:---|
| **Phase 3** | "SOC track" (wk 11–16) | Expanded to 2 slices; Slice 1 ships at ~wk 11–20, Slice 2 at ~wk 21–30 | SOC simulator, scenarios, and grading are substantially more work than originally estimated |
| **Phase 4** | "Public launch" (wk 17–18) | Moved to wk 21–23 (after Slice 1 complete) | Launch with SOC L1 as the first paid track |
| **Phase 5** | "Pentest/VAPT track" (wk 19–28) | Moved to wk 24–33 | Pentest track now starts after SOC L1 launch |
| **Phase 6–8** | Unchanged in scope | Shifted by ~5 weeks | Cascade from Phase 3 expansion |

**Recommendation:** Paid launch (Phase 4) should follow Slice 1, not Slice 2. This means launching with SOC L1 (SAL1/BTL1 level) as the initial paid offering, while L2 (SAL2/CDSA level) ships as a content update to existing subscribers. This gets revenue flowing sooner and funds the infrastructure for real-tool labs.

### D6. Success Metrics for SOC Track Beta

Tied to Part B scorecard:

| Metric | Target for Beta | Measurement |
|:---|:---|:---|
| Scenario count | 3 families × 5 variants = 15 unique investigations | Scenario library count |
| Noise realism | FP ratio ≥60% in all 3 families | Automated check from scenario configs |
| Beta completion rate | ≥50% of beta testers complete L1 | Tracking dashboard |
| Practitioner approval | ≥3 practitioner reviewers sign off | Review records |
| Report grading calibration | κ ≥ 0.5 (moderate agreement; 0.7 target is for GA) | Calibration study |
| Readiness gate functional | Produces "Ready"/"Not Ready" with per-skill breakdown | Feature test |
| At least 1 mock exam | SAL1-format mock exam available and completable | E2E test |
| Learner satisfaction | ≥4.0/5.0 on "this prepared me for a real SOC cert exam" | Post-beta survey |
