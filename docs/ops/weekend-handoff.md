# CyberBLADE Weekend Engineering Handoff & Auditor Briefing

**Branch:** `build/weekend`  
**Date:** 2026-10-17  
**Audience:** Independent Reviewer / Platform Auditor (Tuesday Review)  
**Status:** Verification Complete · All Gates Green · Zero Merge Conflicts with `main`

---

## 1. Executive Summary & Purpose

During the weekend development pass, five core capability increments (**W1–W5**) were engineered for CyberBLADE on branch `build/weekend`. The focus was delivering the end-to-end **Pentest Track (aligned with eJPT)** and **Cryptographic Certificate Verification Registry** without adding feature bloat or modifying SOC L1/L2 behaviors.

This document serves as the single source of truth for the independent auditor reviewing this branch.

---

## 2. Summary of Increments Built (W1–W5)

### W1: Cryptographic Certificates & Verification Registry
- **Eligibility Engine** (`lib/certificates/eligibility.ts`): Evaluates track completion criteria across Core Operator, Core Watcher, SOC L1 Tier 1 Analyst, and Penetration Testing eJPT Practical.
- **Verification Service & RPC** (`lib/certificates/service.ts`, `supabase/migrations/20261017100000_certificates_and_verification.sql`):
  - SHA-256 integrity fingerprinting derived from credential ID, issue date, and user ID.
  - Public verification RPC `verify_certificate(credential_id_input TEXT)` executing as `SECURITY DEFINER` with pinned `search_path = public, pg_temp` and PII sanitization.
  - Administrative revocation script (`scripts/revoke-certificate.mts`).
- **User Interface**: Accessible certificates registry (`/certificates`), public verification page (`/verify/[credentialId]`), native modal claim flow (`ClaimCertificateModal`), LinkedIn credential sharing, and vector PDF/SVG download controls.

### W2: Pentest L1 Curriculum Track & Content Linter
- **Curriculum Authoring** (`content/tracks/pentest/l1/`): 12 comprehensive modules and 38 lessons spanning methodology, network recon, host enumeration, web attacks, exploitation, password cracking, privilege escalation, pivoting, and reporting.
- **Content Linter** (`lib/content/pentest-lesson-lint.ts`, `tests/unit/lib/content/pentest-lesson-lint.test.ts`):
  - Strictly enforces reading word counts (<1,500 words per lesson), estimated reading times ($\le 20$ min), zero position bias, and longest-answer bias checks.
- **Claims Registry** (`docs/ops/pentest-curriculum-claims.md`): Audited curriculum claims against the question bank, marking unverified claims P34–P70 as `UNVERIFIED` to preserve platform truthfulness.

### W3: 7 Hands-on Labs & Socratic Pentest Handler
- **Offensive Laboratories** (`labs/`): 7 procedural, deterministic, server-graded labs:
  - *Terminal Engine*: SMB Enumeration (`pentest-m04-term-services-01`), MD5 Wordlist Cracking (`pentest-m08-term-hashcrack-01`), Sudo GTFOBins PrivEsc (`pentest-m09-term-privesc-01`).
  - *WebApp Engine*: SQLi & LFI (`pentest-m06-web-attacks-01`), Full-Scope Web Compromise (`pentest-m12-capstone-01`).
  - *Packet Engine*: Port Scan Signatures (`pentest-m03-pkt-scan-01`), SSH Pivot Tunnel Analysis (`pentest-m10-pkt-pivot-01`).
- **Socratic Handler Mode** (`lib/handler/pentest-mode.ts`, `lib/handler/pentest-guard.ts`):
  - Redirects learner requests for direct answers, flags, and exploit dumps with methodology hints in English and Hinglish.
  - Output leak protection redacts accidental flag revelations.
  - Tested with 64 automated adversarial prompts and over-refusal queries (`tests/unit/lib/handler/pentest-mode.test.ts`).

### W4: NetRange Simulated Multi-Host Offensive Network Engine
- **Network Engine** (`lib/lab-engine/netrange/`):
  - In-browser simulated multi-host network supporting CIDR subnets, multi-homed hosts, open services/banners, user accounts, password hashes, and routing tables with zero real network egress.
  - Simulated attacker tools: `nmap`, `searchsploit`, `msfconsole`, `curl`, `smbclient`, `ftp`, `ssh`, `john`, `route`, and host shell.
- **Authored Scenarios** (`lib/generators/netrange/`):
  - Scenario (a) `netrange-foothold-privesc-01`: FTP backdoor foothold & find sudo privesc.
  - Scenario (b) `netrange-web-cred-reuse-01`: Web config credential reuse & John hash cracking.
  - Scenario (c) `netrange-pivot-internal-01`: Dual-homed bastion pivot into internal subnet.
- **Mobile Ergonomics**: Tested at 390px viewport with double-bezel cards, $\ge 44$px touch targets, and command macro shortcuts.

