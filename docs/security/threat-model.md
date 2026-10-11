# CyberBLADE Threat Model (AppSec Hardening)

**Document Version:** 1.0  
**Target Architecture:** Next.js 16 (App Router + Proxy), Supabase PostgreSQL with RLS, Local-First JSON fallback, Socratic AI Handler  
**Scope:** CyberBLADE Learning Platform (`d:\CYBER-PLATFORM`)  
**Security Standard:** Higher-than-average baseline appropriate for a cybersecurity training platform targeted by skilled adversarial learners.

---

## 1. Asset Inventory

| Asset ID | Asset Name | Description | Sensitivity |
| :--- | :--- | :--- | :--- |
| **A-01** | Operator Accounts & Sessions | Auth sessions (`OPERATOR_COOKIE`, Supabase JWTs, PKCE tokens), profile identities, user IDs. | High |
| **A-02** | Curriculum Progress & Ranks | Lesson checks passed, rank challenge completion states, certification readiness scores. | High |
| **A-03** | XP Ledger & Streaks | Immutable reward records (`xp_events`), daily streaks, verified achievement badges. | Medium |
| **A-04** | Challenge Flags & Solutions | Dynamic generator seeds, known answers, check validation criteria, CTF flags. | High |
| **A-05** | Handler AI Quota & Budget | Provider API keys (Gemini, Groq), daily token/request ceilings, circuit breaker states. | High |
| **A-06** | Personally Identifiable Info (PII) | Learner emails, OAuth identities, IP addresses, audit trail entries. | High |
| **A-07** | Local File Storage (`.data/`) | Local-first JSON files, file locks, diagnostic dumps. | High (must be unreachable in prod) |

---

## 2. Threat Actors & Motivations

1. **Anonymous Visitor / Automated Scanner:** Probing exposed endpoints, testing open redirects, attempting email bombing via OTP/magic-link endpoints, mapping site attack surface.
2. **Authenticated Learner / Curious Student:** Legitimate user attempting to inspect client code, tamper with network requests, or test input boundaries.
3. **Cheater / Rank Forger:** Highly motivated to bypass lab verification, forge completion states, extract solution flags directly, spoof rank promotions, or bypass challenge cooldowns.
4. **Scraper / Competitor:** Systematically dumping proprietary curriculum lessons, lab environments, and challenge seeds.
5. **Malicious Insider / Impersonator:** Registering authoritative handles (`admin`, `staff`, `root`, `cyberblade`) or using unicode/homoglyphs to deceive learners.
6. **Compromised Dependency / Supply Chain:** Malicious or vulnerable npm packages attempting prototype pollution, data exfiltration, or remote execution during build/runtime.

---

## 3. Trust Boundaries

```
[ Learner Browser / DOM / Untrusted Client ]
              │ (HTTPS / TLS, Cookies, Headers)
              ▼
    ┌───────────────────────────────────┐
    │ Trust Boundary 1: Next.js Proxy   │ (proxy.ts: CSP, HSTS, CooP, Origin check)
    └───────────────────────────────────┘
              │
              ▼
    ┌───────────────────────────────────┐
    │ Trust Boundary 2: Server Actions  │ (Zod input validation, session auth, rate limiting)
    │ & App Router Handlers             │
    └───────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────┐   ┌───────────────────────────────┐
│ Trust Boundary 3:    │   │ Trust Boundary 4: External AI │
│ Supabase PostgreSQL  │   │ Providers (Gemini / Groq)     │
│ (RLS, Server Client, │   │ (Output sanitizer, token      │
│  Schema Invariants)  │   │  metering, circuit breaker)   │
└──────────────────────┘   └───────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│ Local File Store     │ (Fail-closed in production, zero traversal)
│ (.data/ directory)   │
└──────────────────────┘
```

---

## 4. Entry Points & Attack Surface

- **Public Routes:** `/`, `/start`, `/credits`, `/legal/*`, `/session/*`, `/verify/*`
- **Authenticated Routes:** `/dashboard`, `/learn/[slug]`, `/labs/[labId]`, `/challenge/[rank]`, `/readiness`
- **Next.js Server Actions:**
  - `signInWithMagicLink`, `signInWithOAuth`, `signOutAction` (`lib/supabase/auth-actions.ts`)
  - `submitObjectiveAction`, `useHintAction`, `requestLabAttemptAction` (`app/(app)/labs/actions.ts`)
  - `startRankChallengeAction`, `submitRankChallengeAction` (`app/(app)/challenge/actions.ts`)
  - `askHandlerAction`, `requestHandlerHintAction` (`app/(app)/handler/actions.ts`)
  - User rights actions: `deleteAccountAction`, `exportUserDataAction` (to be added)
- **API & Route Handlers:**
  - `app/auth/callback/route.ts` (OAuth callback and PKCE code exchange)
  - `app/session/route.ts` (Session validation/clearing)
- **Interactive Sandboxes:**
  - WebApp Lab simulated browser (`components/labs/webapp/BrowserFrame.tsx` with iframe isolation)
  - Terminal Virtual File System and command interpreter (`lib/lab-engine/terminal`)
  - Packet Engine inspector and filter evaluator (`lib/lab-engine/packet`)

---

## 5. Top 15 Ranked Security Risks

