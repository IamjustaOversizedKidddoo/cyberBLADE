# CyberBLADE Platform: Phase 2 Progress & Forward Roadmap Report

**Created:** 2026-10-10  
**Last Updated:** 2026-10-10  
**Status:** In Progress — Phase 2A (Complete), Phase 2B (Complete), Phase 2C (Complete), Phase 2D (Next)  
**Branch Tracking:** Local-first on `main`, feature branches per phase

---

## 1. Executive Summary

This report tracks all architecture, content, engine, lab, and challenge deliverables across **Phase 2 (Core Complete + Handler + Beta)** of the CyberBLADE cybersecurity platform.

### Phase Status Overview

| Sub-Phase | Focus Area | Status | Deliverables |
|---|---|---|---|
| **2A** | **Rank 1 · Networking** | ✅ **Complete** | 9 lessons, packet engine, 3 packet labs, cert coverage (`netplus`, `secplus`) |
| **2B** | **Rank 1 · Linux** | ✅ **Complete** | 7 lessons, Linux machine simulator, 3 terminal labs (`perms`, `proc`, `suid`), cert coverage (`linuxplus`) |
| **2C** | **Rank 1 · Windows & PowerShell + Capstone** | ✅ **Complete** | Windows/PowerShell simulation, registry & event log triage labs, Orders 17–20, Rank 1 Capstone Challenge (`core-r1-challenge-01`), Operator → Watcher (Rank 2) promotion |
| **2D** | **The Handler (AI Tutor)** | 🟡 **Next Up** | Socratic AI assistant drawer, Groq/Gemini multi-model routing, 3-tier progressive hint disclosure, strict solution/flag leakage guardrails |
| **2E** | **Exam Readiness & Gamification** | ⬜ Planned | Cert readiness calculators (A+, Network+, Linux+, Security+, ISC2 CC), streak tracker, badge showcase |
| **2F** | **Rank 2 · Watcher (Web Security)** | ⬜ Planned | `webapp` in-browser iframe lab runner, OWASP Top 10 attack/defense modules |
| **2G** | **Hosted Beta Foundation** | ⬜ Planned | Supabase Auth (Email + Google OAuth) + Postgres + RLS, production deployment |

---

## 2. Phase 2B Deliverables (Complete)

Phase 2B delivered the comprehensive Linux systems and security module for Rank 1 (Operator):

