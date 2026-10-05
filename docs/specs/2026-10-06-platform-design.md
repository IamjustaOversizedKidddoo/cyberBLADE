# Cybersecurity Learning Platform — Design Spec

**Status:** Approved concept, ready for implementation planning
**Date:** 2026-10-06
**Owner:** Himanshu
**Codename:** `NEON` (placeholder — final brand name TBD by owner, see §15)

---

## 1. Vision

A text-first, hacker-themed web platform that takes **anyone — tech or non-tech background, starting from zero** — to **job-ready cybersecurity professional**, through:

- deep, plain-language text lessons (no videos, no live mentors),
- hands-on labs that run in the browser,
- an AI tutor ("the Handler") that replaces human mentors,
- practical, hard-to-fake certification exams.

**Positioning:** "Learn cybersecurity like a hacker game. Finish with skills you can prove."

### Success criteria

1. A learner with no IT background can complete the shared core without outside help.
2. Each track graduate has a **portfolio** (reports, detections, write-ups) a hiring manager can inspect.
3. Track content covers **every objective** of the comparable industry certs (§5.2) — and goes deeper with hands-on practice for each.
4. Final exams are practical and per-candidate randomized, so the certificate means something.
5. Runs cheaply: no per-learner servers in v1.

---

## 2. Target users (launch: India)

| Persona | Background | Needs |
|---|---|---|
| Fresher / student | BCA, B.Tech, B.Sc, any degree | Job-ready skills, portfolio, affordable |
| Non-tech career switcher | Commerce, arts, BPO, sales | Zero-assumption explanations, confidence |
| IT professional | Helpdesk, sysadmin, developer | Fast-track past basics into a specialty |

Assumptions: English-first (Hinglish explanations available via the AI Handler), laptop + browser, some learners on low-end hardware or mobile, price-sensitive.

---

## 3. Product structure

### 3.1 Shared core + job tracks

```
SHARED CORE (everyone)          JOB TRACKS (pick after core)
Rank 0  Initiate   ─┐
Rank 1  Operator    ├──► "Find your role" quiz ──► SOC Analyst      (launch)
Rank 2  Watcher    ─┘                          ├─► Penetration Tester (launch)
                                               ├─► Cloud Security    (launch)
                                               └─► 15+ tracks shown as locked "Coming soon"
```

Each track has its own Ranks 3–5 (Hunter → Analyst → Sentinel, renamed per track), a capstone, and a final certification exam.

**Full track catalogue (roadmap):**
- Defend: SOC Analyst, Incident Responder, Threat Hunter, Detection Engineer, Digital Forensics, Malware Analyst
- Attack: Penetration Tester, Red Teamer, Bug Bounty Hunter, Mobile Security
- Build: Cloud Security, AppSec/DevSecOps, Network Security Engineer, IAM Engineer, OT/ICS Security
- Emerging: AI Security, Threat Intelligence
- Governance: GRC Analyst, Security Auditor, Privacy Analyst
- Leadership: Security Architect, Security Manager/CISO path

### 3.2 The lesson loop (every lesson, no exceptions)

1. **Briefing** — the concept in plain language, everyday analogy first, then technical depth.
2. **Terminal Check** — 2–4 quick questions (recall + application).
3. **Lab** — hands-on task in the browser.
4. **Debrief** — what a real professional does here, common mistakes, real-world incident example, XP awarded.

### 3.3 Rank gates

Advancing a rank requires passing a **practical rank challenge** (not multiple choice only). Failed challenges can be retried with a new randomized variant after a cooldown.

---

## 4. Content standard — "better than the certs"

The goal is content that is **deeper and more practical** than CEH, CompTIA Security+, and OSCP preparation material. This is the standard every lesson must meet.

### 4.1 The 8-layer depth rule

Every concept is taught through these layers (lesson template in `CLAUDE.md`):

1. **What it is** — plain-language definition + everyday analogy (non-tech friendly).
2. **Why it exists** — the problem it solves; history if it helps understanding.
3. **How it works** — internals, step by step, with diagrams (ASCII/SVG) and packet/log/command examples.
4. **How attackers abuse it** — real techniques, mapped to MITRE ATT&CK IDs.
5. **How defenders detect it** — what it looks like in logs, SIEM queries, detection rules.
6. **How to prevent/fix it** — hardening, configuration, controls.
7. **Hands-on** — a lab where the learner does it themselves.
8. **Real-world case** — a documented public incident or breach where this mattered.