### W5: Pentest L1 Practical Performance Exam System
- **Assessment Formats** (`content/pentest/exams/config.yaml`):
  - **Practical Performance Exam**: 3 hours (180m), 30 questions (18 finding questions + 12 theory questions), passing score $\ge 70\%$, 24h retake cooldown.
  - **Diagnostic Mock Assessment**: Untimed (720m relaxed), 15 questions (8 findings + 7 theory), 0m cooldown.
  - **Scoring**: 60% findings / 40% theory, passing threshold $\ge 70\%$.
- **Readiness Gate** (`/exam/pentest/readiness`):
  - 4-point criteria matrix (modules $\ge 12$, labs $\ge 3$, mock $\ge 70\%$, domain floor $\ge 70\%$).
  - Exact legal disclaimer: *"Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."*
  - Personalized per-domain study plan diagnosing weaknesses.
- **Interactive Workspace & Results Dossier** (`/exam/pentest/[examId]`):
  - Server-authoritative timer with audio-visual alerts and automatic expiration submission.
  - Split workspace: interactive simulated Kali attack console + question navigator with auto-save.
  - Post-submission dossier: 4-domain mastery breakdown bars, component weighting, question review with explanations, and 1-click certificate claim.

---

## 3. Architecture Decisions & Design Rationale

1. **Shared Abstractions without SOC L2 Drift:**
   - To avoid code duplication and forking, common assessment mechanisms were factored into `lib/lab-engine/common/exam/`:
     - `timer.ts`: Server remaining-time math and deadline calculation.
     - `disclaimer.ts`: Single source of truth for the legal estimate disclaimer.
   - **Zero regressions**: All 254 test files, including all SOC L1 and SOC L2 suites, remain 100% green.
2. **Zero Client Secrets & Server-Authoritative Grading:**
   - Scenario seeds, answer keys, flags, and ground truths are evaluated strictly on the server.
   - Client bundle scanner (`npm run scan:bundle`) asserts 0 leaks across 95 compiled artifacts.
3. **Immutable Submitted Attempts:**
   - Database RLS enforces that once an exam attempt status transitions to `submitted` or `expired`, no further answers can be inserted or updated.
4. **Deterministic Procedural Generation:**
   - Scenarios and questions are seeded by learner attempt ID, guaranteeing distinct IPs, banners, and answers per attempt while remaining completely repeatable for automated regression testing.

---

## 4. New Database Tables, Columns, Flags & Environment Variables

### Database Schema Additions
1. **Migration `20261017100000_certificates_and_verification.sql`**:
   - Table `learner_certificates`:
     - `credential_id` (TEXT PRIMARY KEY, formatted `cbl_<hex16>`)
     - `user_id` (UUID REFERENCES auth.users ON DELETE CASCADE)
     - `track_id` (TEXT), `level` (TEXT), `name_as_chosen` (TEXT)
     - `issued_at` (TIMESTAMPTZ), `revoked_at` (TIMESTAMPTZ), `revocation_reason` (TEXT)
     - RLS: Learners read their own certificates; public verification via `verify_certificate()` RPC only.
2. **Migration `20261017120000_pentest_l1_exams.sql`**:
   - Table `pentest_exam_attempts`:
     - `id` (UUID PRIMARY KEY), `user_id` (UUID REFERENCES auth.users ON DELETE CASCADE)
     - `format` (TEXT: practical/mock), `seed` (TEXT), `status` (TEXT: in_progress/submitted/expired)
     - `score_percent` (INTEGER), `passed` (BOOLEAN), `domain_scores` (JSONB)
     - `started_at`, `submitted_at`, `expires_at` (TIMESTAMPTZ)
   - Table `pentest_exam_answers`:
     - `id` (UUID PRIMARY KEY), `attempt_id` (UUID REFERENCES pentest_exam_attempts ON DELETE CASCADE)
     - `question_id` (TEXT), `user_answer` (JSONB), `answered_at` (TIMESTAMPTZ)
     - RLS: Owner-only access, locked against update when attempt status != `'in_progress'`.
   - Updated `delete_user_account()`: Added cascade deletion for `pentest_exam_attempts` and `pentest_exam_answers`.

### Feature Flags & Defaults
| Flag | Default | Description | Environment |
| :--- | :---: | :--- | :--- |
| `PENTEST_ENABLED` | `false` | Enables Pentest L1 curriculum track routes (`/learn/pentest-l1`) | Server only (`.env.example`) |
| `PENTEST_EXAMS_ENABLED` | `false` | Enables Pentest exam lobby, runner, and readiness routes (`/exam/pentest/*`) | Server only (`.env.example`) |

---

## 5. Known Gaps, Trade-offs & Risks

1. **Simulated Tooling Breadth:**
   - The NetRange simulated tooling accurately executes standard flags for `nmap`, `searchsploit`, `msfconsole`, `curl`, `smbclient`, `ftp`, `ssh`, `john`, `route`, and host shell. Arbitrary unsupported flags return standard Linux/tool syntax error notices rather than arbitrary terminal emulation.
