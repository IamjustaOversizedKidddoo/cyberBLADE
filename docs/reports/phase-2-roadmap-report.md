# CyberBLADE Platform: Phase 2 Progress & Forward Roadmap Report

**Created:** 2026-10-10  
**Last Updated:** 2026-10-10  
**Status:** In Progress — Phase 2A (Complete), Phase 2B (Complete), Phase 2C (Complete), Phase 2D (Complete), Phase 2E (Complete), Phase 2F (Complete), Phase 2G (Next Up)  
**Branch Tracking:** Local-first on `main`, feature branches per phase

---

## 1. Executive Summary

This report tracks all architecture, content, engine, lab, tutor, and challenge deliverables across **Phase 2 (Core Complete + Handler + Beta)** of the CyberBLADE cybersecurity platform.

### Phase Status Overview

| Sub-Phase | Focus Area | Status | Deliverables |
|---|---|---|---|
| **2A** | **Rank 1 · Networking** | ✅ **Complete** | 9 lessons, packet engine, 3 packet labs, cert coverage (`netplus`, `secplus`) |
| **2B** | **Rank 1 · Linux** | ✅ **Complete** | 7 lessons, Linux machine simulator, 3 terminal labs (`perms`, `proc`, `suid`), cert coverage (`linuxplus`) |
| **2C** | **Rank 1 · Windows & PowerShell + Capstone** | ✅ **Complete** | Windows/PowerShell simulation, registry & event log triage labs, Orders 17–20, Rank 1 Capstone Challenge (`core-r1-challenge-01`), Operator → Watcher (Rank 2) promotion |
| **2D** | **The Handler (AI Tutor)** | ✅ **Complete** | Socratic AI assistant drawer, Groq/Gemini multi-model routing + Heuristic fallback, 3-tier progressive hint disclosure, strict solution/flag leakage guardrails, challenge mode lockout |
| **2E** | **Exam Readiness & Gamification** | ✅ **Complete** | Cert readiness scorecards (CompTIA Security+, Network+, Linux+, A+ Core 1 & 2, ISC2 CC), streak engine, 7-day telemetry HUD, 11-badge honors wall, dashboard integration |
| **2F** | **Rank 2 · Watcher: Web Security Core** | ✅ **Complete** | `webapp` in-browser iframe lab runner, OWASP Top 10 labs (SQLi, XSS, IDOR), Orders 21–32 (12 lessons), Rank 2 Capstone Challenge ("Operation Watchtower"), Operator → Hunter (Rank 3) promotion |
| **2G** | **Hosted Beta Foundation** | 🟡 **Next Up** | Supabase Auth (Email + Google OAuth) + Postgres + RLS, production deployment |

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
  - `Get-Service` (`gsv`), `Get-Process` (`ps`, `gps`), `Get-ScheduledTask`.
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
- 5 comprehensive multi-domain objectives spanning the complete Rank 1 curriculum (Network, Linux, Windows).
- Tested and verified across 1,000 randomized seeds.
- Promotes operator from **Rank 1 (Operator)** to **Rank 2 (Watcher)** upon completion (+400 XP, rank up celebration screen).

---

## 4. Phase 2D Deliverables (Complete)

Phase 2D delivered **The Handler**, CyberBLADE's signature in-platform Socratic AI tutor, embedded into lessons, labs, and challenge views.

### 1. Professor Mode Engine (`lib/handler/`)
- Implements the platform's binding **Teaching Style Guide** (`docs/curriculum/teaching-style.md`):
  - 5-second rule: What is it in 1–2 simple sentences first!
  - Simple explanation first, technical definition after.
  - Zero jargon without translation.
  - Real-world cybersecurity analogies (IP = house address, port = numbered door, firewall = security guard, DNS = phonebook, IAM = security desk, SIEM = control room).
  - Dedicated responses to core learner commands: `what is X?`, `why?`, `explain again`, `simplify`, `deep dive`, `example`, `diagram` (ASCII architecture diagrams), `test` (5-question check), `interview`, `revision`, `recap`, `hint`.

### 2. Multi-Model Provider Architecture
- **Resilient Fallback Chain (`factory.ts`)**:
  - **Groq Provider (`groq.ts`)**: Ultra-low latency inference (`llama-3.3-70b-versatile` / `GROQ_API_KEY`).
  - **Gemini Provider (`gemini.ts`)**: Deep diagnostic feedback (`gemini-1.5-flash` / `GEMINI_API_KEY`).
  - **Heuristic Provider (`heuristic.ts`)**: Deterministic, offline/local fallback generating authentic Professor Mode explanations, ASCII diagrams, and lab hints with 0 external API dependencies.

