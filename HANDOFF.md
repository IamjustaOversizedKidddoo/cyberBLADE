# Weekend Engineering Milestone Handoff (W6 Self-Check)

**Branch:** `build/weekend`  
**Base:** `main` (merge base `b62548317e99dc2b72c2f7a6eca77e528bebd1c4`)  
**Deployment Policy:** DO NOT merge to `main`. DO NOT deploy to production without explicit human authorization.  
**Commit Status:** Hermetic, tested, gated behind flags defaulting to OFF.

---

## 1. What Was Built (Deliverables Summary)

### W1 — Certificates & Verification Registry
- **Cryptographic Credential System:** Issued upon server-authoritative completion of tracks (SOC Analyst, Pentest L1, Core challenges).
- **Public Verification Registry (`/verify/[credentialId]`):** Publicly shareable, mobile-responsive verification page showing learner display name, credential ID, track, level, issue timestamp, verification status, and cryptographic signature hash.
- **Revocation Pipeline:** Server-authoritative revocation with immutable audit reason, displayed with high-visibility revocation alert badges on the verify page.
- **Anti-Enumeration & Forgery:** Credential IDs format `cb-crt-[16 hex chars]` using cryptographically secure random bytes (`crypto.randomBytes(8)`). Zero internal IDs leaked. Rate-limited at 60 req/min per IP.
- **Display Name Sanitization:** Strict validation (2–60 chars, trimmed, disallows control characters and `<>` script tags).
- **Flag Gating:** Entire system server-gated behind `CERTIFICATES_ENABLED` (default `false`).

### PT-0 through PT-5 — Pentest L1 Curriculum Track
- **Curriculum Architecture:** 12 structured modules (`m01` through `m12`) aligned directly to eJPT (Junior Penetration Tester) domains:
  - M01: Methodology & Rules of Engagement
  - M02: Passive Reconnaissance & OSINT
  - M03: Active Host & Port Scanning
  - M04: Network Service Enumeration
  - M05: Vulnerability Identification
  - M06: Web Application Attacks (OWASP Top 10)
  - M07: Exploitation & Metasploit
  - M08: Password Attacks & Cracking
  - M09: Privilege Escalation
  - M10: Pivoting & Network Routing
  - M11: Technical & Executive Reporting
  - M12: Capstone Engagement Simulation
- **Authored Content:** 46 in-depth MDX lessons, each containing:
  - Real engagement rationale (`## Why this matters on engagement`)
  - Strict lab-only scoping notices and prerequisites (`## Before you start`)
  - Deep technical mechanics (`## Core ideas`)
  - Worked step-by-step examples (`## Worked example`)
  - Hands-on exercises (`## Try it`)
  - Real-world triage insights (`## In the real world`)
  - Companion interactive quizzes (`## Check your understanding`)
  - Spaced repetition flashcards (`*.cards.yaml`) and module cheat sheets.
- **Strict RFC Documentation Scoping:** Enforces RFC 5737 reserved documentation IP blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and RFC 2606 reserved domains (`.example`, `.test`). No real-world targets.

### PT-6 — Pentest Practice Labs
- **16 Hands-On Labs:** Spread across packet analysis, terminal, and web application simulators:
  - Terminal service enumeration (SMB, SSH, FTP, SNMP, vulnerability triage)
  - Packet analysis for port scan signatures, cleartext credentials, and SSH/SOCKS pivots
  - Web exploitation (SQLi authentication bypass, UNION-based extraction, blind boolean SQLi, reflected/stored XSS, LFI directory traversal, unrestricted file upload, command injection, IDOR)
  - Password cracking (MD5, SHA-256, NTLM via John and Hashcat) and Hydra network spraying
  - Linux privilege escalation (SUID GTFOBins, sudo misconfigurations, cron job hijacking) and Windows service permission flaws.

### PT-7 & PT-8 — NetRange Multi-Host Engine & Scenarios
- **Deterministic Multi-Host Simulation Engine (`lib/lab-engine/netrange`):**
  - In-browser simulated network range with DMZ, internal subnet (`172.16.50.0/24`), dual-homed pivot gateway (`apex-gw01`), internal databases, and domain controllers.
  - Interactive attack console with command parser supporting `nmap`, `searchsploit`, `msfconsole`, `smbclient`, `ssh`, `curl`, `ftp`, `gobuster`, `john`, `route`, `host-shell`, and background tunnel routing.
