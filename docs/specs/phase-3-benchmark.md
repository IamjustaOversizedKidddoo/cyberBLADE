# Phase 3 Benchmark: SOC Certification Exams & Competitor Analysis

**Status:** Research document for Phase 3 planning
**Date:** 2026-10-12
**Author:** Agent (curriculum architect)
**Web access:** Used. All facts sourced via web search on 2026-10-12.

> **Executive Summary:** Five SOC certifications are in scope: SAL1, SAL2, BTL1, CDSA, and CySA+ CS0-004. SAL3 does not exist. The exams span MCQ+PBQ (CySA+), alert-queue simulation (SAL1), multi-stage investigation (SAL2, CDSA), and practical incident-response scenarios (BTL1). CyberBLADE's current state covers ~25% of the shared SOC skill set at exam depth. The biggest gaps are in the SOC simulator workspace, scenario variety, report grading, and exam-format practice.

---

## Part A1: Exam Facts Table

| Attribute | SAL1 | SAL2 | BTL1 | CDSA | CySA+ (CS0-004) |
|:---|:---|:---|:---|:---|:---|
| **Publisher** | TryHackMe | TryHackMe | Security Blue Team (Centri) | Hack The Box | CompTIA |
| **Level** | Entry / L1 SOC | Mid / L2 SOC | Entry / L1 SOC+IR | Mid / L2 SOC+DFIR | Mid / Analyst |
| **Format** | MCQ (~80 Qs, ~1h) + SOC Simulator (triage alerts, ~2h) + graded report | 12 multi-stage SOC scenarios | 20 task-based hands-on challenges (one connected incident) | Hands-on SOC lab + flags + professional incident report | MCQ + PBQ (max 85 Qs) |
| **Duration** | 24-hour window | 72-hour window | 24-hour window | 7 days | 165 minutes |
| **Tooling in exam** | Browser-based SOC simulator (TryHackMe platform) | Splunk, Elastic (browser-based) | Browser-based IR environment (Autopsy, Volatility, Wireshark, ELK, others) | SIEM, Wireshark, YARA, Sigma, other tools in HTB lab | Pearson VUE testing center; PBQs are simulated scenarios |
| **Report required** | Yes (professional reports within simulator) | Yes (investigation documentation, professional reporting) | No (task-based flag submission; no written report) | Yes (commercial-grade incident report) | No |
| **Report grading** | Automated + staff review (UNVERIFIED) | Staff/automated (UNVERIFIED) | N/A | HTB staff review | N/A |
| **Passing score** | UNVERIFIED (not publicly stated) | UNVERIFIED (not publicly stated) | 70% (90%+ for gold coin) | UNVERIFIED (pass/fail based on flags + report quality) | 750 / 900 |
| **Retake policy** | 2 attempts included | 2 attempts included | 2 attempts included (one free retake) | 2 attempts per voucher (voucher valid 1 year) | No wait for 2nd attempt; 14-day wait for 3rd+; full fee each |
| **Price** | ~$349 USD | ~€645 EUR | ~£399 GBP (~$500 USD) | ~$210 USD voucher (requires HTB Academy subscription ~$550/yr for Silver) | ~$439 USD |
| **Exam/version code** | SAL1 | SAL2 | BTL1 (no version code found) | CDSA (HTB-CDSA) | CS0-004 |
| **Cert validity** | UNVERIFIED | 3 years | UNVERIFIED (likely no expiry) | UNVERIFIED | 3 years (CE program) |
| **Verification status** | PARTIALLY VERIFIED | PARTIALLY VERIFIED | PARTIALLY VERIFIED | PARTIALLY VERIFIED | VERIFIED |

### SAL3 Status

**SAL3 does not exist** as of October 2026. TryHackMe offers SAL1 and the SOC Level 2 learning path. SAL2 launched March 2026. Community interest exists in a SAL3 but no product has been announced. The owner mentioned SAL3 — this is a false lead. Recommend removing it from scope.

### Sources