| Rank | Risk ID | Threat & Vulnerability Description | Likelihood | Impact | Risk Score | Mitigation Focus |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | **R-01** | **Direct Database RLS Bypass / Insecure XP & Rank Mutation:** Authenticated user with direct Supabase access inserts arbitrary rows into `xp_events` or mutates `operators.rank` directly. | High | Critical | **High (1)** | RLS with `WITH CHECK`, lock down `operators`, restrict `xp_events` inserts to trusted server logic, add DB triggers/constraints. |
| **2** | **R-02** | **Production Local Store Fallback:** App accidentally falls back to unencrypted `.data/` file store in production if env variables are absent or misconfigured. | Med | Critical | **High (2)** | Fail-closed startup check: refuse boot in local mode if `NODE_ENV=production` or Supabase env vars are partially set. |
| **3** | **R-03** | **Handler AI Quota & Budget Exhaustion:** Malicious user floods AI Handler with requests, bypassing client limits to exhaust API credits. | High | High | **High (3)** | Server-side IP and user rate limiting, global daily spend ceiling, heuristic fallback under load. |
| **4** | **R-04** | **Cross-Site Scripting (XSS) in Dynamic Rendering:** Hostile payloads in packet details, terminal output, SIEM events, or operator handles executed in DOM. | Med | High | **High (4)** | Strict HTML sanitization, escape handles, eliminate raw `dangerouslySetInnerHTML`, assert inert rendering. |
| **5** | **R-05** | **Permissive Content Security Policy (CSP):** Overly broad CSP allowing `'unsafe-inline'`, `'unsafe-eval'`, or arbitrary `https:` hosts. | High | High | **High (5)** | Enforce strict nonce-based or hash-based CSP, tighten script-src, frame-ancestors, connect-src, object-src 'none'. |
| **6** | **R-06** | **Open Redirect via `next` Parameter:** Attacker manipulates `/auth/callback?next=...` to redirect authenticated users to phishing domains. | Med | High | **High (6)** | Strict URL normalization, disallow protocol-relative (`//`) or backslash (`/\`) escapes; allow only same-origin relative paths. |
| **7** | **R-07** | **Email Bombing & Auth Endpoint Flooding:** Unauthenticated actor sends hundreds of OTP magic links to victim email addresses. | High | Med | **High (7)** | IP- and email-based rate limiting on `signInWithMagicLink`, generic response messages avoiding email enumeration. |
| **8** | **R-08** | **Privilege Escalation & Handle Impersonation:** Learner registers handle `admin`, `system`, `root`, or uses zero-width characters to spoof staff identity. | Med | Med | **Medium (8)** | Enforce strict handle validation: length, charset (`^[a-z0-9_]+$`), block reserved word dictionary, sanitize rendering. |
| **9** | **R-09** | **Cross-Site Request Forgery (CSRF) on Server Actions:** State-changing requests initiated from external origins without Origin/Referer verification. | Med | High | **High (9)** | Verify Next.js Origin/Host header validation, disallow cross-origin mutating actions, ensure SameSite cookies. |
| **10** | **R-10** | **Information Disclosure via Stack Traces or Verbose SQL:** Raw database errors, file paths, or backend stack traces returned to client responses. | High | Med | **Medium (10)** | Generic client-facing error wrappers; detailed structured errors logged only to secure server-side sinks. |
| **11** | **R-11** | **Secret Flag & Solution Leaks in Client Bundles:** Static lab answers or generator solutions inadvertently bundled into client components. | Med | High | **High (11)** | Verify server-only boundaries (`import "server-only"`), confirm solution verification executes strictly on server. |
| **12** | **R-12** | **SSRF / Command Injection via Server Integrations:** Server actions or backend utilities fetching user-supplied URLs or executing OS processes. | Low | Critical | **High (12)** | Audit all fetch utilities; enforce strict URL allowlists; block private/link-local IPv4/IPv6 ranges (RFC 1918, 169.254.0.0/16). |
| **13** | **R-13** | **Vulnerable Dependencies (CVEs in Supply Chain):** Known vulnerabilities in transitive npm dependencies causing DoS or prototype pollution. | High | Med | **Medium (13)** | Run `npm audit`, resolve fixable packages, pin dependencies, enforce Node engine version. |
| **14** | **R-14** | **Privacy & DPDP Act 2023 Non-Compliance:** Lack of user right to erasure (account deletion), data export, or minor consent handling. | Med | High | **High (14)** | Implement account hard deletion (cascading across all tables), data export endpoint, document compliance foundation. |
| **15** | **R-15** | **Lab Sandbox Escape / Host Origin Impairment:** Intentionally vulnerable simulated web app breakout via iframe postMessage or shared origin. | Low | High | **Medium (15)** | Ensure iframe sandbox attributes omit `allow-same-origin`, enforce strict postMessage origin validation. |

---

## 6. Implementation Strategy & Pass Order

1. **Part B:** Database RLS, Migration of P3/P4 state, IDOR tests, Progression integrity, Fail-closed local mode.
2. **Part C:** Authentication, PKCE callback hardening, Open redirect, Handle sanitation, CSRF & Rate limiting.
3. **Part D:** Browser security, CSP hardening, Security headers, XSS audit & hostile string rendering tests.
4. **Part E:** Input validation schemas, SQL injection audit, SSRF/command injection checks, Error sanitization.
5. **Part F:** Secrets scan, Typed environment validation, Dependency triage, Security policies (`SECURITY.md`, `security.txt`).
6. **Part G:** Abuse protection, Global spend ceiling, Quota enforcement, Graceful degradation.
7. **Part H:** Data inventory, Account deletion & Data export implementation, Minor privacy, Audit logging.
8. **Part I:** Adversarial test suite (`tests/security/`), top 15 risk attack logs, final verification gates.