- **5 Complete NetRange Scenarios:**
  - `netrange-foothold-privesc-01`: vsftpd backdoor foothold -> sudo GTFOBins root privesc.
  - `netrange-web-cred-reuse-01`: SQLi DB dump -> credential reuse SSH foothold.
  - `netrange-pivot-internal-01`: Gateway compromise -> internal subnet route -> internal DB exfiltration.
  - `netrange-windows-smb-privesc-01`: SMB share traversal -> unquoted service path exploitation.
  - `netrange-mini-exam-01`: 3-host integrated assessment challenge.

### PT-9 & PT-10 — Pentest Exam Engine & Knowledge Bank
- **Knowledge Bank:** 124 unique, vetted scenario and theory questions across all 12 modules in `content/pentest/exams/knowledge-bank.yaml`.
- **Integrated Practical Exam System (`lib/lab-engine/pentest/exam`):**
  - 3-hour practical performance exam format with 35 finding questions and live NetRange multi-host target network.
  - Server-authoritative timer: client clock manipulation or page reloads cannot extend time.
  - Anti-cheat controls: randomized per-attempt seed, zero answers or ground truth leaked to the client browser before submission, attempt cooldowns.

### PT-11 — Senior Penetration Tester Curriculum Review
- **Content Linter & Technical Verifier:** Automated audits verifying command syntax, tool flags, hashcat modes, Metasploit payload conventions, and RFC compliance across all 46 lessons and 124 questions (`scripts/audit-pentest-content.mts`, `scripts/audit-technical-accuracy.mts`).
- **Comprehensive Claims Catalog:** Maintained in `docs/ops/pentest-curriculum-claims.md`.

### PT-12 — Three Timed eJPT Mock Exams & Readiness Gate
- **Three Timed eJPT Mock Assessments:**
  - Mock 1: Reconnaissance & Network Auditing (120m, 35 items)
  - Mock 2: Web Applications & Vulnerability Exploitation (120m, 35 items)
  - Mock 3: System Security & Network Pivoting (120m, 35 items)
  - Untimed Practice Mock option for exploratory learning.
- **4-Point Server-Authoritative Readiness Gate:**
  1. Complete all 12 Pentest Track Modules (100%)
  2. Complete required hands-on NetRange scenario labs
  3. Score ≥70% on at least one eJPT-style mock assessment
  4. Achieve ≥70% across all 4 core eJPT assessment domains.
- **Weak-Area Diagnostic Report:** Evaluates learner performance per module (0–100%) and generates direct remediation links to specific lessons and labs.
- **Personalized Domain Study Plan:** Actionable review roadmaps categorized into Assessment Methodologies, Host & Network Auditing, Host & Network Penetration Testing, and Web Application Penetration Testing.

### PT-13 — Handler Pentest Mode & Lab Polish
- **Socratic 3-Tier Escalating Hints:** Server tracks hint tier per (learner, lab/attempt). Progresses from gentle conceptual pointers (Tier 1) to command flags (Tier 2) to targeted syntax patterns (Tier 3). Final flags and full exploit chains are strictly withheld until lab is completed.
- **Engagement Scope Guard:** Intercepts attempts to target external IPs, non-RFC ranges, public domains, or out-of-scope hosts, redirecting learners back to designated lab targets.
- **Prompt-Injection Hardening:** Strips untrusted delimiter tags, isolates lab telemetry, and refuses jailbreaks attempting to bypass exam rules or leak answer keys.
- **Lab Ergonomic Polish Across All 28 Labs:**
  - 1-click clean state reset (`resetLabAction`) clearing transient state and restarting virtual containers.
  - Persistent Engagement Scope Banner (`[data-testid="lab-scope-banner"]`) establishing legal boundaries.
  - Post-solve debriefs with `defenderView` explaining detections, SIEM telemetry, and blue-team mitigations.

---

## 2. Feature Flags Matrix & Defaults

All new features built on this branch are guarded by feature flags that **default to OFF (`false`)**. When flags are off, the existing production application behavior is completely untouched.

