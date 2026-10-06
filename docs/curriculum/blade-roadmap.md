# B.L.A.D.E Roadmap — Cybersecurity (Purple Team) track

**Status:** Owner-provided curriculum source of truth (2026-10-06).
**Origin:** https://github.com/IamjustaOversizedKidddoo/B.L.A.D.E (MIT licence) — 9 phases, 40 weeks, 200 days.
**Target:** advanced security practitioner / purple team (red team + blue team + research + engineering).
**Use:** this is the roadmap for the general Cybersecurity job track ("Cybersecurity (Purple Team)", track id `purple`). The SOC Analyst and Penetration Tester tracks are derived from it (see `soc-analyst-roadmap.md` and `pentest-vapt-roadmap.md`).

Rules when turning this into platform content:
- The roadmap's *structure and topic list* are ours to follow; lesson text is written original (CLAUDE.md content standard). Named sources (HackTricks, PayloadsAllTheThings, RedTeam-Tools, Red-Team-Playbooks, BlueTeam-Tools, trickest/cve, Sliver, Black Hat Rust) are references for accuracy — never copied.
- Do not carry over the repo's DedSec branding (CLAUDE.md theme rules).
- Offensive topics (C2, red team, privesc, AD attacks) are taught in simulated labs with legal/authorization context and paired detection content.

---

## Phase 1 — Core Foundations: Networking + Linux + Windows + Web (Weeks 1–6)

| Week | Topic | Contents |
|---|---|---|
| 1 | Networking & Protocols | TCP/IP · OSI · IPv4/IPv6 · CIDR · Subnetting · ARP · ICMP · TCP/UDP · DNS · DHCP · NAT · HTTP/HTTPS · TLS · Routing · Firewalls · Proxies · Packet capture · Wireshark · tcpdump |
| 2 | Linux Fundamentals | Filesystems · Users · Groups · Permissions · SUID/SGID · Processes · Services · systemd · Cron · SSH · Bash · Environment variables · /proc · /sys · Logs · Networking · Linux security model + host investigation |
| 3 | Windows & PowerShell | Processes · Services · Registry · ACLs · Tokens · PowerShell · WMI · WinRM · Scheduled tasks · Event logs · Windows security model · UAC · Sysmon |
| 4–5 | Web Architecture & Security | HTTP · Cookies · Sessions · Authentication · Authorization · Same-Origin Policy · CORS · CSRF · JWT · OAuth · APIs · GraphQL · WebSockets · Reverse proxies · CDNs |
| 6 | Security Tooling Foundation | Kali Linux · Nmap · Burp Suite · Git · Python basics · Shell scripting · Networking utilities · Evidence collection |

**Deliverable 1:** Security lab environment — Kali + Windows + Linux + web lab + GitHub.

## Phase 2 — Web Application Security + Recon (Weeks 7–12)

| Week | Topic | Contents |
|---|---|---|
| 7–8 | Reconnaissance | OSINT · DNS · WHOIS · ASN · Subdomains · CT logs · Technology fingerprinting · JavaScript analysis · Endpoint discovery · Nmap · Nuclei · Gobuster · Feroxbuster · SpiderFoot · Shodan · GitHub recon · Cloud asset discovery (ref: RedTeam-Tools, HackTricks) |
| 9–10 | Web Vulnerabilities | SQL injection · NoSQL injection · Command injection · XSS · CSRF · SSRF · XXE · SSTI · LFI/RFI · Path traversal · File upload · Deserialization · Request smuggling · Open redirect · CORS · Prototype pollution (ref: PayloadsAllTheThings, HackTricks) |
| 11–12 | Modern Application & API Security | JWT · OAuth/OIDC · SAML · GraphQL · WebSockets · IDOR/BOLA · Mass assignment · Race conditions · Business logic · API authorization · Parameter pollution · Burp Suite testing · Manual validation · Reporting |

**Deliverable 2:** Web security lab + professional pentest report.

## Phase 3 — Privilege Escalation + Internal Security (Weeks 13–18)

| Week | Topic | Contents |
|---|---|---|
| 13–14 | Linux Privilege Escalation | Enumeration · SUID/SGID · Capabilities · Cron · Services · Weak permissions · PATH issues · SSH · NFS · Containers · Linux post-exploitation concepts (ref: HackTricks, RedTeam-Tools) |
| 15–16 | Active Directory Fundamentals | Domains · DC · Users · Groups · OUs · GPO · LDAP · DNS · Kerberos · NTLM · SPNs · Trusts · Delegation concepts · AD enumeration · BloodHound concepts |
| 17–18 | Windows PrivEsc + Lateral Movement | Services · Registry · ACLs · Tokens · Scheduled tasks · SMB · WMI · WinRM · RDP · Authentication security · Internal discovery · Credential security · Detection opportunities |