### 1. Terminal Shell Extensions & Virtual Machine
- Virtual identity subsystem: `whoami`, `id`, `groups`, `su`
- File permission engines: `chmod`, `chown`, `umask`, `find` (with `-perm`, `-type`, `-name`)
- Process subsystem: `ps`, `ps -ef`, `ps aux`, `pgrep`, `kill`, `/proc/<pid>` (`cmdline`, `status`, `exe`, `cwd`)
- Services and privilege delegation: `systemctl` (status, list-units), `sudo` (rule parser, `sudo -l`, `/var/log/auth.log` telemetry), `/etc/sudoers`
- Linux demo machine ([demo-world.ts](file:///d:/CYBER-PLATFORM/lib/lab-engine/terminal/demo-world.ts)): realistic background daemons, cron jobs, SUID/SGID binaries, auth logs.

### 2. Rank 1 Linux Labs
- `core-r1-linux-perms-lab-01`: Permissions audit, octal calculation, world-writable file hunt.
- `core-r1-linux-proc-lab-01`: Disguised malware hunt in `/tmp`/`/dev/shm`, PPID correlation, remote C2 parsing.
- `core-r1-linux-suid-lab-01`: SUID baseline comparison, non-standard SUID discovery, `sudo -l` audit.
- Generators tested and validated across 1,000 unique seeds with property tests.

### 3. Rank 1 Linux Lessons (`content/core/rank-1/`)
- Lessons 10–16 authored with full 7-part briefing format, terminal checks, debriefs, and 4 questions each (`.checks.yaml`).
- All terminal examples captured against `demoWorld()`.
- Marked `status: draft` pending final human subject-matter expert review.

---

## 3. Phase 2C Deliverables (Complete)

Phase 2C delivered the Windows and PowerShell subsystem, forensic triage labs, Windows curriculum, and the flagship Rank 1 Capstone Challenge promoting operators to Rank 2 (Watcher).

### 1. Windows Architecture & PowerShell Simulator
- Built virtual registry hive engine in `lib/lab-engine/terminal/windows/registry.ts`:
  - Full support for `HKLM:\` and `HKCU:\` hives.
  - Autostart execution points: `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`, `RunOnce`, Services.
- Built Windows Event Log simulator in `lib/lab-engine/terminal/windows/eventlog.ts`:
  - Standard Windows Security & System channels.
  - Event IDs: 4624 (Logon Success), 4625 (Logon Failure / Brute-force), 7045 (New Service Installed), 4688 (Process Creation), Sysmon Event 1 (Process with CLI args).
- Implemented authentic PowerShell cmdlet and alias suite in `lib/lab-engine/terminal/commands/powershell/`:
  - `Get-ItemProperty` (`gp`): reads registry key values with case-insensitive property lookups.
  - `Get-WinEvent`: query filtering by `-LogName`, `-FilterHashtable @{Id=...; LogName=...}`, `-MaxEvents`.
  - `Select-String` (`sls`): regex and pattern matching across pipeline streams and files with line numbering.
  - `Get-Service` (`gsv`): lists Windows services with status, display names, and binary paths.
  - `Get-Process` (`ps`, `gps`): lists running processes with PID, Handles, NPM, PM, WS, and CPU metrics.
  - `Get-ScheduledTask`: enumerates scheduled tasks and action payloads.
  - `whoami`, `whoami /priv`, `whoami /groups`: Windows security context readouts.
- Upgraded `parser.ts` to cleanly handle Windows backslashes in paths and preserve hashtable semicolons (`@{...}`).

### 2. Windows Forensic Triage Labs
- `core-r1-win-registry-lab-01` ("Registry ASEP Hunter"):
  - Hunt persistence mechanisms planted by APT/malware actors in Registry Run keys.
  - Identify suspicious binary paths and decode disguised payload arguments.
- `core-r1-win-eventlog-lab-01` ("Security Event Log Triage"):
  - Query Security event logs with `Get-WinEvent` to investigate password spraying and brute-force attacks (Event ID 4625).
  - Triage unauthorized service installations (Event ID 7045).
- Both lab generators verified across 1,000 distinct seeds with 100% flag determinism.

### 3. Rank 1 Windows Lessons (`content/core/rank-1/`)
- Authored Orders 17 through 20 with full 7-part briefing format, exact terminal verification, and 4-question checks:
  - **Lesson 17 (`17-win-arch-registry`)**: Windows Architecture, Filesystem and the Registry (`core-r1-win-arch-01`).
  - **Lesson 18 (`18-win-powershell`)**: PowerShell Fundamentals & Administration (`core-r1-win-ps-01`).
  - **Lesson 19 (`19-win-proc-services`)**: Windows Processes, Services and Scheduled Tasks (`core-r1-win-proc-01`).
  - **Lesson 20 (`20-win-logs-sysmon`)**: Windows Event Logs, Sysmon and Host Triage (`core-r1-win-logs-01`).
- All interactive terminal checks pass with 0 syntax or output mismatches.

### 4. Rank 1 Capstone Challenge (`core-r1-challenge-01`)
- **"Operation Iron Gate"**: A 30-minute timed incident response operation.
- 5 comprehensive multi-domain objectives spanning the complete Rank 1 curriculum:
  1. *Network Perimeter Investigation*: Extract C2 IP communicating over anomalous port from PCAP capture.
  2. *Linux Host Intrusion Triage*: Uncover unauthorized SUID backdoor implanted in system directories.
  3. *Linux Authentication Forensics*: Identify targeted username subjected to brute-force attack from `/var/log/auth.log`.
  4. *Windows Persistence Discovery*: Query Registry `Run` keys with `Get-ItemProperty` to uncover persistence payload.
  5. *Windows Privilege Audit*: Locate unauthorized administrative service installed via Event ID 7045.
- Tested and verified across 1,000 randomized seeds.
- Promotes operator from **Rank 1 (Operator)** to **Rank 2 (Watcher)** upon completion (+400 XP, rank up celebration screen).

### 5. Automated Verification Gates
- **Typecheck:** 0 TypeScript errors across the entire codebase.
- **Lint:** 0 ESLint errors or warnings.
- **Content Check:** 26 lessons, 15 labs, 26 objectives verified and valid.
- **Vitest Suite:** 106 test files passed, 705 unit & property tests passed (100%).
- **Build:** Next.js Turbopack production build compiled with 0 errors.
- **Playwright E2E:** Full user journey tests passing on desktop and mobile viewports (`tests/e2e/rank-1-windows.spec.ts` & `tests/e2e/rank-1-challenge.spec.ts`).

---

## 4. Phase 2D: The Handler (Socratic AI Tutor) — Next Up

Phase 2D builds the embedded AI coaching system that mentors students through hints without ever spoiling solutions.

### Key Objectives
1. **Drawer UI Component:**
   - Slide-out or collapsible terminal-side panel with blade styling.
   - Live context awareness: passes current lab ID, objective index, recent terminal commands, and error output to the prompt context.
2. **Multi-Model Provider Integration:**
   - Groq (e.g. `llama-3.3-70b-versatile` or `mixtral-8x7b-32768`) for sub-second low latency hints.
   - Google Gemini 1.5/2.0 Flash for structured deep diagnostic feedback when Groq is unavailable or rate-limited.
   - Fallback offline heuristic hint provider for zero-API/local environments.
3. **Three-Tier Progressive Hint Disclosure:**
   - **Tier 1 (Nudge):** Concept reminder and relevant command syntax (costs 0 penalty).
   - **Tier 2 (Direction):** Specific file or log path to investigate with suggested flags (-5 XP).
   - **Tier 3 (Walkthrough):** Step-by-step methodology guidance (-10 XP, strictly forbids outputting the raw flag).
4. **Guardrails & Anti-Cheat System:**
   - System prompts enforce strict negative constraints: never generate raw flags (`FLAG{...}` or regex matches), never execute commands directly on behalf of the user, never bypass the current objective.

---

## 5. Phase 2E: Exam Readiness Engine & Gamification (Planned)

### Key Objectives
1. **Certification Mapping & Readiness Scorecard:**
   - Mappings against CompTIA A+ (Core 1 & 2), Network+, Security+, Linux+, and ISC2 Certified in Cybersecurity (CC).
   - Weighted mastery scoring based on lesson check completion and lab execution times.
2. **Gamification & Habit Loops:**
   - Daily streak tracker with freeze mechanics.
   - Activity heatmaps on the operator dashboard.
   - Achievement badges (e.g., "Packet Surgeon", "Root Hunter", "PowerShell Warden", "Iron Gate Survivor").

---

## 6. Phase 2F: Rank 2 · Watcher (Web Security Core) (Planned)

### Key Objectives
1. **Web App Sandbox Runner (`webapp`):**
   - Sandboxed iframe lab runner with simulated browser address bar, HTTP request/response inspector, and cookie jar viewer.
2. **Rank 2 Curriculum (Orders 21–32):**
   - HTTP protocol deep dive, cookies, headers, sessions, and same-origin policy.
   - OWASP Top 10 hands-on exploitation & remediation:
     - SQL Injection (Error-based, Union-based, Blind).
     - Cross-Site Scripting (Reflected, Stored, DOM).
     - Authentication & Session Hijacking.
     - Broken Object-Level Authorization (BOLA/IDOR).
     - Server-Side Request Forgery (SSRF) and Command Injection.
3. **Rank 2 Capstone Challenge:**
   - Multi-stage web application security audit & defense operation.

---

## 7. Phase 2G: Hosted Closed Beta Foundation (Planned)

### Key Objectives
1. **Supabase Backend Migration:**
   - Schema migration from local JSON file storage (`.data/`) to Supabase Postgres.
   - Row Level Security (RLS) policies guaranteeing operator isolation.
2. **Authentication:**
   - Supabase Auth supporting Email Magic Links and Google OAuth.
3. **Production Deployment:**
   - Vercel production deployment with custom domain, edge middleware, and security headers (CSP, HSTS).