| Flag Name | Default | Target System | Flag-Off Behavior |
| :--- | :---: | :--- | :--- |
| `CERTIFICATES_ENABLED` | `false` | Certificates & Public Verification | `/certificates` and `/verify/[credentialId]` return `notFound()` (404). `[CREDENTIALS]` link is removed from AppShell navigation. `claimCertificateAction` throws error. |
| `PENTEST_ENABLED` | `false` | Pentest L1 Curriculum Track | `/learn/pentest-l1` and submodules return `notFound()` (404). CourseMap hides Pentest track. Pentest labs return 404 or redirect. Handler bypasses Pentest mode. |
| `PENTEST_EXAMS_ENABLED` | `false` | Pentest Practical Exams & Mocks | `/exam/pentest`, `/exam/pentest/[examId]`, and `/exam/pentest/readiness` return `notFound()` (404). All exam server actions throw error. |
| `Handler Pentest Mode` | `false` | AI Tutor Pentest Mode | Gated behind `isPentestEnabled()`. When flag is off, requests bypass `askPentestHandler` and use standard SOC/Core assistant. |

---

## 3. Routes Added

### User Interface Routes (Pages)
- `/certificates` — Learner certificate portfolio (view earned credentials, claim eligible certificates). *(Gated: `CERTIFICATES_ENABLED`)*
- `/verify/[credentialId]` — Public verifiable credential registry page. *(Gated: `CERTIFICATES_ENABLED`)*
- `/learn/pentest-l1` — Pentest L1 curriculum track overview and phase progression. *(Gated: `PENTEST_ENABLED`)*
- `/learn/pentest-l1/[module]` — Pentest module detail and lesson list. *(Gated: `PENTEST_ENABLED`)*
- `/exam/pentest` — Pentest practical exams and timed mock lobby. *(Gated: `PENTEST_EXAMS_ENABLED`)*
- `/exam/pentest/[examId]` — Interactive exam runner with attack console and question navigator. *(Gated: `PENTEST_EXAMS_ENABLED`)*
- `/exam/pentest/[examId]/result` — Comprehensive post-exam outcome dossier and question review. *(Gated: `PENTEST_EXAMS_ENABLED`)*
- `/exam/pentest/readiness` — 4-Point readiness evaluation gate, 12-module matrix, and study plan. *(Gated: `PENTEST_EXAMS_ENABLED`)*
- `/labs/pentest/exams` — Redirect alias to `/exam/pentest`. *(Gated: `PENTEST_EXAMS_ENABLED`)*

### Server Actions
- `claimCertificateAction` (`app/(app)/certificates/actions.ts`) — Server-authoritative certificate issuance.
- `startPentestExamAction` (`app/(app)/exam/pentest/actions.ts`) — Starts a timed mock or practical exam attempt.
- `getPentestExamStateAction` (`app/(app)/exam/pentest/actions.ts`) — Retrieves state without ground-truth answers.
- `savePentestExamAnswerAction` (`app/(app)/exam/pentest/actions.ts`) — Records learner answer for question.
- `submitPentestExamAction` (`app/(app)/exam/pentest/actions.ts`) — Submits exam, grades answers, updates readiness.
- `dispatchPentestExamCommandAction` (`app/(app)/exam/pentest/actions.ts`) — Executes terminal command in simulated NetRange.
- `askPentestHandlerAction` (`app/(app)/handler/actions.ts`) — Socratic guidance with scope and injection guards.
- `resetLabAction` (`app/(app)/labs/[labId]/actions.ts`) — 1-click clean state reset.

---

## 4. Database & Migration Changes

Two new idempotent migration files were authored in `supabase/migrations/`:

### 1. `20261017100000_certificates_and_verification.sql`
- **Table `learner_certificates`:**
  - `id` (UUID PK), `credential_id` (TEXT UNIQUE NOT NULL, indexed), `user_id` (TEXT NOT NULL, indexed), `track_id` (TEXT NOT NULL), `level` (INTEGER NOT NULL), `name_as_chosen` (TEXT NOT NULL), `issued_at` (TIMESTAMPTZ NOT NULL), `revoked_at` (TIMESTAMPTZ), `revocation_reason` (TEXT), `signature_hash` (TEXT NOT NULL), `metadata` (JSONB).
  - Row Level Security (RLS) enabled: Learners can read own certificates; public can select non-revoked certificates by `credential_id`; service role can insert/update.
  - Unique index on `(user_id, track_id, level)` enforcing idempotency.

