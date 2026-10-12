# CyberBLADE Master Operational Backlog

**Generated:** 2026-10-12  
**Consolidation Pass:** P8–P10 Master Audit  
**Location:** `docs/ops/backlog.md`

---

## 1. Backlog Summary by Classification

| Category | Total Items | Fix in Pass (P8–P10) | Needs Owner Decision | Needs Infrastructure / Account |
| :--- | :---: | :---: | :---: | :---: |
| **P8 Learning Effectiveness** | 12 | 12 | 0 | 0 |
| **P9 Tests, CI, Deploy & Readiness** | 18 | 15 | 1 | 2 |
| **P10 Consolidation, Polish & Docs** | 10 | 10 | 0 | 0 |
| **Decisions Needed (from P5/P6/P7)** | 6 | 0 | 6 | 0 |
| **Deferred (from P5/P6/P7)** | 4 | 2 | 2 | 0 |
| **Needs Code / Logic Change** | 8 | 8 | 0 | 0 |
| **Text Fixes Needed** | 6 | 6 | 0 | 0 |
| **Unverified / SME Review** | 4 | 2 | 2 | 0 |
| **Total** | **68** | **55** | **11** | **2** |

---

## 2. Master Backlog Items

### Area A: Learning Effectiveness (P8 / Stage 1)
- [ ] **BL-01 (P8/1A): Check Question Authoring Position Bias**: 152/152 questions in source `.checks.yaml` have correct answer at index 0. Display shuffle hides this from learners, but source files are 100% biased.
- [ ] **BL-02 (P8/1A): Longest-Answer Bias**: 115/152 (75.7%) of questions have the longest option as the correct answer. Needs distractor rebalancing.
- [ ] **BL-03 (P8/1A): Cognitive Load Cliff**: Rank 1 Networking lessons average 2,100 words (~11 min), whereas Web Security averages 750 words (~3.8 min).
- [ ] **BL-04 (P8/1A): Prerequisite Friction (Lesson 2 vs Lesson 4)**: Lab `core-r0-files-lab-01` attached to Lesson 2 requires terminal navigation before Lesson 4 teaches terminal concepts.
- [ ] **BL-05 (P8/1A): Command Order Inversion**: `ss -tln` displayed in Lesson 7 before port listening is taught in Lesson 10; `Get-ItemProperty` in Lesson 23 before PowerShell syntax in Lesson 24.
- [ ] **BL-06 (P8/1B): Formative Feedback Distractor Rationales**: Check questions currently return generic explanations; need explicit per-distractor "why this is wrong" diagnostic feedback.
- [ ] **BL-07 (P8/1B): Near-Miss Nudges**: Terminal and packet labs give binary pass/fail without guiding near-misses (e.g. wrong directory, missing flag, inverted mask).
- [ ] **BL-08 (P8/1B): Lab Completion Debriefs**: Labs lack a post-completion "What you just did" synthesis (< 120 words real-world equivalent).
- [ ] **BL-09 (P8/1B): Productive Failure Interventions**: After 5 failed attempts, platform should offer lesson anchor review or Tier 1 Handler nudge.
- [ ] **BL-10 (P8/1C): Spaced Review Engine**: No spaced repetition system exists; implement deterministic SM-2 scheduler and daily interleaved review.
- [ ] **BL-11 (P8/1D): Next Best Action & Time Estimates**: Dashboard lacks intelligent, prioritized guidance (e.g., overdue review vs next lesson) and real duration labels.
- [ ] **BL-12 (P8/1E): Readiness Score Decay & Accuracy**: Readiness calculator does not account for recency or review accuracy; lacks property tests.

