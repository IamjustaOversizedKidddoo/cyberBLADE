# CyberBLADE Platform: Roadmap & Progress Report

**Document Status:** Active & Maintained  
**Last Updated:** 2026-10-10  
**Current Phase:** Phase 2 (Core Complete + Handler) — Phase 2C underway  

---

## 1. Executive Summary & Platform Status

The CyberBLADE platform is an adversarial cybersecurity training platform providing local-first, realistic interactive simulation without per-user cloud compute costs in v1. 

### Phase Progress Matrix

| Phase | Description | Status | Key Deliverables |
|---|---|---|---|
| **Phase 0** | Foundation & App Skeleton | ✅ Complete | Next.js 16 (Turbopack), Tailwind v4, design tokens, local operator store |
| **Phase 1** | Learning Engine + Rank 0 | ✅ Complete | 6 foundational lessons, virtual terminal, Rank 0 capstone challenge, rank gates |
| **Visual Art** | Cinematic Interface System | ✅ Complete | Awwwards-tier dark cyber aesthetic, landing page scenes, dashboard, course map |
| **Phase 2A** | Rank 1 · Networking | ✅ Complete | 9 lessons, packet capture engine, 3 packet inspection labs (SYN scan, DNS, HTTP) |
| **Phase 2B** | Rank 1 · Linux | ✅ Complete | 7 lessons, virtual Linux machine (processes, services, sudoers, SUID), 3 labs |
| **Phase 2C** | Rank 1 · Windows & Capstone | 🟡 **In Progress** | Windows/PowerShell fundamentals, Event Log/Registry labs, Rank 1 Capstone |
| **Phase 2D** | The Handler (AI Tutor) | ⬜ Queued | In-lab Socratic guidance drawer via Groq / Gemini APIs |
| **Phase 2E** | Exam Readiness & Streaks | ⬜ Queued | CompTIA (A+, Net+, Sec+, Linux+) & ISC2 CC readiness scoring |
| **Phase 2F** | Rank 2 · Web Security Core | ⬜ Queued | In-browser sandboxed vulnerable web apps (OWASP Top 10, Auth, API security) |
| **Phase 2G** | Hosted Cloud Foundation | ⬜ Queued | Supabase Auth (Email + Google), Postgres database, Vercel deployment |
| **Phase 3** | SOC Analyst Track | ⬜ Backlog | First specialized job track, SIEM console (DuckDB-WASM), incident reports |
| **Phase 4** | Public Launch & Payments | ⬜ Backlog | Razorpay integration, tier pricing, legal agreements, domain hosting |
| **Phase 5** | Pentest / VAPT Track | ⬜ Backlog | Simulated internal networks, exploit workflows, remediation reports |
| **Phase 6** | Cloud Security Track | ⬜ Backlog | Mock cloud console (IAM, S3, EC2, CloudTrail), policy evaluation |
| **Phase 7** | Purple Team Flagship Track | ⬜ Backlog | Full B.L.A.D.E curriculum (Phases 1–9) |
| **Phase 8** | v2 Container Labs & Real VMs | ⬜ Backlog | Real Docker/VM infrastructure, proctoring, enterprise features |

---

## 2. Phase 2B Deliverables (Completed & Merged)

Phase 2B expanded the platform's simulated terminal into an authentic Linux environment and shipped the Linux learning curriculum.

### Architecture Delivered:
1. **Multi-User & Group Identity System (`lib/lab-engine/terminal/identity.ts`)**:
   - Parses `/etc/passwd` and `/etc/group`.
   - Real Linux permission hierarchy: User bits → Group bits (if caller in group) → Other bits.
   - SUID (`4000`), SGID (`2000`), Sticky Bit (`1000`), and dynamic `umask`.
   - Commands: `id`, `groups`, `whoami`, `chmod`, `chown`, `chgrp`, `umask`.
2. **Process Management & Virtual `/proc` (`lib/lab-engine/terminal/processes.ts`, `procfs.ts`)**:
   - Full process hierarchy with PIDs, PPIDs, and terminal associations.
   - Real `/proc/<pid>/cmdline`, `status`, `stat`, `cwd`, and `exe`.
   - Commands: `ps`, `ps -ef`, `ps aux`, `pgrep`, `kill` (SIGTERM 15, SIGKILL 9, SIGHUP 1).
3. **Services, Sudoers & Security Telemetry (`services.ts`, `sudoers.ts`)**:
   - Systemd unit states (active/running, inactive/dead, failed) via `systemctl status` and `systemctl list-units`.
   - Sudoers rule evaluation (`Defaults`, `ALL`, and `NOPASSWD` rules).
   - Immutable security audit logging to `/var/log/auth.log` on every `sudo` execution.
4. **Linux Labs (`labs/`)**:
   - `core-r1-linux-perms-lab-01`: File permissions puzzle & world-writable audit (`T1222.002`).
   - `core-r1-linux-proc-lab-01`: Process hunt for disguised malware in `/tmp` and `/dev/shm` (`T1057`, `T1036.005`).
   - `core-r1-linux-suid-lab-01`: SUID and sudoers privilege escalation audit (`T1548.001`, `T1548.003`).