### 2. `20261017120000_pentest_l1_exams.sql`
- **Table `pentest_exam_attempts`:**
  - `id` (UUID PK), `user_id` (TEXT NOT NULL, indexed), `format` (TEXT NOT NULL), `seed` (TEXT NOT NULL), `started_at` (TIMESTAMPTZ NOT NULL), `expires_at` (TIMESTAMPTZ NOT NULL), `submitted_at` (TIMESTAMPTZ), `score` (INTEGER), `passed` (BOOLEAN), `domain_scores` (JSONB), `answers` (JSONB), `grading_details` (JSONB).
  - RLS enabled: Learners can read and update own attempts; service role full access.
- **Repository Abstraction:**
  - `JsonStore` local development fallback implemented for hermetic testing in `.data/` and `.data-e2e/`.

---

## 5. Environment Variables

Added to `.env.example`, `lib/config/env.ts`, and `lib/config/runtime-config.ts`:

```bash
# --- Certificates & Public Verification Registry (default false, server-gated) ---
CERTIFICATES_ENABLED=false

# --- Penetration Testing Track Flags (default false, server-gated) -----------------
PENTEST_ENABLED=false
PENTEST_EXAMS_ENABLED=false
```

No new external API keys or secrets are required. The entire Pentest track, NetRange engine, exam grading, and Socratic Handler heuristics run completely hermetically offline without third-party dependencies.

---

## 6. Verification & Quality Gates Status

| Gate | Command | Expected / Result | Status |
| :--- | :--- | :--- | :---: |
| **TypeScript Typecheck** | `npx tsc --noEmit` | 0 errors | **PASSED** |
| **ESLint** | `npm run lint` | 0 errors, 69 warnings | **PASSED** |
| **Unit & Integration Tests** | `npm test` | **2,422 passing / 2,422 total (255 files)** | **PASSED** |
| **Playwright E2E Tests** | `npx playwright test` | **19 passing across desktop & mobile projects** | **PASSED** |
| **Production Build** | `npm run build` | Next.js Turbopack optimized bundle (33 static pages) | **PASSED** |
| **Content Structure Linter** | `npx tsx scripts/audit-pentest-content.mts` | 46/46 lessons passed, 124 KB items passed | **PASSED** |
| **Technical Accuracy Audit**| `npx tsx scripts/audit-technical-accuracy.mts` | 0 technical inconsistencies | **PASSED** |

---

## 7. Known Gaps & Residual Limitations

1. **Simulated NetRange vs Real Linux Containers:** NetRange is a high-fidelity deterministic browser simulation, not full QEMU/Docker virtualization. Highly exotic Bash pipelines (`awk` formatting into background subshells) or binary exploitation outside the simulated tools (`ropgadget`, custom shellcode compilation) are not supported in L1.
2. **eJPT Exam 3-Hour Time Limit on Slow Devices:** In resource-constrained environments (e.g. low-memory mobile browsers), running an interactive terminal session for several hours could encounter garbage-collection pauses. The timer is resilient to reloads, but low-end client memory usage should be monitored.
3. **Automated Certificate Revocation Tooling:** Certificates can currently be revoked via server action and tested via script (`scripts/revoke-certificate.mts`). An administrative UI dashboard for security ops to revoke certificates without touching the CLI remains a future enhancement.

---

## 8. Things We Are Unsure About / What to Audit First

1. **Rate Limit Tunings on `/verify/[credentialId]` in Production:** Currently tuned to 60 requests per minute per IP. If shared corporate NATs or recruitment agencies verify batches of certificates simultaneously, this could be triggered. Audit rate-limiting metrics under corporate proxy traffic.
2. **Display Name Length vs Mobile Card Wordwrap:** Recipient display names up to 60 characters are permitted. Tested on 375px screens with multi-line wrap, but names consisting of 60 consecutive non-breaking characters could cause text truncation on the SVG certificate card.
3. **NetRange Session Storage in Local Development:** In `.data-e2e/`, attempts are stored as JSON files. Under concurrent multi-tab exam attempts by the same learner, lock acquisition in `json-store.ts` handles concurrency, but PostgreSQL/Supabase should be benchmarked under high-volume load testing.
4. **Offline Heuristics vs Live Gemini for Pentest Handler:** The offline regex-based heuristics handle standard questions, prompt injection, and scope boundaries cleanly. When `GEMINI_API_KEY` is present in production, the prompt context should be audited against actual learner queries to ensure the model maintains the 3-tier Socratic restraint without giving away flags.

---

## 9. Categorized List of Files Changed

### Core Configuration & Infrastructure
- `.env.example`
- `lib/config/env.ts`
- `lib/config/runtime-config.ts`
- `playwright.config.ts`
- `vitest.config.mts`