| Fact | Source | Date Accessed |
|:---|:---|:---|
| SAL1 format, price | TryHackMe certifications page (web search summary) | 2026-10-12 |
| SAL2 format, price, launch date | TryHackMe blog + certifications page (web search) | 2026-10-12 |
| SAL3 non-existence | TryHackMe products listing; Reddit community (no product found) | 2026-10-12 |
| BTL1 format, domains, price | Security Blue Team (Centri) site + Medium reviews | 2026-10-12 |
| CDSA format, price, prerequisites | HTB Academy certification page + reviews | 2026-10-12 |
| CySA+ CS0-004 domains, format, price | CompTIA.org official page | 2026-10-12 |
| CySA+ retake policy | CompTIA.org retake policy page | 2026-10-12 |

> **Note:** Many details (exact passing scores for SAL1/SAL2/CDSA, cert validity for SAL1/BTL1) could not be confirmed from vendor pages. These are marked UNVERIFIED and listed in `phase-3-open-questions.md`.

---

## Part A2: Shared SOC Skill-Domain Matrix

Skill domains normalized from the five certification outlines. Depth key: ■ = primary/deep, □ = covered/tested, · = tangential/implied, — = not tested.

| # | Skill Domain | SAL1 | SAL2 | BTL1 | CDSA | CySA+ | Notes |
|:--|:---|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | SOC operations & alert handling | ■ | ■ | □ | ■ | ■ | Core to all; SAL1/SAL2 have actual alert-queue format |
| 2 | Phishing & email analysis | ■ | □ | ■ | □ | □ | SAL1/BTL1 emphasize this heavily |
| 3 | Network traffic analysis | □ | ■ | □ | ■ | □ | CDSA/SAL2 go deep; SAL1/BTL1 cover basics |
| 4 | Network security monitoring (IDS/IPS/Zeek) | □ | ■ | · | ■ | □ | SAL2 and CDSA require Snort/Zeek-level work |
| 5 | Windows log analysis & artifacts | ■ | ■ | ■ | ■ | □ | Universal; Event IDs, Sysmon, registry |
| 6 | Linux log analysis & artifacts | □ | ■ | □ | ■ | □ | auth.log, syslog, cron, process analysis |
| 7 | Web & application log analysis | □ | ■ | · | ■ | □ | WAF, access logs, injection detection |
| 8 | Malware triage concepts | □ | ■ | ■ | □ | □ | BTL1 uses Autopsy/Volatility; SAL2 covers malware analysis |
| 9 | Threat intelligence & enrichment (IOC/TI) | □ | □ | ■ | □ | □ | BTL1 has a full TI domain |
| 10 | SIEM querying & correlation | ■ | ■ | □ | ■ | ■ | SPL (Splunk), KQL (Elastic), correlation rules |
| 11 | Incident response lifecycle (NIST/SANS) | □ | ■ | ■ | ■ | ■ | CDSA/CySA+ emphasize containment/eradication |
| 12 | Digital forensics artifacts (disk, memory, registry) | · | □ | ■ | □ | · | BTL1 is strongest here; CySA+ barely covers |
| 13 | Threat hunting | · | ■ | · | ■ | □ | SAL2 and CDSA require proactive hypothesis-based hunting |
| 14 | Detection engineering (Sigma, YARA) | · | ■ | · | ■ | · | SAL2/CDSA test writing detections; others don't |
| 15 | Active Directory (defender view) | · | ■ | · | ■ | □ | SAL2 covers AD attacks from defender perspective |
| 16 | Cloud security monitoring (AWS/Azure/M365) | · | ■ | — | · | □ | SAL2 explicitly tests cloud; CySA+ CS0-004 adds weight |
| 17 | Reporting & communication | ■ | ■ | — | ■ | ■ | SAL1/SAL2/CDSA require written reports; CySA+ domain 4 |
| 18 | Vulnerability management | · | □ | — | · | ■ | CySA+ Domain 2 (26%); others cover tangentially |
| 19 | Automation & scripting for SOC | · | □ | — | · | · | Emerging; no exam tests it deeply yet |

---

## Part A3: Competitor Weakness Analysis