### 3. Three-Tier Progressive Hint Disclosure (`hints.ts`)
- Leverages the `hints` ladder declared in `lab.yaml`:
  - **Tier 1 (Nudge):** Concept reminder and tool syntax.
  - **Tier 2 (Direction):** Specific file path, log channel, or registry hive to inspect.
  - **Tier 3 (Walkthrough):** Step-by-step investigation methodology.
- Direct `[Request Hint]` integration in `ObjectivesPanel.tsx` advances hint tiers and tracks `hintsUsed` on `LabAttempt`.

### 4. Anti-Cheat & Security Policy Guardrails (`guardrails.ts`)
- Never reveals raw flags (automatically masks strings matching `FLAG{...}` or `flag{...}`).
- Never yields exact objective answer strings verbatim.
- **Challenge Lockout:** In timed rank challenges (`/challenge/[rank]`), Handler communication is severed (`[COMM LINK SEVERED]`), forcing operators to rely on their own methodology.

### 5. Tactical Cyberpunk UI Drawer (`components/handler/HandlerDrawer.tsx`)
- Slide-out drawer with blade styling, scanline accents, and focus management (ESC to close).
- Suggestion chips for one-click prompts (`What is this?`, `Why?`, `Simplify`, `ASCII Diagram`, `Test me`, `Hint`).
- Integrated across:
  - Lessons (`app/(app)/learn/[lessonId]/page.tsx`)
  - Labs (`app/(app)/labs/[labId]/page.tsx`)
  - Challenges (`app/(app)/challenge/[rank]/page.tsx`)

### 6. Automated Verification Gates
- **Typecheck:** 0 TypeScript errors.
- **Lint:** 0 ESLint errors or warnings.
- **Content Check:** 26 lessons, 15 labs, 26 objectives verified and valid.
- **Vitest Suite:** **112 test files passed, 734 tests passed (100%)**.
- **Production Build:** Next.js Turbopack compiled successfully with 0 errors.
- **Playwright E2E:** 4/4 end-to-end tests passing on Chromium desktop and mobile viewports (`tests/e2e/handler.spec.ts`).

---

## 5. Phase 2E: Exam Readiness Engine & Gamification (Complete)

Phase 2E delivered the **Exam Readiness Engine**, **Habit Loops & Daily Streak Engine**, and the **Tactical Honors & Badges Wall** on the operator dashboard.

### 1. Certification Target Matrix & Readiness Engine (`lib/readiness/`)
- Ingests `content/coverage/core.yaml` certification objectives mapping.
- Calculates mastery across 6 major certifications:
  - CompTIA Security+ (`secplus` / SY0-701)
  - CompTIA Network+ (`netplus` / N10-009)
  - CompTIA Linux+ (`linuxplus` / XK0-006)
  - CompTIA A+ Core 1 (`aplus1201` / 220-1201)
  - CompTIA A+ Core 2 (`aplus1202` / 220-1202)
  - ISC2 Certified in Cybersecurity (`isc2cc` / CC)
- Categorizes operators into pedagogical grading bands (`docs/curriculum/teaching-style.md`):
  - 0–49%: `Weak`
  - 50–69%: `Needs review`
  - 70–84%: `Good`
  - 85–94%: `Strong`
  - 95–100%: `Exam Ready`
- Provides granular drill-down matrices showing covered lessons vs unaddressed certification exam codes.

### 2. Operational Streak & Telemetry Engine (`lib/gamification/streaks.ts`)
- Ingests timestamp telemetry from XP events, completed lesson milestones, and challenge attempts.
- Computes consecutive operational streaks, all-time record streaks, and same-day active status.
- Renders a 7-day rolling activity matrix displaying active/inactive nodes with high-contrast tactical styling.