### Area B: Platform, CI/CD, Observability & Beta Readiness (P9 / Stage 2)
- [ ] **BL-13 (P9/2A): V8 Coverage Baseline & Flakiness**: Measure directory coverage, remove all test flakiness, eliminate silent test skips.
- [ ] **BL-14 (P9/2A): Mutation Testing**: Spot-check critical paths (XP, rank gating, validation) with manual mutation survivors analysis.
- [ ] **BL-15 (P9/2A): Post-Build Client Artifact Scan**: Build gate to ensure no secrets, service-role keys, or flag solutions leak into `.next/static`.
- [ ] **BL-16 (P9/2B): GitHub Actions Workflows**: Missing production `ci.yml`, `security.yml`, and `release.yml` with SHA-pinned actions.
- [ ] **BL-17 (P9/2B): CODEOWNERS & Branch Protection Guidelines**: Formalize review boundaries for security, identity, and migrations.
- [ ] **BL-18 (P9/2B): Typed Config & Fail-Fast Startup**: Prevent startup in production with missing Supabase credentials or local-store fallback.
- [ ] **BL-19 (P9/2B): Minimal Production Dockerfile & Compose**: Add non-root multi-stage containerization with healthcheck.
- [ ] **BL-20 (P9/2B): Feature Flag Subsystem**: Server-evaluated flags (`BETA_INVITE_ONLY`, `MAINTENANCE_MODE`, etc.) with coherent fallbacks.
- [ ] **BL-21 (P9/2C): Structured JSON Logging & Request IDs**: Add correlation IDs on error pages and strict redaction filters.
- [ ] **BL-22 (P9/2C): Encrypted Backup & Restore Rehearsal**: Backup scripts for hosted Postgres and JSON store; measure local RPO/RTO.
- [ ] **BL-23 (P9/2C): Load Test Harness (k6/autocannon)**: Benchmark at 25, 100, and 300 VUs to identify concurrency bottlenecks.
- [ ] **BL-24 (P9/2D): Hashed Invite-Only Beta Codes**: Migration, admin CLI, rate-limited redemption for closed beta cohort (20–100 learners).
- [ ] **BL-25 (P9/2D): In-App Feedback Widget & Content Bug Reporter**: Allow reporting confusing stems or lab glitches linked to content IDs.
- [ ] **BL-26 (P9/2D): /help & /changelog**: Operator support pages generated from markdown documentation.
- [ ] **BL-27 (P9/2D): SemVer & Deployment Smoke Script**: Automated smoke test asserting CSP, headers, routes, and cookie security.

### Area C: Consolidation, Polish & Truthfulness (P10 / Stage 3)
- [ ] **BL-28 (P10/3A): Dead Weight & Unused Code**: Clean up unused scripts, imports, and verify zero orphan routes.
- [ ] **BL-29 (P10/3A): Cross-Pass Regressions**: Verify CSP compatibility with all newly added UI routes, review screens, and dialogs.
- [ ] **BL-30 (P10/3B): Dynamic Manifest Generator (`npm run report:manifest`)**: Build `docs/MANIFEST.md` computing live lesson, lab, question, and test counts.
- [ ] **BL-31 (P10/3B): Claim & Tone Audit**: Purge any exaggerations ("certified", "guaranteed pass", "100% secure") across all copy.
- [ ] **BL-32 (P10/3B): Credits & License Alignment**: Ensure `/credits` and `LICENSES.md` exactly mirror `package.json` dependencies.
- [ ] **BL-33 (P10/3C): Documentation Consistency**: Align `README.md`, `CLAUDE.md`, and `docs/` with the final codebase.
- [ ] **BL-34 (P10/3C): Clean-Clone Rehearsal**: Clone to a clean temp directory and record time to first running app.
- [ ] **BL-35 (P10/3C): Decisions Document (`docs/ops/decisions.md`)**: Comprehensive documentation of all product, legal, and operational options.

### Area D: Decisions Needed (Owner / Legal Review)
- [ ] **BL-36 (Decisions): Challenge Accommodation Mode**: Add an optional extended-time (1.5x / 2x) or untimed setting for accessible learners.
- [ ] **BL-37 (Decisions): Anonymous Progress Transition**: Policy for whether guest local progress merges into Supabase on OAuth sign-up.
- [ ] **BL-38 (Decisions): Legal Review of Ethical Charter**: Verify summary wording on `/legal/ethical-use` with legal counsel.
- [ ] **BL-39 (Decisions): Hosting Strategy**: Choose between Managed Next.js (Vercel/Cloudflare) vs Containerized Node VPS (Hetzner/DigitalOcean) for India latency.
- [ ] **BL-40 (Decisions): AI Spend Daily Kill Switch Limit**: Define hard currency threshold (e.g. $5/day) for automated heuristic fallback.
- [ ] **BL-41 (Decisions): Beta Cohort Onboarding Caps**: Set hard ceiling on initial active invite redemptions (20 vs 100).

### Area E: Deferred Items
- [ ] **BL-42 (Deferred): Service Worker / Full Offline Lab Cache**: Explicitly deferred to avoid stale cache of authenticated progress and dynamic simulation state.
- [ ] **BL-43 (Deferred): External Font CDNs & Runtime Trackers**: Banned under P5/P7 privacy and self-hosting constraints.
- [ ] **BL-44 (Deferred): Real Hosted Supabase Migration Execution**: Executed locally on ephemeral SQLite/Postgres or local test instance; hosted run deferred to production deploy.
- [ ] **BL-45 (Deferred): Live SMS/OTP & Email Notifications**: Intentionally excluded to avoid dark patterns, spam, and third-party SMS vendor costs.
