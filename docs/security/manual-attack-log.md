# CyberBLADE Adversarial Verification & Manual Attack Log

**Tester Role:** Senior Application Security Engineer (AppSec)  
**Target:** CyberBLADE Local Test Instance (`http://localhost:3000`)  
**Scope:** Top 15 Threat Model Security Risks  
**Date:** 2026-10-11  

---

## Adversarial Attack Matrix (Top 15 Risks)

### Risk 1 (R-01): Direct Database RLS Bypass / Forged XP & Rank Escalation
- **Attack Vector:** Client attempting direct mutations to `operators.rank` and inserting arbitrary reward rows into `xp_events`.
- **Attack Payload:**
  ```javascript
  await supabase.from("operators").update({ rank: 99 }).eq("id", currentUserId);
  await supabase.from("xp_events").insert({ user_id: currentUserId, source: "exploit", amount: 999999 });
  ```
- **Observed Result (Before):** Permissive RLS in initial migration allowed `WITH CHECK (auth.uid() = user_id)` for inserts into `xp_events` and unrestricted updates on `operators`.
- **Mitigation & Fix:**
  1. Revoked client INSERT on `xp_events` (migration `20261011120000_p5_security_hardening.sql`). XP can only be inserted by server service role.
  2. Replaced `operators` UPDATE policy and added `BEFORE UPDATE` database trigger `trg_prevent_operator_rank_escalation` which throws an exception if an authenticated user attempts to modify `NEW.rank <> OLD.rank`.
  3. Regression test added: `tests/security/access-control.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 2 (R-02): Local JSON Store Fallback Active in Production
- **Attack Vector:** Deploying with misconfigured or partial Supabase environment variables, causing the app to silently fall back to unencrypted `.data/` disk storage on production servers.
- **Attack Payload:** Launching with `NODE_ENV=production` and missing `NEXT_PUBLIC_SUPABASE_URL`.
- **Observed Result (Before):** App quietly defaulted to `FileProgressRepo` and `FileOperatorStore`, creating unmonitored JSON files in `.data/`.
- **Mitigation & Fix:**
  1. Implemented `assertSafeStorageMode()` in `lib/supabase/config.ts`, called in `getCtx()` and `getOperatorStore()`. Throws a fatal startup exception (`PRODUCTION SECURITY VIOLATION`) if `NODE_ENV=production` without valid Supabase configuration.
  2. Implemented strict path traversal validation in `dataPath()`.
  3. Regression test added: `tests/unit/lib/supabase/config.test.ts` and `tests/security/input-validation.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 3 (R-03): AI Handler Quota & Budget Exhaustion via Multiple Identities
- **Attack Vector:** Attacker creates multiple anonymous accounts or clears cookies to cycle user IDs and bypass per-user daily token limits.
- **Attack Payload:** Scripted burst of 200 requests from single IP address across 20 distinct operator IDs.
- **Observed Result (Before):** Each fresh operator ID received a fresh quota allocation, depleting upstream Gemini/Groq API funds.
- **Mitigation & Fix:**
  1. Added network IP-level velocity limiter in `askHandlerAction` (max 30 req/min per IP across all operators).
  2. Implemented global daily token spending ceiling (`checkGlobalDailySpendCeiling`) in `lib/handler/metering.ts`. When global token usage crosses ceiling, the system automatically degrades all live calls to offline heuristic mode.
  3. Regression test added: `tests/security/abuse-and-availability.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 4 (R-04): Cross-Site Scripting (XSS) via Hostile Input Rendering
- **Attack Vector:** Injecting DOM/HTML execution strings via operator handles, packet payloads, or terminal output.
- **Attack Payload:**
  `<script>alert(document.cookie)</script>`  
  `<img src=x onerror=alert(1)>`  
  `javascript:alert(1)`
- **Observed Result:** React JSX treats dynamic interpolated variables (`{content}`) as inert text nodes. Only one instance of `dangerouslySetInnerHTML` exists in `app/layout.tsx` (for the static, hardcoded `PREFS_BOOT_SCRIPT`).
- **Mitigation & Fix:**
  1. Audited all dynamic output sinks.
  2. Regression test added: `tests/security/browser-security.test.ts`.
- **Status:** **VERIFIED / INERT**

---

### Risk 5 (R-05): Overly Permissive Content Security Policy (CSP)
- **Attack Vector:** Exploiting `https:` wildcard in `script-src` and `connect-src` in `proxy.ts` to load external scripts or exfiltrate tokens.
- **Attack Payload:** Attempting to load scripts from unapproved CDNs or exfiltrating data to external domains.
- **Observed Result (Before):** CSP included `script-src 'self' 'unsafe-eval' 'unsafe-inline' https:;` and `connect-src 'self' https: wss:;`.
- **Mitigation & Fix:**
  1. Removed `https:` and `wss:` wildcards from `script-src` and `connect-src`.
  2. Confined `connect-src` to `'self'` and the explicitly configured Supabase domain.
  3. Added `frame-ancestors 'self'` to CSP and enabled COOP/CORP.
  4. Regression test added: `tests/security/browser-security.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 6 (R-06): Open Redirect via Auth Callback `next` Parameter
- **Attack Vector:** Phishing attack redirecting learners to credential-harvesting site via `/auth/callback?next=//evil.example` or `/start?next=/\evil.example`.
- **Attack Payload:**
  `//evil.example`  
  `/\\evil.example`  
  `/\t/evil.example`  
  `javascript:alert(1)`