### 3. Tactical Honors & Badges Wall (`lib/gamification/badges.ts`, `components/dashboard/BadgesWall.tsx`)
- Dynamic rule evaluator computing unlock criteria for 13 honors:
  - `INITIATE`: Enrolled at Rank 0.
  - `OPERATOR`: Elevated to Rank 1.
  - `WATCHER`: Elevated to Rank 2.
  - `HUNTER`: Elevated to Rank 3.
  - `PACKET_SURGEON`: Completed network packet capture triage labs.
  - `ROOT_HUNTER`: Audited Linux permissions and SUID backdoors.
  - `POWERSHELL_WARDEN`: Triaged Windows registry run keys and security event logs.
  - `IRON_GATE_SURVIVOR`: Completed Operation Iron Gate (Rank 1 Capstone).
  - `WEB_SENTINEL`: Completed all Rank 2 web security laboratories.
  - `WATCHTOWER`: Conquered Operation Watchtower (Rank 2 Capstone).
  - `FIRST_BLOOD`: Solved first practical lab or lesson check.
  - `CLEAN_RUN`: Completed a lab without requesting hint disclosures.
  - `TACTICAL_STREAK`: Maintained a 3-day continuous streak.
  - `DISCIPLINE_MASTER`: Maintained a 7-day continuous streak.
- Renders unlocked badges with gold/cyan classification stamps and encrypted/classified locked state for future objectives.

### 4. Verification & Testing
- **Vitest Suite:** 116 test files passed, 749 tests passed (100%).
- **Playwright E2E:** 2/2 tests passed (`tests/e2e/exam-readiness-gamification.spec.ts` across desktop and mobile viewports) validating complete lifecycle (onboarding -> initial standby -> lesson check -> streak activation -> badge unlock).
- **Production Build:** Clean Next.js Turbopack build with 0 errors.

---

## 6. Phase 2F: Rank 2 · Watcher: Web Security Core (Complete)

Phase 2F delivered the complete **Web Security Core** curriculum for Rank 2 (Watcher), the interactive in-browser `webapp` lab engine, 3 OWASP hands-on security labs, and the Rank 2 Capstone Challenge promoting operators to **Rank 3 (Hunter)**.

### 1. In-Browser `webapp` Lab Engine & Dual Workspace (`lib/lab-engine/webapp/`, `components/labs/webapp/`)
- **Browser Frame (`BrowserFrame.tsx`)**:
  - Sandboxed iframe browser viewport running inside a tactical terminal chrome.
  - Live address input, reload control, and postMessage event interception forwarding link clicks and form submissions back to the security simulation harness.
- **HTTP Inspector & Cookie Jar (`HttpInspector.tsx`)**:
  - Live traffic inspector recording HTTP request methods, paths, status codes, response headers, and response payloads.
  - Tabbed Cookie Jar interface allowing operators to observe session cookies and manually tamper with/inject custom session cookies (e.g. `watchtower_role=superadmin`).
- **Deterministic HTTP Simulator (`simulator.ts`)**:
  - In-memory HTTP dispatcher simulating multi-hop redirects, query string parsing, form body parsing, cookie extraction, and dynamic route rendering for all lab web applications.
- **Synchronous WebApp Lab Runner (`WebAppLab.tsx`)**:
  - Synchronous request sequence executor avoiding cascading render loops and managing redirect follow hops up to 5 iterations.

### 2. OWASP Top 10 Hands-on Security Labs
- **`core-r2-sqli-lab-01` ("Apex Vault Core: SQLi Attack & Extraction")**:
  - SQL injection authentication bypass (`' OR '1'='1`) against legacy authentication portal.
  - UNION query injection (`' UNION SELECT 1,2,3,4--`) extracting confidential flags from internal assets database.
- **`core-r2-xss-lab-01` ("DarkNet Intelligence: XSS Cookie Hijacking")**:
  - Reflected XSS input analysis and stored script injection in persistent message boards.
  - Automated session cookie extraction and privilege elevation.
- **`core-r2-idor-lab-01` ("Horizon Financial: BOLA / IDOR Account Takeover")**:
  - Horizontal and vertical authorization parameter tampering on REST API endpoints (`/api/accounts?id=...`).
  - Property tests verified across 1,000 randomized seeds (`tests/labs/web-labs.test.ts`).