### Certificates & Verification System
- `app/(app)/certificates/page.tsx`
- `app/(app)/certificates/actions.ts`
- `app/verify/[credentialId]/page.tsx`
- `components/certificates/CertificateCard.tsx`
- `components/certificates/CertificateView.tsx`
- `components/certificates/ClaimCertificateModal.tsx`
- `lib/certificates/eligibility.ts`
- `lib/certificates/service.ts`
- `lib/certificates/slug.ts`
- `lib/certificates/types.ts`
- `scripts/revoke-certificate.mts`
- `supabase/migrations/20261017100000_certificates_and_verification.sql`
- `tests/unit/lib/certificates/certificates.test.ts`
- `tests/db/certificates.test.ts`
- `tests/e2e/certificates.spec.ts`

### Pentest Curriculum & Lessons
- `content/tracks/pentest/l1/track.yaml`
- `content/tracks/pentest/l1/m01-methodology/*` (4 lessons)
- `content/tracks/pentest/l1/m02-osint/*` (4 lessons)
- `content/tracks/pentest/l1/m03-scanning/*` (4 lessons)
- `content/tracks/pentest/l1/m04-services/*` (4 lessons)
- `content/tracks/pentest/l1/m05-vuln-analysis/*` (2 lessons)
- `content/tracks/pentest/l1/m06-web-attacks/*` (5 lessons)
- `content/tracks/pentest/l1/m07-exploitation/*` (4 lessons)
- `content/tracks/pentest/l1/m08-passwords/*` (4 lessons)
- `content/tracks/pentest/l1/m09-privesc/*` (4 lessons)
- `content/tracks/pentest/l1/m10-pivoting/*` (4 lessons)
- `content/tracks/pentest/l1/m11-reporting/*` (4 lessons)
- `content/tracks/pentest/l1/m12-capstone/*` (3 lessons)
- `lib/content/pentest-track.ts`
- `lib/content/pentest-lesson-lint.ts`
- `scripts/audit-pentest-content.mts`
- `scripts/audit-technical-accuracy.mts`

### NetRange Simulated Multi-Host Engine & Labs
- `lib/lab-engine/netrange/*` (engine, schema, types, lint, commands)
- `lib/generators/netrange/*` (5 scenarios: foothold, cred-reuse, pivot, smb-privesc, mini-exam)
- `labs/netrange-*` (5 lab definitions)
- `labs/pentest-*` (23 hands-on lab definitions)
- `lib/generators/terminal/*`, `lib/generators/webapp/*`, `lib/generators/packet/*` (pentest lab generators)
- `tests/unit/lib/lab-engine/netrange/*`
- `tests/e2e/netrange-lab.spec.ts`
- `tests/e2e/pentest-track.spec.ts`

### Exam Engine, Mock Assessments & Readiness Gate
- `content/pentest/exams/config.yaml`
- `content/pentest/exams/knowledge-bank.yaml`
- `content/pentest/exams/readiness.yaml`
- `app/(app)/exam/pentest/page.tsx`
- `app/(app)/exam/pentest/actions.ts`
- `app/(app)/exam/pentest/[examId]/page.tsx`
- `app/(app)/exam/pentest/readiness/page.tsx`
- `components/labs/pentest/exams/*` (PentestExamRunner, PentestExamResultView, PentestStartExamButton, etc.)
- `lib/lab-engine/pentest/exam/*` (service, readiness, study-plan, results, knowledge, scenario-questions)
- `supabase/migrations/20261017120000_pentest_l1_exams.sql`
- `tests/unit/lib/lab-engine/pentest/exam/*`
- `tests/db/pentest-exams.test.ts`
- `tests/e2e/pentest-exam.spec.ts`

### Handler Pentest Mode & Lab Polish
- `lib/handler/pentest-mode.ts`
- `lib/handler/pentest-guard.ts`
- `lib/handler/types.ts`
- `app/(app)/handler/actions.ts`
- `lib/content/debriefs.ts`
- `components/labs/LabScopeBanner.tsx`
- `components/labs/LabPostSolveDebrief.tsx`
- `tests/unit/lib/handler/pentest-mode.test.ts`
- `tests/unit/lib/content/debriefs.test.ts`

### App Navigation & Shell
- `components/shell/AppShell.tsx`
- `components/shell/NavLinks.tsx`
- `tests/e2e/weekend-evidence.spec.ts`
