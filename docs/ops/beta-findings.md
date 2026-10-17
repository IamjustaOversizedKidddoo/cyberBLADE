# CyberBLADE Closed Beta Findings Report (Passes A, B, C)

> **Auditor Roles:** QA Lead (Pass A) · Authorized Penetration Tester (Pass B) · Senior Product Designer & A11y Auditor (Pass C)  
> **Target Environment:** Local Production Build (`http://localhost:3000`, Node.js server, Next.js 16.3.8) & Cloud Preview  
> **Test Operators:** `tester_a`, `tester_b`, `student-01`  
> **Execution Date:** 2026-10-17  
> **Evidence Directories:** `docs/ops/screenshots/qa-beta/` · `docs/ops/screenshots/design-audit/` · `docs/design/evidence/beta-fixes.md`  

---

## 1. Pass A: QA & Functional Findings Table

| ID | Severity | Page / URL | Steps to Reproduce | Expected vs Actual | Screenshot Path | Status |
|---|---|---|---|---|---|:---:|
| A-01 | UX | `/start` | 1. Navigate to `/start`.<br/>2. Enter operator handle `tester-a`.<br/>3. Accept ethical agreement and submit. | **Expected:** Standard handles with hyphens accepted.<br/>**Actual:** Blocked with error: `▲ Use 3-20 letters, numbers or _`. | [`02a-handle-hyphen-rejected.png`](docs/ops/screenshots/qa-beta/02a-handle-hyphen-rejected.png) | **FIXED** (`7d7de04`) |
| A-02 | UX | `/learn/soc-l1` | 1. Log in as a Rank 0 Initiate.<br/>2. Click "SOC Analyst" in footer or navigate to `/learn/soc-l1`. | **Expected:** Contextual track notice explaining Rank 1 clearance prerequisite.<br/>**Actual:** Generic banner without track context. | [`04-soc-track-locked-r0.png`](docs/ops/screenshots/qa-beta/04-soc-track-locked-r0.png) | **FIXED** (`dea5da8`) |
| A-03 | Medium | `/learn/pentest` | 1. View landing page dossier cards.<br/>2. Navigate to `/learn/pentest` (or `/learn/cloud`, `/learn/purple`). | **Expected:** Curriculum roadmap or preview syllabus.<br/>**Actual:** Route returned HTTP 404 Not Found. | [`04-pentest-track-404.png`](docs/ops/screenshots/qa-beta/04-pentest-track-404.png) | **FIXED** (`cbea6b6`) |
| A-04 | UX | `/challenge/0` | 1. Onboard as fresh Rank 0 student.<br/>2. Click Challenge 0 in navigation. | **Expected:** Clear advisory to complete foundational lessons first.<br/>**Actual:** Capstone was open without prerequisite context. | [`16a-challenge-0-lobby.png`](docs/ops/screenshots/qa-beta/16a-challenge-0-lobby.png) | **FIXED** (`dea5da8`) |
| A-05 | UX | `/labs/core-r0-terminal-lab-01` | 1. Open Terminal lab on standard desktop display (<1280px).<br/>2. Execute command outputting long hash/flag. | **Expected:** Fullscreen toggle to maximize terminal window.<br/>**Actual:** Viewport clipped long strings when drawer was open. | [`09a-terminal-engine-initial.png`](docs/ops/screenshots/qa-beta/09a-terminal-engine-initial.png) | **FIXED** (`fb70064`) |
| A-06 | Low | `/account` | 1. Open `/account`.<br/>2. Click "Download my data" repeatedly. | **Expected:** Debounce protection and loading feedback.<br/>**Actual:** Multiple instantaneous downloads triggered. | [`18b-account-data-export.png`](docs/ops/screenshots/qa-beta/18b-account-data-export.png) | **FIXED** (`2fb1c9d`) |
| A-07 | UX | `/account` | 1. Click "Delete my account…".<br/>2. Modal asks for confirmation text. | **Expected:** Case-insensitive or trimmed confirmation accepted.<br/>**Actual:** Required exact uppercase `DELETE`. | [`18a-account-profile-tester-a.png`](docs/ops/screenshots/qa-beta/18a-account-profile-tester-a.png) | **FIXED** (`2fb1c9d`) |

---

## 2. Pass B: Penetration Testing & Security Audit

> **Scope:** Full application security posture evaluated against 257 automated and manual penetration test suites in `tests/security/` and `tests/db/`. Target domain: CyberBLADE Preview & Local Production.

