# SOC Analyst Track Roadmap

**Status:** Draft for owner review (2026-10-07). Inspired by the B.L.A.D.E roadmap (`blade-roadmap.md`) — mainly its Blue Team, Malware and Forensics phases — re-cut for one job: SOC Analyst (L1 → L2).
**Benchmarks to exceed (spec §4.2):** Security+, CompTIA CySA+, Blue Team Level 1, Splunk Core User, GIAC GCIH/GSOC-level topics.
**Prerequisite:** shared core (Rank 0 + Ranks 1–2, built from B.L.A.D.E Phase 1).
**Length:** ~16 weeks, 14 modules. Each module = lessons (teaching-style.md) + browser labs (`siem`, `packet`, `terminal`, `report`) + a module mini-lab.

**Design rule:** a SOC analyst's job is to notice, investigate, decide and report. Every module ends with the learner doing that on generated data, and writing it up.

| # | Module | What the learner can do after it | Built on B.L.A.D.E |
|---|---|---|---|
| 1 | Log sources & telemetry | Name the main log sources in a company and say what each one can and can't show | W28 |
| 2 | SIEM & search | Search, filter, group and chart events in the platform SIEM; build a simple dashboard | W29 |
| 3 | Alert triage | Work an alert queue: decide true/false positive, set priority, write ticket notes, know when to escalate | W29–30 |
| 4 | Email & phishing analysis | Read email headers, check links and attachments safely, decide if an email is malicious | W4–5 (web basics) |
| 5 | Endpoint investigation | Read process, service and login activity on Windows and Linux and spot what doesn't belong | W2–3, W28 |
| 6 | Network investigation | Use packet captures and flow/DNS/proxy logs to follow a connection and spot unusual traffic | W1, W24–25 (traffic analysis) |
| 7 | Identity & Active Directory activity | Understand normal sign-in and account activity and recognise suspicious patterns | W15–18 (defender view) |
| 8 | Web & cloud logs | Read web server, WAF and cloud audit logs and recognise attack attempts against apps | W9–12 (defender view) |
| 9 | Threat intelligence & vulnerabilities | Use IOCs and threat reports; understand CVE/CVSS well enough to prioritise | W19, W21 |
| 10 | Detection engineering | Write, test and tune detection rules (Sigma-style), map them to MITRE ATT&CK, cut false positives | W29–30 |
| 11 | Threat hunting | Form a hunt hypothesis, search for it, and record what was and wasn't found | W31 |
| 12 | Incident response | Follow the NIST lifecycle: triage, contain, eradicate, recover, lessons learned; build a timeline | W32 |
| 13 | Malware triage & forensics basics | Do safe first-look triage of a suspicious file and collect basic forensic evidence correctly | W33–35 |
| 14 | Automation, AI & reporting | Automate a repetitive check with Python; use AI-assisted triage and verify its verdicts; write incident reports and escalations | W37, spec §6 |

## Deliverables (portfolio — spec success criterion 2)

1. SIEM investigation notebook (modules 1–3)
2. Phishing analysis report (module 4)
3. Detection rule pack with tests and ATT&CK mapping (module 10)
4. Full incident report with timeline (modules 12–13)

## Track exam (spec §5.2)

8-hour simulated SOC shift: 60+ alerts (mostly noise) with 3 real incidents hidden inside; triage, investigate, write incident reports. Pass → SOC Analyst certificate + `/verify` page.
