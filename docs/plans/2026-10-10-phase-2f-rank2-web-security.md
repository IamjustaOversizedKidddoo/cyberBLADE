# Phase 2F — Rank 2 · Watcher: Web Security Core Implementation Plan

**Branch:** `phase-2f-rank-2-web-security`  
**Dependencies:** Phase 2A, 2B, 2C, 2D, 2E merged on `main`  
**Date:** 2026-10-10  
**Status:** In Progress  

---

## 1. Overview & Objectives

Phase 2F delivers the complete **Rank 2 (Watcher)** tier of the CyberBLADE platform, introducing the **`webapp` in-browser lab engine**, the comprehensive **Web Security & Security Core Curriculum (Orders 21–32)**, three hands-on OWASP labs (SQLi, XSS, IDOR), and the **Rank 2 Capstone Challenge** ("Operation Watchtower").

### Core Goals
1. **`webapp` Lab Sandbox Engine:**
   - Client-side browser simulator running in an iframe with simulated URL bar, navigation history, and query parameter handling.
   - Built-in **HTTP Inspector (Burp-lite / DevTools style)**: captures outgoing requests, response status codes, headers (`Set-Cookie`, `Content-Type`, `CSP`), and payload bodies.
   - **Cookie Jar & Storage Inspector**: inspect active cookies, JWTs, and local storage.
2. **Rank 2 Curriculum (Orders 21–32):**
   - 12 comprehensive lessons adhering strictly to `docs/curriculum/teaching-style.md` and the 7-part briefing format.
   - Interactive terminal & web checks (`.checks.yaml` with 4 questions each).
   - Real-world cybersecurity analogies, simple explanations first, zero untranslated jargon.
3. **Rank 2 Web Security Labs:**
   - `core-r2-sqli-lab-01` ("SQL Injection: Auth Bypass & Union Extraction"): Seeded vulnerable catalog and authentication endpoints.
   - `core-r2-xss-lab-01` ("Stored XSS & Session Hijacking"): Stored comment board and simulated administrator bot session cookie extraction.
   - `core-r2-idor-lab-01` ("BOLA / IDOR Horizontal Escalation"): Object reference enumeration and sensitive PII retrieval.
4. **Rank 2 Capstone Challenge (`core-r2-challenge-01`):**
   - "Operation Watchtower": 35-minute timed incident triage across multiple vulnerabilities.
   - Promotes operator from **Rank 2 (Watcher)** to **Rank 3 (Sentinel)**.
5. **Quality Gates:**
   - 100% pass on `check:content`, `lint`, `typecheck`, `test` (unit & property tests across 1,000 seeds), `build`, and Playwright E2E.

---

## 2. Technical Architecture & File Layout

### 2.1 Lab Engine Extensions (`lib/lab-engine/`)
- `lab-schema.ts`: Add `"webapp"` to `labSchema.type` enum (`z.enum(["terminal", "packet", "webapp"])`).
- `env.ts`: Add `{ kind: "webapp"; app: WebAppEnv }` to `LabEnv`.
- `webapp/types.ts`: Defines `HttpEndpoint`, `HttpRequest`, `HttpResponse`, `WebAppEnv`, and `WebAppSession`.
- `webapp/simulator.ts`: Deterministic HTTP request dispatcher with mock routing, parameterized SQL queries, cookie management, and HTML template rendering.

### 2.2 WebApp UI Components (`components/labs/webapp/`)
- `WebAppLab.tsx`: Integrated workspace with dual-panel layout (Simulated Browser + HTTP/Storage Inspector).
- `BrowserFrame.tsx`: Sandboxed iframe with custom address bar, back/forward buttons, and reload.
- `HttpInspector.tsx`: Request/response logs, headers viewer, payload viewer, and cookie jar tab.

### 2.3 WebApp Lab Generators (`lib/generators/`)
- `webapp-sqli.ts`: Seeded SQL injection target with vulnerable login and product search.
- `webapp-xss.ts`: Seeded guestbook target with stored comments and admin crawler cookie extraction.
- `webapp-idor.ts`: Seeded REST API and profile viewer target with sequential UUID/ID object references.
- `webapp-capstone.ts`: Multi-stage capstone web application.

### 2.4 Curriculum Content (`content/core/rank-2/`)
- Lessons 21–32 (Orders 21–32):
  - `21-http-protocol` (HTTP methods, headers, status codes)
  - `22-cookies-sessions` (Cookies, session hijacking, tokens)
  - `23-sop-cors` (Same-origin policy, CORS misconfigurations)
  - `24-sqli` (SQL injection: auth bypass, union attacks)
  - `25-xss` (Cross-site scripting: stored, reflected, DOM, CSP)
  - `26-idor-bola` (Insecure direct object references)
  - `27-csrf` (Cross-site request forgery, anti-CSRF tokens)
  - `28-ssrf` (Server-side request forgery, metadata endpoints)
  - `29-cmd-injection` (Command injection, input validation)
  - `30-cryptography-pki` (Symmetric/asymmetric encryption, hashing, TLS)
  - `31-security-architecture` (CIA triad, defense-in-depth, MITRE ATT&CK)
  - `32-security-tooling` (Burp Suite, Nmap, DevTools, methodology)

---

## 3. Implementation Steps

1. **Step 1: Engine & Schema Upgrades** (`lib/lab-engine/`)
   - Update `lab-schema.ts` and `env.ts`.
   - Build `lib/lab-engine/webapp/` types and HTTP dispatcher.
2. **Step 2: WebApp UI Components** (`components/labs/webapp/`)
   - Build `WebAppLab.tsx`, `BrowserFrame.tsx`, `HttpInspector.tsx`.
   - Connect `LabWorkspace.tsx` to route `webapp` labs.
3. **Step 3: WebApp Generators & Labs**
   - Implement `lib/generators/webapp-*.ts`.
   - Author lab definitions (`content/labs/core-r2-*/lab.yaml` and `briefing.md`).
4. **Step 4: Rank 2 Curriculum Lessons (Orders 21–32)**
   - Author 12 MDX lessons with 7-part briefings and YAML check specifications.
   - Update `content/coverage/core.yaml` with Rank 2 coverage mappings.
5. **Step 5: Rank 2 Capstone Challenge**
   - Author `content/labs/core-r2-challenge-01/`.
   - Wire promotion from Rank 2 (Watcher) to Rank 3 (Sentinel).
6. **Step 6: Automated Verification & Documentation**
   - Author unit tests for dispatcher, generators, and UI.
   - Author Playwright E2E suite (`tests/e2e/rank-2-web.spec.ts`).
   - Run all quality gates (`check:content`, `lint`, `typecheck`, `test`, `build`, `test:e2e`).
   - Update `docs/reports/phase-2-roadmap-report.md`.