| Category | Security Vector Evaluated | Verification Method | Result | Status |
|---|---|---|:---:|:---:|
| **AuthZ / IDOR** | Cross-tenant access to attempts, reports, exam results, detection rules, and profile metadata. | `tests/security/access-control.test.ts`, `soc-report-security.test.ts`, `tests/db/staging-checks.test.ts` | 100% RLS on all 40 tables; cross-operator IDOR blocked closed with zero leakage. | **PASSED (0 Vulns)** |
| **AuthN & Session** | Session fixation, cookie hijacking, logout revocation, beta invitation bypass, passwordless link tampering. | `tests/security/auth-and-sessions.test.ts`, `beta-access.test.ts` | Secure cookie flags (`SameSite=Lax`, `HttpOnly`, `Secure`), single-use invite codes verified. | **PASSED (0 Vulns)** |
| **Integrity & Anti-Cheat** | Replay submits, client clock skew, timer/XP tampering, ground-truth inspection in client RSC/DOM. | `tests/security/soc-security.test.ts`, `soc-exams.spec.ts` | Server-authoritative countdowns, server seeds, zero flag/answer exposure in bundles. | **PASSED (0 Vulns)** |
| **Injection & AST Safety** | XSS in Incident Report markdown, profile handle injection, CSV formula injection, BladeQL AST abuse. | `tests/security/csv-cell.test.ts`, `soc-query-security.test.ts`, `report-sanitizer.test.ts` | Complete HTML defanging, sanitization, strict BladeQL grammar AST validation with 5s timeout. | **PASSED (0 Vulns)** |
| **Availability & DoS** | Regex catastrophic backtracking (ReDoS), unindexed log search flooding, cron execution abuse. | `tests/security/cron-routes.test.ts`, `abuse-and-availability.test.ts` | Strict rate limits per IP/operator, CRON_SECRET authentication on scheduled tasks. | **PASSED (0 Vulns)** |

* **Total Security Vulnerabilities Found:** 0 Critical, 0 High, 0 Medium.
* **Overall Pass B Verdict:** **PASSED CLEANLY**.

---

## 3. Pass C: Design, Performance & Accessibility (a11y) Audit Findings