- **Observed Result:** Sanitized by `safeNextPath()` using `PROBE_ORIGIN` validation, falling back safely to `/dashboard`.
- **Mitigation & Fix:**
  1. Validated and tested URL parser behavior.
  2. Regression test added: `tests/security/auth-and-sessions.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 7 (R-07): Email Bombing via Magic Link Auth Endpoint
- **Attack Vector:** Attacker automates requests to `signInWithMagicLink` to spam a target email address or exhaust OTP email limits.
- **Attack Payload:** 50 requests in 5 seconds to `signInWithMagicLink({ email: "victim@example.com" })`.
- **Observed Result (Before):** No rate limiting; Supabase returned error messages revealing user existence status.
- **Mitigation & Fix:**
  1. Added sliding-window rate limit: max 5 requests/min per IP and max 3 requests/min per target email.
  2. Unified responses to generic message: "If an account exists for this email, a sign-in link has been sent."
  3. Regression test added: `tests/security/auth-and-sessions.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 8 (R-08): Staff Impersonation via Reserved Operator Handles
- **Attack Vector:** Learner registers handle `admin`, `system`, `root`, or `cyberblade` to impersonate staff.
- **Attack Payload:** Submitting `/start` with `handle=admin` or `handle=ROOT`.
- **Observed Result (Before):** Accepted as long as characters matched `/^[a-z0-9_]{3,20}$/`.
- **Mitigation & Fix:**
  1. Added `RESERVED_HANDLES` dictionary and Zod schema refinement.
  2. Sanitized OAuth email prefix fallback in `app/auth/callback/route.ts` to assign `op_<uid>` if reserved.
  3. Regression test added: `tests/unit/lib/identity/validation.test.ts` and `tests/security/auth-and-sessions.test.ts`.
- **Status:** **VERIFIED / MITIGATED**

---

### Risk 9 (R-09): Cross-Site Request Forgery (CSRF) on State-Changing Operations
- **Attack Vector:** Cross-origin form or script submitting actions on behalf of authenticated learner.
- **Observed Result:** Next.js App Router enforces built-in Host/Origin header matching for all Server Actions. All auth cookies use `SameSite: Lax` and `HttpOnly: true`. There are zero state-changing `GET` endpoints.
- **Status:** **VERIFIED / PROTECTED**

---

### Risk 10 (R-10): Information Disclosure via Uncaught Stack Traces
- **Attack Vector:** Intentionally corrupting database inputs or throwing errors to expose server file paths or database schemas.
- **Observed Result:** Server Actions catch errors and rethrow clean generic errors or return structured error descriptors.
- **Status:** **VERIFIED / PROTECTED**

---

### Risk 11 (R-11): Flag / Answer Extraction from Client Bundles
- **Attack Vector:** Inspecting webpack/Turbopack source maps or props for lab validation answers.
- **Observed Result:** Lab generation seeds and answers are computed exclusively on the server (`server-only`). Simulated WebApp lab dispatches through `dispatchWebAppRequestAction` on the server and never serializes solution flags to client components.
- **Status:** **VERIFIED / PROTECTED**

---

### Risk 12 (R-12): Server-Side Request Forgery (SSRF) / Command Injection
- **Attack Vector:** Injecting external or loopback URLs (`127.0.0.1`, `169.254.169.254`) into server fetch calls.
- **Observed Result:** No user-controlled URLs are fetched by the server. External fetches are strictly constrained to hardcoded provider API endpoints (Gemini & Groq). Terminal execution is simulated in-memory via TypeScript VFS.
- **Status:** **VERIFIED / IMMUNE**

---

### Risk 13 (R-13): Supply Chain Dependencies & Transitive CVEs
- **Attack Vector:** Exploiting known CVEs in npm dependencies (`braces`, `sprintf-js`).
- **Observed Result:** `npm audit` flagged 9 vulnerabilities (4 moderate, 5 high) in dev toolchain (`eslint-config-next`) and build-time frontmatter parsing (`gray-matter`).
- **Triage Result:** Unexploitable at runtime in CyberBLADE context. Added npm overrides and Dependabot monitoring.
- **Status:** **TRIAGED / ACCEPTED LOW RUNTIME RISK**

---

### Risk 14 (R-14): Privacy & DPDP Act 2023 Non-Compliance (Right to Erasure / Portability)
- **Attack Vector:** Regulatory failure to provide account deletion, data portability, or minor protection compliance.
- **Mitigation & Fix:**
  1. Implemented `exportUserDataAction()` providing complete JSON export.
  2. Implemented `deleteAccountAction()` cascading deletion across all profile and progress tables.
  3. Added append-only `audit_events` with salted SHA-256 IP hashing (`hashIp`).
  4. Documented DPDP Act 2023 minor consent considerations in `docs/security/data-inventory.md`.
- **Status:** **VERIFIED / SCAFFOLDED**

---

### Risk 15 (R-15): Lab Sandbox Breakout (Host Origin Impairment)
- **Attack Vector:** Simulated vulnerable app escaping iframe to compromise host cookies or parent window DOM.
- **Observed Result:** Iframe configured with `sandbox="allow-scripts allow-forms"`. Omits `allow-same-origin`, enforcing an opaque unique origin. Navigation handler drops `javascript:`, `data:`, and `vbscript:` schemes.
- **Status:** **VERIFIED / ISOLATED**