5. **Curriculum (7 Lessons in `content/core/rank-1/`)**:
   - Lessons 10 through 16 covering filesystem hierarchy, users/groups, permissions, special bits, processes, services, and log/SSH triage.
   - 4 checks each (28 questions total).
   - Real-world incident debriefs (Kinsing, Baron Samedit, Dirty COW, PwnKit, XZ Utils, Shellshock, Ebury).
6. **E2E & Quality Gates**:
   - Playwright desktop test solving SUID lab completely via in-terminal commands.
   - Playwright mobile test verifying responsive layout without horizontal overflow.
   - 100 vitest test files (675 unit/integration tests) passing across 1,000 seeds.

---

## 3. Detailed Breakdown: What Needs to be Done from Phase 2B Onwards

### 🟡 Phase 2C — Rank 1 · Windows & PowerShell + Rank 1 Capstone Challenge
**Objective:** Complete Rank 1 (Operator), providing full coverage of the three operating system pillars (Networking, Linux, Windows), and unlock promotion to Rank 2.
1. **Windows & PowerShell Engine Simulation**:
   - Simulated PowerShell cmdlets: `Get-Process`, `Stop-Process`, `Get-Service`, `Start-Service`, `Get-Item`, `Get-Content`, `Get-ChildItem`.
   - Windows filesystem conventions (`C:\`, `C:\Windows\System32`, `C:\Users\`).
   - Virtual Registry (`HKLM`, `HKCU`, Run keys for persistence).
   - Windows Event Log simulation (Security Event IDs 4624 successful logon, 4625 failed logon, Sysmon Event 1 process creation).
2. **Rank 1 Windows Lessons**:
   - Lesson 17: Windows Architecture, Objects, and the PowerShell Pipeline.
   - Lesson 18: Windows Services, Processes, and Sysinternals basics.
   - Lesson 19: The Registry, Persistence, and Scheduled Tasks.
   - Lesson 20: Windows Event Logs, Sysmon, and Host Investigation.
3. **Rank 1 Windows Labs**:
   - `core-r1-win-registry-lab-01`: Hunting persistence in the Windows Registry Run keys.
   - `core-r1-win-eventlog-lab-01`: Triage brute force attacks and privilege elevation in Security Event Logs.
4. **Rank 1 Capstone Challenge**:
   - Timed, multi-objective challenge combining Network packet triage, Linux host investigation, and Windows PowerShell analysis.
   - Successful completion promotes operator from **Rank 1 (Operator)** to **Rank 2 (Watcher)**.

---

### ⬜ Phase 2D — The Handler (In-Lab AI Socratic Tutor)
**Objective:** Deliver an AI mentor that assists learners inside labs without ever giving away answers.
1. **API Integration**: Dual backend supporting Groq (ultra-low latency Llama 3) with fallback to Gemini 2.5 Flash.
2. **Socratic Prompts & Guardrails**:
   - Strict persona: Veteran cybersecurity handler.
   - Escalation tiers: Guides through hints 1, 2, 3 based on learner's input.
   - Hard bans: Never reveals flags, exact command answers, or raw solutions.
3. **Lab UI Integration**: Collapsible side drawer with chat history and context injection (current objective, executed command history, errors).

---

### ⬜ Phase 2E — Exam Readiness Engine & Gamification
**Objective:** Bridge daily learning to tangible commercial certifications.
1. **Cert Mapping Matrix**:
   - CompTIA Network+ (`N10-009`), Security+ (`SY0-701`), Linux+ (`XK0-006`), A+ (`220-1201/1202`), and ISC2 CC.
   - Visual readiness gauges on the dashboard calculating objective mastery percentages.
2. **Streaks & Operator Milestones**:
   - Daily streaks, XP velocity badges, operational commendations.

---

### ⬜ Phase 2F — Rank 2 · Watcher (Web Security Core)
**Objective:** The second rank tier introducing Web Application Security.
1. **Sandboxed Webapp Lab Engine**: In-browser client-side vulnerable web applications (shop, banking portal, intranet).
2. **Curriculum**: HTTP deep-dive, sessions, CORS, CSRF, JWT tampering, SQLi basics, XSS, and API vulnerabilities.

---

### ⬜ Phase 2G — Hosted Cloud Foundation (Closed Beta Release)
**Objective:** Graduate the local-first application into a public beta.
1. **Auth & Identity**: Supabase Auth (Email magic links + Google OAuth).
2. **Database Migration**: Postgres schema replacing `.data/*.json` with Row Level Security (RLS).
3. **Deployment**: Production deployment on Vercel with staging environments and automated CI gates.

---

## 4. Human Expert Review & Audit Checklist (Action Items for Owner)

- [ ] **Review 7 Linux Lessons**: All lessons are currently marked `status: draft`. Review explanations, tone, and technical details in `content/core/rank-1/10-fs-shell.mdx` through `16-logs-ssh-investigate.mdx`.
- [ ] **Verify Cert Objective Codes**:
  - CompTIA Linux+ (`XK0-006`): Verify domain IDs `linuxplus:1`, `2`, `3`, `5` against the official CompTIA objectives PDF.
  - CompTIA Security+ (`SY0-701`): Verify objectives `secplus:2.4`, `2.5`, `4.1`, `4.6`.