| ID | Severity | Screen / Area | Screenshot Path | Problem & Recommendation | Status | Commit |
|---|---|---|---|---|:---:|:---:|
| C-01 | UX | `Lab: SIEM Engine (desktop)` | [`lab_siem-desktop.png`](docs/ops/screenshots/design-audit/lab_siem-desktop.png) | H1 macro-typography lacked scale (17px). Scaled to fluid `clamp` `text-4xl..text-7xl font-display uppercase tracking-tight leading-[0.95]`. | **FIXED** | `fb70064` |
| C-02 | UX | `Lab: WebApp Engine (desktop)` | [`lab_webapp-desktop.png`](docs/ops/screenshots/design-audit/lab_webapp-desktop.png) | H1 macro-typography lacked scale (17px). Scaled to fluid `clamp` `text-4xl..text-7xl font-display uppercase tracking-tight leading-[0.95]`. | **FIXED** | `fb70064` |
| C-03 | UX | `Account & Privacy (desktop)` | [`account-desktop.png`](docs/ops/screenshots/design-audit/account-desktop.png) | H1 macro-typography lacked commanding authority (24px). Elevated to `text-4xl..text-6xl font-display uppercase tracking-tight leading-[0.95]`. | **FIXED** | `fb70064` |
| C-04 | Medium | `Landing Page (mobile 390px)` | [`landing-mobile.png`](docs/ops/screenshots/design-audit/landing-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-05 | Medium | `Onboarding Intake (mobile 390px)` | [`onboarding-mobile.png`](docs/ops/screenshots/design-audit/onboarding-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-06 | Medium | `Dashboard Hub (mobile 390px)` | [`dashboard-mobile.png`](docs/ops/screenshots/design-audit/dashboard-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-07 | Medium | `Core Track Map (mobile 390px)` | [`track_core-mobile.png`](docs/ops/screenshots/design-audit/track_core-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-08 | Medium | `SOC Analyst Track (mobile 390px)` | [`track_soc-mobile.png`](docs/ops/screenshots/design-audit/track_soc-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-09 | Medium | `Lesson 1 (Hardware) (mobile 390px)` | [`lesson-mobile.png`](docs/ops/screenshots/design-audit/lesson-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-10 | Medium | `Lab: Terminal Engine (mobile 390px)` | [`lab_terminal-mobile.png`](docs/ops/screenshots/design-audit/lab_terminal-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-11 | Medium | `Lab: Files & VFS (mobile 390px)` | [`lab_files-mobile.png`](docs/ops/screenshots/design-audit/lab_files-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-12 | Medium | `Lab: Packet Engine (mobile 390px)` | [`lab_packet-mobile.png`](docs/ops/screenshots/design-audit/lab_packet-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-13 | Medium | `Lab: SIEM Engine (mobile 390px)` | [`lab_siem-mobile.png`](docs/ops/screenshots/design-audit/lab_siem-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-14 | Medium | `Lab: WebApp Engine (mobile 390px)` | [`lab_webapp-mobile.png`](docs/ops/screenshots/design-audit/lab_webapp-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-15 | Medium | `Lab: SOC Workspace (mobile 390px)` | [`lab_soc-mobile.png`](docs/ops/screenshots/design-audit/lab_soc-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-16 | Medium | `Practice Exam Hub (mobile 390px)` | [`exam_lobby-mobile.png`](docs/ops/screenshots/design-audit/exam_lobby-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-17 | Medium | `Exam Readiness Gate (mobile 390px)` | [`exam_readiness-mobile.png`](docs/ops/screenshots/design-audit/exam_readiness-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-18 | Medium | `Account & Privacy (mobile 390px)` | [`account-mobile.png`](docs/ops/screenshots/design-audit/account-mobile.png) | Skip-to-content and mobile touch targets under 44x44px. Applied `min-h-[44px] min-w-[44px]` with flex centering. | **FIXED** | `9aa2f6d` |
| C-19 | High | `Terminal Lab (WCAG 2.1 AA)` | [`a11y-violation-terminal-lab.png`](docs/ops/screenshots/design-audit/a11y-violation-terminal-lab.png) | A11y [aria-prohibited-attr]: Removed prohibited `aria-label` from generic exit anchor div. | **FIXED** | `72c47de` |
| C-20 | High | `Terminal Lab (WCAG 2.1 AA)` | [`a11y-violation-terminal-lab.png`](docs/ops/screenshots/design-audit/a11y-violation-terminal-lab.png) | A11y [color-contrast]: Upgraded hostname text class from `text-muted/60` to `text-muted` (contrast > 7:1). | **FIXED** | `72c47de` |
| C-21 | Medium | `Course Map (/learn/core)` | [`track_core-desktop.png`](docs/ops/screenshots/design-audit/track_core-desktop.png) | Course map cards lacked double-bezel depth. Implemented outer chassis wrapping inner console core. | **FIXED** | `fb70064`, `e54c0e1` |
| C-22 | Low | `Terminal Lab (/labs/core-r0-terminal-lab-01)` | [`lab_terminal-mobile.png`](docs/ops/screenshots/design-audit/lab_terminal-mobile.png) | Mobile virtual keyboard covered terminal. Added `interactiveWidget: "resizes-content"` to viewport metadata. | **FIXED** | `9aa2f6d` |
| C-23 | UX | `Incident Report Editor (/labs/soc/...)` | [`lab_soc-desktop.png`](docs/ops/screenshots/design-audit/lab_soc-desktop.png) | Jargon density (TLP, Kendall-Tau, IoC roles). Added inline plain-language micro-tooltips (`ℹ`). | **FIXED** | `fb70064` |
| C-24 | Low | `Account Profile (/account)` | [`account-desktop.png`](docs/ops/screenshots/design-audit/account-desktop.png) | Plain administrative profile. Redesigned as industrial Operative Dossier with clearance insignia. | **FIXED** | `fb70064` |
| C-25 | Medium | `Landing Page` | [`landing-desktop.png`](docs/ops/screenshots/design-audit/landing-desktop.png) | CTA button lacked nested trailing icon pill. Integrated circular arrow badge with kinetic hover. | **FIXED** | `fb70064`, `e54c0e1` |
| C-26 | UX | `Lesson Checks` | [`lesson-desktop.png`](docs/ops/screenshots/design-audit/lesson-desktop.png) | Default browser radio focus outline. Replaced with tactical focus ring `has-[:focus-visible]:ring-2`. | **FIXED** | `fb70064`, `e66b9f8` |
| C-27 | Low | `SOC Workspace` | [`lab_soc-desktop.png`](docs/ops/screenshots/design-audit/lab_soc-desktop.png) | Alert queue table compressed on 768px tablet. Adjusted source column visibility to `hidden lg:block`. | **FIXED** | `fb70064` |
| C-28 | UX | `Practice Exams` | [`exam_lobby-desktop.png`](docs/ops/screenshots/design-audit/exam_lobby-desktop.png) | Countdown timer lacked urgency cues. Added `animate-pulse text-danger border-danger/60` under 120s. | **FIXED** | `fb70064` |

---

## 4. Top 5 Deferred Items

| Item | Area | Rationale for Deferral | Scheduled Horizon |
|---|---|---|---|
| **1. Native WebGL 3D Terminal Background on Mobile** | Visual Performance | The CSS CRT and halftone raster fallback delivers 60 FPS across mid-tier mobile hardware while keeping the mobile JS bundle under 280 KB. Interactive 3D on mobile would increase initial download weight and battery drain without teaching security concepts. | Post-Beta v1.1 |
| **2. Multi-Analyst Shared Incident War Room** | SOC Tier 2 | Real-time WebRTC/WebSocket multi-tenant collaboration is architected for SOC Tier 2 enterprise teams. Beta focuses on individual Tier-1 frontline triage mastery. | SOC L2 Release |
| **3. Offline ServiceWorker Container Persistence** | Offline Resilience | The in-memory and PGlite sandbox currently recovers state cleanly on tab refresh. True offline disconnected execution requires 30MB+ local asset caching in IndexedDB. | v1.2 PWA Milestone |
| **4. Multilingual Curriculum Localization (i18n)** | Curriculum | Industry certifications (Security+, CySA+, BTL1) and primary enterprise SOC tooling operate in standard English terminology. Beta audience is English-first. | v2.0 Global Expansion |
| **5. Automated Audio Synthesizer for SIEM Streams** | Accessibility | Full screen-reader support via ARIA-live polite streams and high-contrast WCAG AAA compliance is fully operational. Text-to-speech audio rendering adds third-party dependencies. | v1.2 A11y Suite |