Sources are labeled: **[E]** = evidence from vendor descriptions/public reviews; **[O]** = author opinion/inference; **[S]** = speculation.

| # | Weakness | Applies To | Evidence Type | Detail |
|:--|:---|:---|:---:|:---|
| 1 | Tool-tutorial focus over decision training | THM paths, HTB modules | [E] | Vendor descriptions emphasize "learn Splunk" / "learn Elastic" as goals; learner reviews on Reddit report feeling unprepared for multi-tool decisions in real SOC work despite completing paths |
| 2 | Small, fixed scenario sets that are shareable | SAL1, BTL1 | [E][S] | BTL1 has a single connected scenario (20 tasks); learner reviews discuss the specific scenario details publicly; SAL1's simulator uses a limited set (speculative on exact count, but learner forums describe recognizable scenarios) |
| 3 | Pass/fail without per-skill feedback | BTL1, CDSA | [E] | BTL1 returns a score but not per-domain breakdown (per public reviews). CDSA similarly returns pass/fail with limited diagnostic feedback |
| 4 | Unrealistically clean alerts | THM SOC labs, HTB labs | [O] | Training labs typically present isolated incidents without ambient noise, duplicate alerts, or false positives. Real SOCs have >90% noise in many environments. This is structural — labs teach one concept at a time |
| 5 | Weak report training and grading | SAL1, BTL1, CySA+ | [E][O] | BTL1 has no report requirement. SAL1's report grading methodology is not publicly detailed. CySA+ PBQs test structured analysis but not free-form writing |
| 6 | Content aging and vendor lock-in | All | [O] | THM/HTB paths are tied to specific tool versions; when Elastic or Splunk change significantly, content lags. CySA+ refreshes every ~3 years but content vendors lag the exam version transition |
| 7 | High price for Indian learners | SAL2, CySA+, BTL1 | [E] | SAL2 at €645 (~₹58,000) and CySA+ at $439 (~₹37,000) are significant costs for Indian students. THM/HTB subscriptions add to this. This is a real accessibility barrier |
| 8 | Exam-report grading quality unknown | CDSA, SAL1, SAL2 | [S] | Vendor report-grading methodology is not publicly documented. Whether reports are human-graded, AI-graded, or rubric-matched is unclear for all except CompTIA (which uses no reports) |
| 9 | Platform-locked learning paths | HTB CDSA | [E] | CDSA requires 100% completion of HTB Academy's SOC path before sitting the exam — a hard gate tied to their subscription |
| 10 | No readiness signal before exam purchase | All | [O] | No vendor provides a calibrated "you are ready to pass" signal before the learner spends $200–$650 on a voucher. Learners rely on community advice and self-assessment |

### What Competitors Do Well (Honesty Check)

| Strength | Who | Notes |
|:---|:---|:---|
| Real tool environments (Splunk, Elastic, Autopsy, Volatility) | THM, HTB, SBT | Candidates practice on the actual tools used in jobs; CyberBLADE's browser simulator cannot fully replicate this |
| Large community and employer recognition | THM, HTB, CompTIA | SAL1/BTL1 are gaining HR recognition; CySA+ is already established; CyberBLADE has none |
| Curated learning paths with hundreds of hours of content | THM, HTB | THM's SOC Level 1 path has 65 labs and 65 hours of content |
| Active content updates tied to CTF/challenge ecosystem | THM, HTB | New rooms/modules monthly; CyberBLADE must build a content pipeline from scratch |

---

## Part A4: Gap Audit — CyberBLADE vs. SOC Skill Matrix

Coverage is assessed against Ranks 0–2 content and existing engine capabilities. "Covered" means taught AND practiced at exam depth.

