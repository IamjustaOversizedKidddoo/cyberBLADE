# CyberBLADE Platform: Phase 2 Progress & Forward Roadmap Report

**Created:** 2026-10-10  
**Status:** In Progress — Phase 2A (Complete), Phase 2B (Complete), Phase 2C (Starting)  
**Branch Tracking:** Local-first on `main`, feature branches per phase

---

## 1. Executive Summary

This report tracks all architecture, content, engine, and challenge deliverables across **Phase 2 (Core Complete + Handler + Beta)** of the CyberBLADE cybersecurity platform.

### Phase Status Overview

| Sub-Phase | Focus Area | Status | Deliverables |
|---|---|---|---|
| **2A** | **Rank 1 · Networking** | ✅ Complete | 9 lessons, packet engine, 3 packet labs, cert coverage (`netplus`, `secplus`) |
| **2B** | **Rank 1 · Linux** | ✅ Complete | 7 lessons, Linux machine simulator, 3 terminal labs (`perms`, `proc`, `suid`), cert coverage (`linuxplus`) |
| **2C** | **Rank 1 · Windows & PowerShell + Capstone** | 🟡 **Active** | Windows/PowerShell simulation, event log & registry triage, Rank 1 timed challenge, Operator → Watcher promotion |
| **2D** | **The Handler (AI Tutor)** | ⬜ Planned | Socratic AI assistant drawer, Groq/Gemini integration, progressive hint engine |
| **2E** | **Exam Readiness & Gamification** | ⬜ Planned | Cert progress gauges (Network+, Linux+, Security+), streak tracker, badge system |
| **2F** | **Rank 2 · Watcher (Web Security)** | ⬜ Planned | Web application sandbox labs (OWASP Top 10, Auth, Sessions, JWT, APIs) |
| **2G** | **Hosted Beta Foundation** | ⬜ Planned | Supabase Auth (Email + Google OAuth) + Postgres + Vercel deployment |

---

## 2. Phase 2B Deliverables (Completed & Merged)

Phase 2B delivered the comprehensive Linux systems and security module for Rank 1 (Operator):

### 1. Terminal Shell Extensions & Virtual Machine
- Virtual identity system: `whoami`, `id`, `groups`, `su`
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

## 3. Phase 2C Deliverables (In Progress)

### Goals
1. Complete the final module of Rank 1: **Windows & PowerShell**.
2. Build simulated PowerShell commands and virtual Windows subsystems.
3. Author Windows lessons and interactive labs.
4. Implement the **Rank 1 Capstone Challenge**: a timed multi-domain incident response operation combining Networking, Linux, and Windows to promote learners from **Rank 1 (Operator)** to **Rank 2 (Watcher)**.

### Detailed Scope & Specifications

#### Part 1: PowerShell Command Simulator
- Command interpretation supporting standard PowerShell aliases and cmdlets:
  - `Get-ChildItem` (`dir`, `ls`) with `-Recurse`, `-Force`, `-Hidden`
  - `Get-Content` (`cat`, `type`), `Select-String` (`sls`)
  - `Get-Process` (`ps`, `gps`), `Stop-Process` (`kill`, `spps`)
  - `Get-Service` (`gsv`), `Start-Service`, `Stop-Service`
  - `Get-ItemProperty` / `Get-Item` for Windows Registry (`HKLM:\`, `HKCU:\`)
  - `Get-WinEvent` / `Get-EventLog` for Windows Event Logs (Event IDs: 4624 Successful Logon, 4625 Failed Logon, 7045 Service Installation, 4688 Process Creation, Sysmon Event 1)
  - `Get-ScheduledTask` for Windows Task Scheduler
  - `whoami`, `whoami /priv`, `whoami /groups`

#### Part 2: Windows Virtual Machine & World Generator
- Virtual Windows filesystem (`C:\Windows`, `C:\Program Files`, `C:\Users\<user>`)
- Virtual Registry hive (`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` persistence keys)
- Virtual Security Event Log stream with realistic telemetry and attacker brute-force / persistence traces.

#### Part 3: Windows Labs
- `core-r1-win-registry-lab-01`: Triage autostart execution points (ASEPs) and registry run keys.
- `core-r1-win-eventlog-lab-01`: Hunt brute-force password spraying and suspicious service installations via `Get-WinEvent`.

#### Part 4: Windows Lessons (Orders 17–20)
- Lesson 17: Windows Architecture, Filesystem and the Registry (`core-r1-win-arch-01`)
- Lesson 18: PowerShell Fundamentals & Administration (`core-r1-win-ps-01`)
- Lesson 19: Windows Processes, Services and Scheduled Tasks (`core-r1-win-proc-01`)
- Lesson 20: Windows Event Logs, Sysmon and Host Triage (`core-r1-win-logs-01`)

#### Part 5: Rank 1 Capstone Challenge & Promotion
- Timed challenge lab (`challenge: true`, 30 minutes, 5 objectives across Network + Linux + Windows).
- Completion gates promotion from Rank 1 (Operator) to Rank 2 (Watcher).
- Rank 1 completion badge and unlocked access to Rank 2 curriculum.

---

## 4. Phase 2D–2G Roadmap (Upcoming)

### Phase 2D: The Handler (Socratic AI Tutor)
- Drawer component embedded in terminal and packet lab workspaces.
- LLM backend routing (Groq for low-latency fast hints, Gemini for detailed diagnostic guidance).
- Guardrails: 3-tier progressive hint disclosure, strict negative constraints preventing solution disclosure or flag leaks.

### Phase 2E: Exam Readiness Engine & Gamification
- Dynamic readiness calculation against mapped certs: CompTIA A+, Network+, Linux+, Security+, and ISC2 CC.
- Daily streak tracker, activity heatmaps, and achievement badges.

### Phase 2F: Rank 2 · Watcher (Web Security Core)
- New lab runner type: `webapp` (sandboxed in-browser iframe targets).
- Modules covering OWASP Top 10: SQL Injection, XSS, CSRF, Broken Access Control, JWT tampering, SSRF, API flaws.

### Phase 2G: Hosted Closed Beta Foundation
- Migration from local `.data/` stores to Supabase (Postgres with Row Level Security).
- Supabase Auth (Email magic link + Google OAuth).
- Deployment pipeline to Vercel production preview.