Certs typically cover layers 1, 3 and 6. Covering all eight is the differentiator.

### 4.2 Objective mapping (coverage guarantee)

- For each track, download the **current official exam objectives** of the comparable certs and maintain a coverage matrix `content/coverage/<track>.yaml` mapping each objective → lesson(s) + lab(s).
- CI check fails if any mapped objective has no lesson.

| Track | Benchmark certs to exceed |
|---|---|
| Shared core | CompTIA A+ (security-relevant parts), Network+, Security+ |
| SOC Analyst | Security+, CompTIA CySA+, Blue Team Level 1, Splunk Core User, GIAC GCIH/GSOC level topics |
| Penetration Tester | CEH, eJPT, OSCP (PEN-200 syllabus), HTB CPTS |
| Cloud Security | AWS Certified Security – Specialty, CCSK, CCSP (cloud domains) |

### 4.3 Rules

- **Original content only.** Map *objectives*; never copy cert vendors' text, questions, or course material. No "exam dumps".
- **No false equivalence claims** in marketing (e.g., don't say "equal to OSCP"). Say "covers every Security+ objective, plus hands-on labs for each" — verifiable via the public coverage matrix.
- **Accuracy:** every technical claim must be checkable; commands and queries in lessons must be tested in the lab engine or a real environment.
- **Freshness:** each lesson has `last_reviewed` metadata; quarterly review cycle; content older than 12 months is flagged.
- **Expert review:** before a track goes public, an external practitioner reviews it (paid reviewer or community beta). AI-written drafts are never published unreviewed.
- **Ethics:** every offensive lesson includes legal/authorization context; learners accept an ethical-use agreement at signup.

---

## 5. Assessment & certification

### 5.1 Levels of assessment

| Level | Format |
|---|---|
| Terminal Check | Auto-graded questions per lesson |
| Lab | Flags / auto-detected objectives |
| Rank challenge | Timed practical scenario, randomized per learner |
| Track exam | Long practical exam + professional report, graded by rubric (AI first pass + human review on borderline/pass) |

### 5.2 Track exams (designed to be harder to fake than MCQ certs)

- **SOC Analyst:** 8-hour simulated SOC shift — 60+ alerts (mostly noise), 3 real incidents hidden inside; must triage, investigate, write incident reports.
- **Penetration Tester:** 24-hour exam against a simulated network + web apps (v1 simulated; v2 real containers), then 24 hours to submit a professional pentest report (OSCP-style rigor).
- **Cloud Security:** Breach-and-fix of a misconfigured mock cloud org + an architecture review report.

### 5.3 Integrity

- Per-candidate randomized scenarios (generated IPs, usernames, flags, attack paths).
- Report similarity checks across candidates.
- Public **verification page** per certificate (`/verify/<credential-id>`) showing skills proven and a summary of the exam.
- v2: optional proctoring (webcam/screen) for the final exam.

### 5.4 Earning recognition (honest note)

Content quality alone doesn't make a cert recognized — HR filters still look for Security+/CEH/OSCP. Recognition is built by: publishing the coverage matrix and exam format, publishing pass rates, hiring-partner programme with Indian SOCs/MSSPs, and graduate outcomes. Until then, the platform also prepares learners to pass the established certs if they choose.

---

## 6. Curriculum outline (launch scope)

Lesson counts are estimates; each module ends with a mini-lab.

### Shared core (~70 lessons, 6–8 weeks)

**Rank 0 · Initiate — How computers work**
1. What a computer really is (CPU, memory, storage)
2. Operating systems, files, permissions (concept)
3. How the internet works (clients, servers, packets)
4. Your first terminal
5. Thinking like a defender vs an attacker
6. Cyber careers map + ethics & law (IT Act 2000, DPDP Act 2023)

**Rank 1 · Operator — Foundations**
1. Linux fundamentals (filesystem, users, permissions, processes, services, bash)
2. Windows fundamentals (registry, services, Event Logs, PowerShell, Active Directory basics)
3. Networking (OSI/TCP-IP, IP/subnetting, ports, TCP/UDP, DNS, DHCP, HTTP/S, TLS)
4. Packet analysis (Wireshark-style capture viewer)
5. Scripting basics (bash, Python for security tasks)

**Rank 2 · Watcher — Security core**
1. CIA triad, risk, threats/vulnerabilities, controls
2. Cryptography (hashing, symmetric/asymmetric, PKI, certificates)
3. Authentication & identity (passwords, MFA, SSO, OAuth basics)
4. Attack types (phishing, malware families, web attacks, password attacks, social engineering)
5. MITRE ATT&CK & Cyber Kill Chain
6. Security tools landscape (firewall, IDS/IPS, SIEM, EDR, WAF, proxy)
7. AI in security (how AI is used by attackers and defenders; prompt injection intro)

### SOC Analyst track (~60 lessons)
Log sources & formats · SIEM queries & dashboards · Alert triage methodology · Phishing analysis (headers, URLs, attachments) · Endpoint/EDR investigation · Network detection · Threat intelligence & IOCs · Incident response lifecycle (NIST) · Timeline building · Detection rules (Sigma, YARA basics) · AI-assisted triage & validating AI verdicts · Report writing & escalation · Capstone: SOC shift.

### Penetration Tester track (~70 lessons)
Methodology & scoping/legal · Recon & OSINT · Scanning & enumeration · Web app testing (OWASP Top 10 in depth) · Authentication attacks · Linux privilege escalation · Windows privilege escalation · Active Directory attacks · Pivoting & tunnelling concepts · Password cracking · Exploit research & modification · Pentest report writing · Capstone: full engagement.

### Cloud Security track (~55 lessons)
Cloud fundamentals & shared responsibility · IAM deep dive (policies, roles, least privilege) · Storage security · Network security in cloud (VPCs, security groups) · Logging & monitoring (CloudTrail-style logs) · Secrets & key management · Container & Kubernetes security basics · Cloud attack paths · CSPM & compliance · Incident response in cloud · Capstone: breach-and-fix.

---

## 7. Lab engine

All v1 labs run **client-side in the browser** against generated realistic data. No per-learner servers.

### 7.1 Lab types

| Type | Description | Key tech |
|---|---|---|
| `terminal` | Simulated Linux/Windows shell with a virtual filesystem, users, processes, network hosts. Supports a curated command set with realistic output. | xterm.js + TS command interpreter + virtual FS |
| `siem` | Log search console over thousands of events; query language; alert queue; dashboards | In-browser query engine (e.g. DuckDB-WASM or custom), generated datasets |
| `webapp` | Intentionally vulnerable mini web apps (shop, bank login, notes app) running sandboxed in-browser | Sandboxed iframe + mock backend (service worker / in-memory DB) |
| `cloud` | Mock cloud console: accounts, IAM users/roles/policies, buckets, instances, logs; policy evaluator | React UI + JSON state + policy evaluation engine |
| `packet` | Packet capture viewer (Wireshark-like) | Pre-generated pcap-like JSON |
| `report` | Structured report editor; AI grading vs rubric | Markdown editor + Handler grading |

### 7.2 Lab definition format

Each lab is a folder: `labs/<lab-id>/lab.yaml` + data/assets. Example:

```yaml
id: soc-phish-001
title: "Operation Bait — The CEO Email"
type: siem
track: soc
rank: 3
estimated_minutes: 25
briefing: briefing.md
dataset:
  generator: phishing_campaign      # seeded generator → unique per learner
  params: { noise_events: 5000, victims: 3 }
objectives:
  - id: o1
    prompt: "Which external IP sent the phishing emails?"
    check: { kind: flag, answer_from: generator.attacker_ip }
  - id: o2
    prompt: "Which user clicked the link?"
    check: { kind: flag, answer_from: generator.clicked_user }
hints:            # Handler escalates through these, never gives the answer outright
  o1: ["Start with email gateway logs.", "Filter on inbound mail with links.", "Group by sender IP."]
xp: 150
mitre: [T1566.002]
```

### 7.3 v2 real labs

Container-based real machines (Linux/Windows targets, cloud sandboxes) for advanced Pentest/Cloud labs and exams. Same `lab.yaml` objectives/checks interface, so v1 content is reused.

---

## 8. The Handler (AI tutor)

A chat panel in every lesson and lab, powered by the Claude API.

**Does:**
- Explains concepts again, simpler, with analogies; Hinglish on request.
- Gives **graduated hints** (uses the lab's hint ladder + learner's attempts); never reveals flags or exam answers.
- Grades reports against rubrics with line-level feedback.
- Answers "why" questions about the current lesson.

**Doesn't:**
- Help during track exams (disabled; exam mode).
- Answer off-platform offensive requests (scope-limited system prompt + ethical-use rules).

**Implementation notes:**
- Server-side route only (API key never in browser).
- Context = lesson content + lab state + attempt history (not the answer key; checks run server-side or with hashed answers).
- Cost control: smaller/faster model for hints and Q&A, larger model for report grading; per-user daily limits; cache common explanations.

---

## 9. Experience & theme

- **Visual direction (owner decision, 2026-10-06):** modelled on https://watchdogsfont.com — black pages, white text, near-white hero bands with huge black glitch headings, cyan `#0FBEFF` / purple `#C83CFF` / hot-pink `#FF1065` accents, blinking `_` cursor, typewriter text, snake_case headings, terminal-style panels, subtle scanlines.
- **Fonts:** "Hacked" by David Libeau (CC-BY; attribution on a /credits page and in the footer) for display headings and the wordmark; "Pixel Operator" for subheadings, buttons and labels; a readable sans for lesson prose and a monospace for terminals/code.
- **Limits:** no Ubisoft logos, DedSec symbol, game artwork, screenshots, character names, or the "Watch Dogs" name. The owner accepts the trade-dress risk of the overall look (see §13).
- Gamification: XP, ranks, achievements wall, daily streak, track progress map, profile card (shareable).
- Accessibility: reduced-motion mode, high-contrast toggle, readable font sizes; effects never block reading.
- Responsive: lessons fully usable on mobile; labs best on laptop (mobile shows a "best on desktop" notice for heavy labs).

---

## 10. Feature scope

### MVP (public launch)
- Auth (email + Google), profile, ethical-use agreement
- Course map: core + 3 tracks; locked "Coming soon" tracks
- Lesson reader (MDX), Terminal Checks, progress, XP, ranks, achievements, streaks
- Lab engine: `terminal`, `siem`, `packet`, `report` (SOC needs), then `webapp` (Pentest), `cloud` (Cloud)
- Handler chat + hints + report grading
- Rank challenges, SOC track exam, certificate + verification page
- Payments (Razorpay), free tier gating
- Admin: content publish status, user progress view, exam review queue

### Later
- Real container labs; proctoring; leaderboards; Hindi UI; mobile app; B2B dashboards for colleges/companies; job board & hiring-partner portal; more tracks.

---

## 11. Technical architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js (App Router) + TypeScript** | One codebase; Claude Code works well with it |
| Styling | Tailwind CSS + custom theme tokens | Fast, consistent hacker theme |
| Content | **MDX files in the repo** (`content/`) | Version-controlled, reviewable in PRs, easy for Claude to write |
| Database + auth | **Supabase (Postgres + Auth)** | Managed, cheap free tier, row-level security |
| AI | Claude API via server routes | Handler |
| Payments | Razorpay | India-first (UPI, cards) |
| Hosting | Vercel (app) + Supabase | Low ops for a solo founder |
| Testing | Vitest (unit), Playwright (e2e) | Lab engine + checks must be tested |

### 11.1 Repo structure

```
cyber-platform/
  CLAUDE.md
  docs/specs/            # this spec + future specs
  docs/plans/            # implementation plans per phase
  app/                   # Next.js routes (learn/, labs/, exam/, verify/, admin/)
  components/            # UI + theme components
  lib/
    lab-engine/          # terminal/, siem/, webapp/, cloud/, packet/, report/
    generators/          # seeded realistic data generators
    handler/             # AI tutor prompts + routes
    progress/            # XP, ranks, achievements
  content/
    core/rank-0/...      # MDX lessons
    tracks/soc/...
    tracks/pentest/...
    tracks/cloud/...
    coverage/            # objective → lesson mapping per track
  labs/<lab-id>/lab.yaml
  tests/
```

### 11.2 Data model (initial)

`users`, `profiles`, `enrollments(user, track)`, `lesson_progress(user, lesson_id, status, score)`, `lab_attempts(user, lab_id, seed, objectives_solved, hints_used)`, `xp_events`, `achievements`, `rank_challenges`, `exam_attempts(user, track, seed, status, report, grade)`, `certificates(id, user, track, issued_at)`, `subscriptions`, `handler_usage`.

Content (lessons, labs) lives in the repo, not the DB; DB stores only IDs + progress.

---

## 12. Monetization (to validate)

- **Free:** Rank 0 + Rank 1 of the core (hook + proves quality).
- **Pro:** full core + all tracks + Handler + labs — monthly and annual INR plans (indicative: ₹499/month or ₹3,999/year; validate with 20–30 target users before launch).
- **Exam fee:** track certification exam + one retake (indicative ₹2,999).
- Student discounts; later B2B college licences.
- **No "job guarantee" claims.** Publish real outcomes instead.

---

## 13. Legal, safety, compliance

- Original brand name and content (§4.3). Theme deliberately resembles the Watch Dogs-style look (§9); no Ubisoft assets or names are used. Risk: a trade-dress complaint could force a re-theme — keep all styling in theme tokens + `components/theme/` so a re-theme is a contained change. Font licences (Hacked CC-BY, Pixel Operator) kept in `public/fonts/LICENSES.md`.
- Labs only target simulated systems; never real third-party targets.
- Ethical-use agreement at signup; offensive lessons carry authorization/legal notes (IT Act 2000).
- User data handled per India's DPDP Act 2023: consent, minimal data, deletion on request, privacy policy.
- Terms of service, refund policy (required by Razorpay).

---

## 14. Roadmap

Timelines are rough for a solo founder working with Claude Code; adjust after Phase 1.

| Phase | Goal | Deliverables | Done when |
|---|---|---|---|
| **0. Foundation** (wk 1–2) | Project skeleton | Repo, Next.js + Supabase + Tailwind theme, auth, layout, CLAUDE.md, CI | A user can sign up and see the themed dashboard |
| **1. Learning engine + Rank 0** (wk 3–5) | One rank end-to-end | MDX lesson reader, Terminal Checks, progress/XP/ranks, `terminal` lab type, Rank 0 content + challenge | A new user completes Rank 0 fully in the browser |
| **2. Core complete + Handler** (wk 6–10) | Full shared core | Ranks 1–2 content, `packet` + `siem` (basic) labs, Handler (hints + Q&A), achievements/streaks | Closed beta: 30–50 testers complete the core; feedback collected |
| **3. SOC track** (wk 11–16) | First job track | Full SIEM console, `report` lab + AI grading, SOC content, SOC exam, certificate + verify page, coverage matrix | Beta testers pass the SOC exam; external reviewer sign-off |
| **4. Public launch** (wk 17–18) | Revenue | Razorpay, pricing gates, landing page, legal pages, admin review queue | Public launch: core + SOC live, other tracks "Coming soon" |
| **5. Pentest track** (wk 19–28) | Second track | `webapp` lab type, Pentest content, Pentest exam | Track live after reviewer sign-off |
| **6. Cloud track** (wk 29–36) | Third track | `cloud` lab type + policy engine, Cloud content, Cloud exam | Track live |
| **7. v2** | Scale | Real container labs, proctoring, more tracks (GRC, AI Security next), hiring partners | Ongoing |

**Local-first (owner decision, 2026-10-06):** Phases 0–1 run as a local website only — no Supabase, auth or deployment. A cookie-based local "operator" identity and JSON files in `.data/` stand in, behind the same store interfaces. Supabase Auth (email + Google), Postgres and Vercel deployment are added as the first step of Phase 2, before the closed beta.

**Per phase in Claude Code:** spec section → implementation plan (`docs/plans/`) → build with tests → review → merge.

---

## 15. Open decisions (owner to decide)

1. Final brand name + domain (must be original; check trademark & domain availability).
2. Pricing after validation interviews.
3. External expert reviewer(s) per track — budget and source.
4. Whether to also offer prep bundles for established certs (Security+, OSCP) alongside the platform's own cert.
5. Hinglish: Handler-only (v1) or full translated lessons (later)?