**Deliverable 3:** Corporate Active Directory lab — Windows domain + Linux + workstations + attack paths.

## Phase 4 — Vulnerability Research + CVE Intelligence (Weeks 19–21)

| Week | Topic | Contents |
|---|---|---|
| 19 | Vulnerability Fundamentals | CVE · CWE · CVSS · EPSS · Affected versions · Root cause · Attack surface · Exploitability · Patch & mitigation |
| 20 | CVE / PoC Research | Search CVEs · Analyze advisories · Read PoCs · Understand trigger, root cause, impact, patch · Safe reproduction in isolated labs |
| 21 | Automated Vulnerability Intelligence | CVE feed parsing · Version matching · PoC discovery · Vulnerability triage · Reporting · Remediation mapping (ref: trickest/cve) |

**Deliverable 4:** CVE research & intelligence pipeline.

## Phase 5 — Red Team Operations + Adversary Emulation (Weeks 22–27)

| Week | Topic | Contents |
|---|---|---|
| 22–23 | Red Team Methodology | Scope · Rules of engagement · Objectives · OPSEC concepts · Recon · Initial access · Execution · Persistence concepts · Privilege escalation · Discovery · Credential access · Lateral movement (ref: Red-Team-Playbooks, RedTeam-Tools, HackTricks) |
| 24–25 | Command & Control | C2 architecture · Listeners · Sessions · Beacons · Transports · HTTP(S) · DNS · mTLS · Tunneling · Pivoting concepts · Adversary emulation · C2 traffic analysis (ref: Sliver) |
| 26–27 | Full Authorized Red Team Exercise | Recon → Initial access → Discovery → PrivEsc → Lateral movement → Objective · Evidence collection → Timeline → Reporting → Detection gap analysis |

**Deliverable 5:** Full red team engagement report.

## Phase 6 — Blue Team + SOC + Threat Hunting (Weeks 28–32)

| Week | Topic | Contents |
|---|---|---|
| 28 | Security Monitoring | Windows logs · Sysmon · Linux logs · DNS · Network telemetry · Process monitoring · Authentication events · Endpoint visibility |
| 29–30 | SIEM + Detection Engineering | Wazuh · Splunk concepts · Elastic concepts · Log parsing · Correlation · Detection rules · Alerting · False positives · MITRE ATT&CK mapping · Threat detection |
| 31–32 | Threat Hunting + Incident Response | IOC · IOA · TTP · Hunt hypotheses · Investigation · Triage · Containment · Eradication · Recovery · Lessons learned · Endpoint + network + identity investigation (ref: BlueTeam-Tools) |

**Deliverable 6:** SOC + detection engineering lab.

## Phase 7 — Malware Analysis + Digital Forensics (Weeks 33–35)

| Week | Topic | Contents |
|---|---|---|
| 33 | Malware Fundamentals | PE · ELF · Processes · Persistence concepts · Imports/exports · Packing · Obfuscation · Network behavior |
| 34 | Static & Dynamic Analysis | Ghidra · IDA concepts · Strings · Functions · Control flow · YARA · Sandboxing · Process behavior · Network indicators |
| 35 | Digital Forensics | File artifacts · Registry · Memory · PCAP · Timelines · Evidence handling · IOC extraction · Incident reconstruction |

**Deliverable 7:** Malware triage + forensics report.

## Phase 8 — Security Programming + Rust + Tool Development (Weeks 36–38)

| Week | Topic | Contents |
|---|---|---|
| 36 | Rust Fundamentals | Ownership · Borrowing · Structs · Enums · Traits · Error handling · Networking · Concurrency · Async |
| 37 | Security Tool Engineering | Async scanners · HTTP clients · Crawlers · Parsers · Fuzzing concepts · Binary/data processing · Protocol tooling · Automation |
| 38 | Low-Level Security Concepts | Memory safety · FFI · Assembly fundamentals · Binary analysis · Security research · Cross-platform tooling (ref: Black Hat Rust) |

**Deliverable 8:** Personal security toolkit — Python + Rust security utilities / research tools.

## Phase 9 — Purple Team + Automation + Capstone (Weeks 39–40)

| Week | Topic | Contents |
|---|---|---|
| 39 | Red ↔ Blue Integration | Attack → Telemetry → Detection → Investigation → Response → Control improvement → Retest |
| 40 | Final Capstone | Enterprise lab (web + Linux + Windows + AD) · Recon · Authorized attack simulation · Detection · Hunting · Incident response · Forensics · Reporting · Automation · GitHub documentation · Architecture diagrams · Portfolio |

**Final deliverable:** "Purple Team Security Operations Platform".

**Outcome:** Red team → blue team → security research → automation → purple team. Web security · AD · Cloud · SOC · DFIR · C2 · Vulnerability research · Malware · Rust · Tooling.