### 3. Rank 2 Curriculum (`content/core/rank-2/`, Orders 21–32)
- Authored 12 exhaustive lessons and companion `.checks.yaml` with strict adherence to the 7-part briefing format:
  - **Order 21 (`21-http-protocol`)**: HTTP Protocol, Methods, and Header Triage (`core-r2-http-01`).
  - **Order 22 (`22-cookies-sessions`)**: Cookies, State, and Session Security (`core-r2-cookies-01`).
  - **Order 23 (`23-sop-cors`)**: Same-Origin Policy (SOP) & CORS Security (`core-r2-cors-01`).
  - **Order 24 (`24-sqli`)**: SQL Injection: Mechanisms, Exploitation & Defense (`core-r2-sqli-01`).
  - **Order 25 (`25-xss`)**: Cross-Site Scripting (XSS): Stored, Reflected, and DOM (`core-r2-xss-01`).
  - **Order 26 (`26-idor-bola`)**: Broken Object Level Authorization (BOLA / IDOR) (`core-r2-idor-01`).
  - **Order 27 (`27-csrf`)**: Cross-Site Request Forgery (CSRF) & Defense (`core-r2-csrf-01`).
  - **Order 28 (`28-ssrf`)**: Server-Side Request Forgery (SSRF) & Cloud Metadata (`core-r2-ssrf-01`).
  - **Order 29 (`29-cmd-injection`)**: Command Injection & Input Sanitization (`core-r2-cmdinj-01`).
  - **Order 30 (`30-cryptography-pki`)**: Applied Cryptography, TLS/SSL, and PKI (`core-r2-crypto-01`).
  - **Order 31 (`31-security-architecture`)**: Web Application Security Architecture & WAFs (`core-r2-waf-01`).
  - **Order 32 (`32-security-tooling`)**: Web Security Tooling & Vulnerability Scanning (`core-r2-tooling-01`).
- Total curriculum volume: **38 lessons, 19 labs, 27 objectives** across the platform.

### 4. Rank 2 Capstone Challenge: Operation Watchtower (`labs/core-r2-challenge-01`)
- **"Operation Watchtower"**: A 35-minute timed full-spectrum web exploitation and incident response operation.
- 3 chained operational vectors:
  - IDOR exploitation on defense contracts API (`/api/contracts?ref=CTR-7701`).
  - SQL injection on order verification portal (`/orders/lookup?code=ORD-01' OR '1'='1`).
  - Session cookie tampering on `/admin/debug` to escalate privileges to `watchtower_role=superadmin`.
- Promotes operator from **Rank 2 (Watcher)** to **Rank 3 (Hunter)** upon successful completion (+400 XP, rank up celebration hero).

### 5. Automated Verification Gates
- **Content Check:** 38 lessons, 19 labs, 27 objectives valid.
- **Typecheck:** 0 TypeScript errors.
- **Lint:** 0 ESLint errors or warnings.
- **Vitest Suite:** **118 test files passed, 758 tests passed (100%)**.
- **Playwright E2E:** 2/2 tests passed (`tests/e2e/rank-2-web.spec.ts`) validating lesson reading, check answering, web lab navigation, SQL injection exploitation, and capstone challenge clearance into Rank 3.
- **Production Build:** Clean Next.js Turbopack build with 0 errors.

---

## 7. Phase 2G: Hosted Closed Beta Foundation (Completed ✅)

### 1. Architectural Overview & Hybrid Zero-Config Model
Phase 2G establishes the cloud foundation for the CYBERBLADE hosted closed beta while maintaining 100% backward compatibility with zero-config local development:
- **Local-First Fallback:** When Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are omitted, CYBERBLADE operates completely offline with file-backed JSON storage (`.data/`).
- **Hosted Cloud Mode:** When environment variables are configured, storage repositories dynamically switch to Postgres with Row Level Security (RLS) and Supabase Auth.
- **Single Swap Points:** `getOperatorStore()` and `getCtx()` dynamically instantiate `SupabaseOperatorStore` and `SupabaseProgressRepo` respectively without modifying any downstream API contracts.

### 2. Database Schema & Row Level Security (`supabase/migrations/20261010000000_phase_2g_initial_schema.sql`)
5 normalized relational tables with UUID foreign keys and RLS:
1. `operators`: `id` (UUID PK = `auth.uid()`), `handle` (CITEXT UNIQUE), `rank` (INT2), `ethics_accepted_at`, `created_at`.
2. `lesson_progress`: `(user_id, lesson_id)` composite PK, `status`, `checks_passed` (TEXT[]), `completed_at`.
3. `lab_attempts`: `id` UUID PK, `user_id`, `lab_id`, `mode`, `seed`, `status`, `started_at`, `completed_at`, `expires_at`, `answers` (JSONB).
4. `xp_events`: `id` UUID PK, `user_id`, `source` (TEXT UNIQUE per user), `amount` (INT), `awarded_at`.
5. `rank_challenges`: `(user_id, rank)` composite PK, `status`, `attempt_id`, `passed_at`, `cooldown_until`.