| # | Skill Domain | Status | Evidence (lesson/lab/engine) | Gap Description |
|:--|:---|:---:|:---|:---|
| 1 | SOC operations & alert handling | **Missing** | No SOC-specific content; no alert-queue workspace | Core missing: no alert-queue, no triage workflow, no escalation decisions |
| 2 | Phishing & email analysis | **Missing** | No email/phishing lessons or labs | Entire domain absent; needs email header parser, link/attachment analysis |
| 3 | Network traffic analysis | **Partial** | Labs: `core-r1-pkt-dns-lab-01`, `core-r1-pkt-http-lab-01`, `core-r1-pkt-scan-lab-01`; Packet engine exists | Packet viewer exists but covers only DNS/HTTP/scan basics; needs PCAP analysis at depth (TLS, C2 beacons, lateral movement) |
| 4 | Network security monitoring | **Missing** | No IDS/IPS/Zeek content | No Snort/Zeek/Suricata lessons or simulated IDS alert output |
| 5 | Windows log analysis | **Partial** | Lessons: `17-win-arch-registry.mdx`, `20-win-logs-sysmon.mdx`; Lab: `core-r1-win-eventlog-lab-01` | Basics covered (Event IDs 4624/4625/7045, Sysmon concepts); needs depth on Event ID matrix, PowerShell logging (4104), Sysmon configs, lateral movement indicators |
| 6 | Linux log analysis | **Partial** | Lesson: `16-logs-ssh-investigate.mdx`; Labs: `core-r1-linux-proc-lab-01`, `core-r1-linux-suid-lab-01` | auth.log and process investigation started; needs syslog correlation, cron/scheduled task detection, persistence mechanisms |
| 7 | Web & application log analysis | **Missing** | Web security lessons cover attacker side only (SQLi, XSS, etc.) | No WAF log analysis, no web server access log investigation, no defender-view web labs |
| 8 | Malware triage concepts | **Missing** | No malware analysis content | Needs safe triage workflow, static analysis concepts, sandbox report reading. No live malware ever |
| 9 | Threat intelligence & enrichment | **Missing** | No TI content | No IOC enrichment, no TI platform concepts, no STIX/TAXII |
| 10 | SIEM querying & correlation | **Partial** | SIEM engine exists (`lib/lab-engine/siem/`); Generator: `siem-investigation.ts`; Lab: `core-r1-siem-log-analysis-01` | One SIEM lab exists with ~12 events. Engine has types but no query language parser. Needs SPL/KQL-style query engine, larger datasets (1000+ events), and correlation rules |
| 11 | IR lifecycle | **Missing** | No IR-specific content | No NIST/SANS IR lifecycle lessons, no containment/eradication/recovery practice |
| 12 | Digital forensics artifacts | **Missing** | No forensics content | Needs disk/memory/registry artifact lessons (conceptual; real tools like Autopsy/Volatility cannot be fully simulated in-browser) |
| 13 | Threat hunting | **Missing** | No hunting content | No hypothesis-driven hunting methodology, no hunt playbook practice |
| 14 | Detection engineering | **Missing** | No detection engineering content | No Sigma/YARA rule writing, no rule testing against log datasets |
| 15 | Active Directory (defender) | **Missing** | No AD content | No AD attack/defense chain content from defender perspective |
| 16 | Cloud security monitoring | **Missing** | No cloud SOC content | No AWS CloudTrail / Azure Activity / M365 audit log analysis |
| 17 | Reporting & communication | **Missing** | `report` lab type planned (spec §7.1) but not built | No report editor, no grading rubric, no IR report template |
| 18 | Vulnerability management | **Missing** | No vuln management content | No CVE/CVSS, no scanner output interpretation, no risk-based prioritization |
| 19 | Automation & scripting for SOC | **Missing** | No SOC automation content | No SOAR concepts, no scripting-for-triage practice |

### Summary

| Status | Count | Percentage |
|:---|:---:|:---:|
| Covered (exam depth) | 0 | 0% |
| Partial (foundation exists, depth lacking) | 4 | 21% |
| Missing | 15 | 79% |

**Existing assets that Phase 3 can reuse:**
- Terminal engine (Linux/Windows command simulation): mature, 50+ commands
- Packet engine (PCAP viewer): functional, needs more protocols
- SIEM engine types + one generator: foundation exists, needs query parser + larger datasets
- Handler (AI tutor): mature, with hints/guardrails/leak resistance
- Readiness engine: functional with coverage matrix, decay, bands
- SM-2 spaced review system: functional with flashcards, queue builder, daily sessions
- Next-best-action engine: functional, extensible to SOC skills
- Mastery overview: functional, extensible
- Rank/XP/streak system: mature
- Content pipeline: 38 lessons, 20 labs, established YAML schema