2. **Question Bank Verification Coverage:**
   - 65 high-fidelity technical items have been authored with complete explanations. 37 earlier curriculum claims (P34–P70) remain logged as `UNVERIFIED` in `docs/ops/pentest-curriculum-claims.md` until further authored iterations expand the bank.
3. **Timer Client Suspension:**
   - If a learner closes their laptop lid or suspends their browser tab for 2 hours during an active 3-hour practical exam, the server-authoritative timer marks the attempt expired based on wall-clock timestamp upon reconnect, as intended by proctored assessment standards.

---

## 6. Things We Are Unsure About (Auditor Considerations)

1. **3-Hour Practical Duration Pacing:**
   - 3 hours is generous for 18 finding questions and 12 theory questions for experienced testers, but may feel tight for beginner students learning network navigation for the first time. We recommend observing the first 50 beta attempts before locking the time limit.
2. **John Password List Coverage:**
   - The embedded simulated wordlist currently covers common passwords (`password`, `admin`, `secret`, `dragon`, `qwerty`, `letmein`). If future lab scenarios add complex passphrases, the generator dictionary table will need additional word permutations.

---

## 7. Audit Focus List: Top 10 Places Most Likely to Hide Bugs

When reviewing the diff `main..build/weekend`, the auditor should prioritize these 10 sensitive implementation areas:

1. **[`lib/lab-engine/pentest/exam/supabase-exam-store.ts`](file:///d:/CYBER-PLATFORM/lib/lab-engine/pentest/exam/supabase-exam-store.ts)**:
   - *Area*: Concurrent answer auto-saving and state transitions.
   - *Risk*: Answer upsert racing with the final submit action near timer expiration.
2. **[`supabase/migrations/20261017120000_pentest_l1_exams.sql`](file:///d:/CYBER-PLATFORM/supabase/migrations/20261017120000_pentest_l1_exams.sql)**:
   - *Area*: RLS policies on `pentest_exam_answers`.
   - *Risk*: Ensuring learners cannot insert or mutate answers after the parent attempt status is `'submitted'`.
3. **[`lib/lab-engine/pentest/exam/scenario-questions.ts`](file:///d:/CYBER-PLATFORM/lib/lab-engine/pentest/exam/scenario-questions.ts)**:
   - *Area*: Deterministic scenario question answer normalization.
   - *Risk*: False negative scoring due to whitespace or casing differences in short-answer finding inputs.
4. **[`app/(app)/exam/pentest/actions.ts`](file:///d:/CYBER-PLATFORM/app/(app)/exam/pentest/actions.ts)**:
   - *Area*: Server action boundaries and error sanitization.
   - *Risk*: Leaking internal Postgres error strings or stack traces to the client on unexpected database exceptions.
5. **[`lib/lab-engine/netrange/engine.ts`](file:///d:/CYBER-PLATFORM/lib/lab-engine/netrange/engine.ts)**:
   - *Area*: Command chaining parser (`&&`, `;`).
   - *Risk*: Malformed or deeply nested quote escapes causing unhandled exceptions in the simulated terminal loop.
6. **[`lib/certificates/service.ts`](file:///d:/CYBER-PLATFORM/lib/certificates/service.ts)**:
   - *Area*: Certificate claim idempotency.
   - *Risk*: Simultaneous double-clicks on "Issue Certificate" creating duplicate rows for the same track and level.
7. **[`lib/security/bundle-scan.ts`](file:///d:/CYBER-PLATFORM/lib/security/bundle-scan.ts)**:
   - *Area*: Client-side bundle leak prevention regexes.
   - *Risk*: Ensuring newly authored scenario generator imports never inadvertently leak into client component bundles.
8. **[`lib/identity/learner-export.ts`](file:///d:/CYBER-PLATFORM/lib/identity/learner-export.ts)**:
   - *Area*: GDPR learner data export allowlist.
   - *Risk*: Confirming that `pentest_exam_attempts` exports user scores and timestamps without exposing scenario seeds.
9. **[`components/labs/pentest/exams/PentestExamTimerHud.tsx`](file:///d:/CYBER-PLATFORM/components/labs/pentest/exams/PentestExamTimerHud.tsx)**:
   - *Area*: Countdown timer React lifecycle and cleanup.
   - *Risk*: Timer memory leaks or cascading state updates violating React 19 rendering constraints.
10. **[`lib/handler/pentest-guard.ts`](file:///d:/CYBER-PLATFORM/lib/handler/pentest-guard.ts)**:
    - *Area*: Adversarial prompt injection defense.
    - *Risk*: Sophisticated roleplay or multi-language prompt attacks coercing the Socratic tutor into dumping scenario flags.

---

## 8. Verification Evidence & Artifact Locations

- **Full Playwright Design Evidence Screenshots (390px and 1440px)**:
  `docs/design/evidence/weekend/` (12 screenshots covering Track Overview, Module Detail, NetRange Lab, Exam Lobby, Readiness Gate, and Certificates Registry).
- **Automated Regression Spec**:
  `tests/e2e/weekend-evidence.spec.ts` (asserts zero horizontal overflow $\le 0$px on both desktop and mobile viewports).