RLS Policies:
- Every table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- Strict user isolation policies (`USING (auth.uid() = user_id)` / `WITH CHECK (auth.uid() = user_id)`).
- Public profile lookup on `operators` allows reading ranks and handles while restricting mutations to owner.

### 3. Authentication & SSO (`app/auth/callback/route.ts`, `components/auth/HostedAuthSection.tsx`)
- **Email Magic Link & Google OAuth SSO:** Handled via `@supabase/ssr` server actions and PKCE authorization code exchange in `/auth/callback`.
- **Automatic Operator Provisioning:** First-time OAuth/Magic Link sign-ins seamlessly check and provision an operator record if one does not yet exist.
- **UI Integration:** The `/start` onboarding form automatically reveals Google SSO and Email Magic Link triggers when hosted mode is active, while continuing to offer instant handle-based anonymous onboarding in local-first mode.

### 4. Edge Security & Next.js 16 Proxy (`proxy.ts`)
- **Next.js 16 Edge Proxy:** Utilizes modern `proxy.ts` (Next.js 16 convention replacing legacy `middleware.ts`).
- **Session Refresh:** Refreshes Supabase session tokens on incoming edge requests using `@supabase/ssr`.
- **Enterprise Security Headers:**
  - `Content-Security-Policy`: Defense-in-depth policy allowing inline styles for animations and data/blob frames for isolated sandboxed webapp labs (`frame-src 'self' data: blob:`).
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (in production).

### 5. Automated Verification Gates
- **Content Check:** 38 lessons, 19 labs, 27 objectives valid.
- **Lint:** 0 ESLint errors or warnings.
- **Typecheck:** 0 TypeScript errors.
- **Vitest Suite:** **121 test files passed, 770 tests passed (100%)**.
- **Playwright E2E Suite:** **101 tests passed, 21 skipped (matrix-appropriate), 0 failed** across all desktop and mobile flows.
- **Production Build:** Clean Turbopack production build with all static/dynamic routes compiled.

---

## 8. Phase 2 Completion Summary: Core Complete + Handler

With Phase 2G complete, the entirety of **Phase 2 (Core Complete + Handler)** is finished!
- **Phase 2A:** Rank 1 Networking (9 lessons, network packet inspector lab, reachability simulator).
- **Phase 2B:** Rank 1 Linux System Internals (7 lessons, Linux vfs/procfs terminal, SUID/privilege escalation labs).
- **Phase 2C:** Rank 1 Capstone Challenge "Operation Iron Gate" (30-min incident triage timed mission, promotion to Rank 2).
- **Phase 2D:** Rank 1 Windows Foundations (4 lessons, PowerShell terminal simulator, Windows Registry and Event Log labs).
- **Phase 2E:** Exam Readiness Matrix & Gamification Engine (CompTIA/CySA+/MITRE coverage engine, streak tracker, badging wall).
- **Phase 2F:** Rank 2 Web Security Fundamentals (12 lessons, OWASP Top 10 sandboxed iframe lab, Capstone Challenge "Operation Watchtower", promotion to Rank 3 Hunter).
- **Phase 2G:** Hosted Closed Beta Foundation (Supabase Postgres schema, RLS, Auth SSO, Edge proxy security headers, hybrid local/hosted fallback).

---

## 9. Next Major Phase: Phase 3 (SOC Analyst Job Track)

### Objectives for Phase 3
1. **SIEM Event Stream & Log Investigation Console:**
   - Real-time Splunk/Elasticsearch-style log query interface with syntax highlighting, time bucketing, and search operators.
2. **SOC Workflows & Incident Triage Labs:**
   - Phishing investigation, malware alert correlation, brute-force analysis, and memory triage scenarios.
3. **AI-Graded Incident Reports:**
   - Learners write structured Incident Responder IR reports; The Handler grades against rubric criteria and evidence justification.
4. **SOC Track Capstone & Certification Exam:**
   - Comprehensive multi-hour simulated security operations center incident shift culminating in a verified CYBERBLADE SOC Tier-1 Analyst certificate.