---

## Part B: "Better Than Typical" Scorecard

This scorecard defines measurable dimensions for evaluating whether the CyberBLADE SOC track is genuinely better than typical SOC certification courses. Public claims must be backed by the evidence column.

| # | Dimension | Target Value | How Measured | Evidence Required Before Public Claim |
|:--|:---|:---|:---|:---|
| 1 | **Distinct attack scenarios** per level | L1: ≥8 base scenarios, L2: ≥6 base scenarios | Count of unique attack-chain families in scenario library | Scenario library published with descriptions (not solutions) |
| 2 | **Variants per scenario** | ≥5 seeded variants per base scenario (different IPs, users, paths, timing) | Count of variants per base scenario that produce different investigation paths | Automated variant verification passing (every variant solvable, no answer leakage) |
| 3 | **Scenario noise realism** | False-positive ratio ≥60% of alerts; missing telemetry in ≥30% of scenarios; ≥1 ambiguous alert per scenario | Measured from scenario definitions (noise_events / total_events) | Published noise ratios per scenario; practitioner reviewer attestation that noise is "realistic" |
| 4 | **Feedback granularity** | Per-skill, per-decision, per-report-section feedback on every mock/practice attempt | Count of feedback dimensions per attempt result | Sample feedback reports shown to 3+ practitioners; ≥80% rate them as "useful" |
| 5 | **Report-grading quality** | Grader–practitioner agreement ≥ κ=0.7 (Cohen's kappa) on a 4-point scale | Blind comparison of AI grader scores vs. 3 practitioner graders on 50+ reports | Full study results published (sample size, κ value, disagreement analysis) |
| 6 | **Mock-exam fidelity** | One mock format per target cert; timing, structure, and skill coverage match published exam format | Side-by-side comparison table: mock format vs. real exam format | Comparison table published; learner surveys confirm "felt like the real exam" (≥70% agreement) |
| 7 | **Price per learner** (exam prep access) | <50% of the cheapest target exam fee for Indian learners (target: <₹8,000/year) | Published pricing | Pricing page live |
| 8 | **Content freshness** | All content reviewed within 6 months; exam version changes reflected within 30 days | `last_reviewed` metadata per lesson; cert registry version tracking | Published freshness dashboard or badge per lesson |
| 9 | **Real learner outcomes** | ≥70% self-reported first-attempt pass rate among learners who reached "Ready" status | Voluntary self-report survey after exam attempt (with date, cert, result) | Minimum sample: 30 learners per cert before publishing a rate; confidence interval stated |
| 10 | **Readiness-score predictive accuracy** | Readiness "Ready" status predicts first-attempt pass with ≥80% accuracy | Compare readiness state at exam attempt date vs. self-reported result | Same sample as #9; published as calibration curve |
| 11 | **Decision training (not tool tutorials)** | ≥50% of lab time spent on triage/escalation/report decisions (not tool-specific queries) | Analysis of lab objectives: classify each as "decision" vs. "tool operation" | Published classification and ratio per lab |
| 12 | **Scenario IP originality** | 0% of scenarios are recognizable copies of any vendor's scenarios | Practitioner review + automated similarity check against public writeups | Signed practitioner attestation per scenario family |

### Claim Policy

- Public marketing may say: "covers skills tested by [cert name]" — verifiable via coverage matrix.
- Public marketing may say: "includes [N] practice scenarios with [M] variants each" — verifiable via published scenario count.
- Public marketing must NOT say: "better than [vendor name]" without the corresponding scorecard evidence row being met.
- Public marketing must NOT imply affiliation with, endorsement by, or partnership with any certification vendor.
- Pass rate claims require the stated sample size and confidence interval.
- "First attempt" language must always be accompanied by: "based on learners who reached 'Ready' status on the platform."
