# CyberBLADE Ops Progress Log

**Branch:** `main`  
**Pass:** P8–P10 (Learning Effectiveness, Ship Readiness, Consolidation & Polish)  
**Status:** In Progress — Stage 2 (Ship Readiness)

---

## Stage Tracking Overview

| Stage | Part | Description | Status | Commits | Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Stage 1** | **1A** | Learning Audit & Baseline Metrics | ✅ Complete | Pending | Computed load table, question bias, prereqs |
| **Stage 1** | **1B** | Feedback Quality (Rationales, Debriefs, Nudges) | ✅ Complete | Pending | Distractor rationales, near-misses, debriefs |
| **Stage 1** | **1C** | Retrieval Practice & Spaced Review (SM-2, Daily Review) | ✅ Complete | Pending | Scheduler, flashcards, DB migrations |
| **Stage 1** | **1D** | Pacing, Progress & Motivation (Next Action, Mastery, Streaks) | ✅ Complete | Pending | Streak grace, timezone fix, XP simulation |
| **Stage 1** | **1E** | Readiness Accuracy & Analytics (Bugs, Decay, Telemetry) | ✅ Complete | Pending | Non-linear decay, exam self-report |
| **Stage 1** | **1F** | Stage 1 Tests & Verification | ✅ Complete | `27ecd02` | Flashcard integrity, mastery, PII sanitization, learner journey sim |
| **Stage 2** | **2A** | Test Suite Health (Mutation, Flakiness, Hermetic E2E) | ⏳ Next | — | Coverage per dir, artifact scan |
| **Stage 2** | **2B** | CI/CD, Environments & Feature Flags | ⬜ Pending | — | GitHub Actions, typed config, Dockerfile |
| **Stage 2** | **2C** | Observability, Backup, Resilience & Load Testing | ⬜ Pending | — | Redaction, restore rehearsal, load harness |
| **Stage 2** | **2D** | Beta Mechanisms (Invite Codes, Feedback Widget, Rollout) | ⬜ Pending | — | Hashed codes, rate limits, /help |
| **Stage 3** | **3A** | Triage, Master Backlog & Cross-Pass Regression Fixes | ⬜ Pending | — | Backlog closure, dead code removal |
| **Stage 3** | **3B** | Truthfulness Audit & Dynamic Manifest Report | ⬜ Pending | — | `report:manifest`, claim cleanup |
| **Stage 3** | **3C** | Docs, Fresh-Clone Rehearsal & Final Verification | ⬜ Pending | — | Decisions doc, full test gates |

---

## Log Entries

### Entry 1: Part 1A Completed (Learning Audit & Baseline Findings)
- Audited all 38 lessons and 20 labs on disk.
- Identified 100% position bias in authoring (152/152 correct answers at index 0 in `.checks.yaml`).
- Identified 75.7% longest-answer bias (115/152 questions).
- Measured reading times: Rank 1 Networking is a cognitive wall (2,000–2,242 words; 10–11 min reading), dropping to ~1,300 words in Linux/Windows and ~700 words in Web Security.
- Discovered 4 key prerequisite sequencing issues (e.g., Lesson 2 terminal lab before Lesson 4 terminal fundamentals).
- Created master backlog in `docs/ops/backlog.md`.

### Entry 2: Part 1B Completed (Feedback Quality, Nudges, Debriefs, Productive Failure)
- Upgraded check schema to support optional per-distractor `rationale`, and enhanced `gradeCheck` to return right vs distractor why explanations.
- Built deterministic `detectNearMiss` in `lib/lab-engine/nudges.ts` diagnosing casing mismatches, extra whitespace, missing flags, CIDR format, and file extensions.
- Authored 20 synthesis debriefs (< 120 words) in `lib/content/debriefs.ts` detailing Core Concept, Real-World relevance, Common Mistake, and Go Further drill.
- Created `LabDebriefCard` component and integrated near-miss feedback into `ObjectivesPanel` and `LabWorkspace`.
- Implemented productive-failure intervention in `TerminalCheck.tsx` after 5 failed attempts (offering briefing review, Handler hint, or break).
- 1092 tests passing across all suites.

### Entry 3: Part 1C Completed (Spaced Repetition SM-2 & Daily Review Engine)
- Implemented deterministic SM-2 spaced repetition scheduler in `lib/review/scheduler.ts` (ease factor calculation, intervals 1 -> 6 -> round(prev * EF), lapse reset, clamped EF >= 1.3).
- Authored curated flashcard library in `lib/review/flashcards.ts` spanning Linux, Network, Windows, Web, and Defense concepts.
- Built interleaved queue builder in `lib/review/session.ts` with round-robin cross-category diversity, daily new-card cap (5), and daily XP cap (50 XP).
- Created additive Supabase migration `20261012000000_p8_learning_effectiveness.sql` (`review_items`, `review_events`, `learning_events`, `exam_reports`) with owner-only RLS and rollback instructions.
- Implemented complete JSON store fallback in `StoreProgressRepo` and wired `SupabaseProgressRepo`.
- Built accessible Daily Review screen at `app/(app)/review/page.tsx` and `components/review/DailyReviewSession.tsx` with ARIA live announcements, keyboard navigation (Space/Enter + 1/2/3/4), and added `/review` to primary navigation.
- 15 unit tests added and passing across scheduler, queue builder, and review store methods.

### Entry 4: Part 1D Completed (Next Best Action, Mastery Map & Streak Grace)
- Built deterministic `getNextBestAction` engine in `lib/progress/next-action.ts` prioritizing: (1) Due spaced reviews (prevent memory decay) -> (2) Retry failed labs -> (3) Resume/start lessons in rank order -> (4) Rank challenge certification -> (5) All complete.
- Upgraded streak engine in `lib/gamification/streaks.ts`: calendar-day date math immune to DST transitions (23h/25h shifts), timezone offset support, and rolling weekly grace freeze.
- Implemented `MasteryMapWidget` and `computeMasteryOverview` in `lib/progress/mastery.ts` classifying competencies into Solid, Developing, and Needs Review.
- Integrated Next Best Action strip and Mastery Map directly into `/dashboard`.
- Ran XP economy simulation (`scripts/simulate-xp-economy.mts`):
  | Persona | Study Time | Rank 1 Days | Rank 2 Days | Full Completion | Total XP |
  | :--- | :---: | :---: | :---: | :---: | :---: |
  | Fast / Accelerated | 75 min/day | 3 days | 9 days | 14 days | 3,850 XP |
  | Average / Consistent | 35 min/day | 7 days | 25 days | 39 days | 4,720 XP |
  | Casual / Slower | 15 min/day | 19 days | 70 days | 110 days | 5,925 XP |
- All tests passing.

### Entry 5: Part 1E Completed (Readiness Accuracy, Memory Decay & Telemetry Report)
- Upgraded `calculateReadinessSync` in `lib/readiness/calculator.ts` with recency decay: applies exponential decay `exp(-0.02 * (days - 14))` when inactive > 14 days, with property tests guaranteeing [0, 100] bounds.
- Added explicit legal disclaimer banner `READINESS_DISCLAIMER` across all readiness readouts clarifying scores are activity estimates, not accredited exam guarantees.
- Built privacy-preserving telemetry logger in `lib/analytics/learning-events.ts` strictly redacting PII, tokens, and IPs.
- Created `ExamReportDialog` in `components/exam/ExamReportDialog.tsx` and `submitExamReportAction` in `app/(app)/exam/actions.ts` allowing voluntary real-world certification self-reporting.
- Implemented `scripts/learning-analytics-report.mts` (`npm run report:learning`) producing aggregated curriculum, lab, SM-2, and exam statistics.

### Entry 6: Part 1F Completed (Stage 1 Tests & Verification)
- Created `tests/unit/lib/review/flashcards.test.ts` — 11 tests verifying flashcard library integrity (unique IDs, valid categories/ranks, well-formed question format, helper functions).
- Created `tests/unit/lib/progress/mastery.test.ts` — 7 tests verifying mastery overview computation (solid/developing/needs_review classification, lapse detection, overdue detection, mixed-state aggregation).
- Created `tests/unit/lib/analytics/learning-events.test.ts` — 10 tests covering PII sanitization (top-level, nested, case-insensitive key stripping) and simulated multi-session learner journeys (SM-2 progression, lapse recovery, EF convergence, queue mixing, rating helpers).
- Total test count: 146 test files, 1144 tests passing (28 new tests in this part).
- TypeScript typecheck clean (exit code 0).
- **Stage 1 COMPLETE**: All 6 parts (1A–1F) verified, committed, and documented.

---

### Entry 7: Phase 3 Prompt 6 Completed (SOC Incident Report System & Versioned Grading Engine)
- **Part A (Data Model & Schema)**: Implemented complete Zod and TypeScript schemas in `lib/lab-engine/soc/reports/types.ts` (`SocReportData`, `SocReportGroundTruth`, `RubricDefinition`, `GradingResult`, `ScoringConfig`, `PreSubmitLintResult`, `TimelineRowData`, `IocRowData`).
- **Part B (Deterministic Grader Engine)**: Implemented `lib/lab-engine/soc/report-engine.ts` with pure deterministic grading function `gradeReport()` completing in < 150ms. Supported versioned criteria (`incident-report-l1`, `v1.0.0`), anti-gaming heuristics (padding penalties, fabrication deductions, contradiction detections, copy-paste dump detection, and inert LLM prompt injection guards).
- **Part C (Regrading CLI Tool)**: Implemented `scripts/soc-regrade.mts` and registered `npm run soc:regrade` supporting batch historical regrading, `--dry-run`, `--apply`, and `--fixtures` verification mode.
- **Part D (Ground Truth Synthesis)**: Implemented `synthesizeReportGroundTruth` in `lib/lab-engine/soc/generator.ts` ensuring procedural scenario variants dynamically synthesize realistic ground truth milestones, IoC sets, and containment action recommendations.
- **Part E (Database Migration & Hardening)**: Created `supabase/migrations/20261013200000_phase_3_soc_report_engine.sql` adding `soc_report_submissions` and `soc_report_evaluations` tables with strict owner-only RLS, immutable submitted states, and hardened `SECURITY DEFINER` function with pinned `search_path = public, pg_temp`.
- **Part F (Report Editor UI)**: Built complete modular React suite in `components/labs/soc/reports/`:
  - `ReportEditor.tsx` & `SocReportWorkspace.tsx`: Main workspace routing and editor state.
  - `SectionOutline.tsx`: Collapsible 7-section progression checklist.
  - `IocTableEditor.tsx`: Defanging toggle, indicator role selector, and notes.
  - `TimelineEditor.tsx`: Chronological milestone tracker with ascending sorter.
  - `EvidencePickerDrawer.tsx`: Direct linking to investigated alerts/telemetry.
  - `PreSubmitLintModal.tsx`: Zero-oracle format and evidence validator.
  - `GradedResultsScorecard.tsx`: 100-point rubric breakdown and anti-gaming flags.
  - `ModelReportComparison.tsx`: Post-submission side-by-side comparison with senior analyst model report.
  - `ReportExport.tsx`: Markdown and raw export utility.
  - Integrated into `SocWorkspace.tsx` with dedicated tab in desktop header and mobile navigation. Passed WCAG AA design guard.
- **Part G (Server Actions)**: Added secure server actions in `app/(app)/labs/soc/actions.ts`: `saveSocReportDraftAction`, `submitSocReportAction`, `getSocReportDraftAction`, `getSocReportResultAction`, and `getSocReportModelRevealAction`.
- **Part H (Verification & Testing)**:
  - `lib/lab-engine/soc/reports/fixtures.ts`: Synthetic fixtures at 9 controlled quality tiers (`excellent`, `good`, `mediocre`, `poor`, `padded`, `fabricated`, `copy-paste`, `template-only`, `injection-laced`).
  - `tests/unit/lib/lab-engine/soc/report-monotonicity.test.ts`: 1,000-seed monotonicity test proving strict scoring invariants (`excellent >= good > mediocre > poor`, `padded < 70`, `fabricated <= 50`, `template-only < 40`, `injection <= poor`).
  - `tests/unit/lib/lab-engine/soc/report-planted-flaws.test.ts`: 5 planted flaw tests confirming grader breaks when deliberately corrupted.
  - `tests/unit/lib/lab-engine/soc/report-no-oracle.test.ts`: Statistical zero-oracle proof verifying disposition invariance, identical fake vs real IoC lint outputs, < 1.5ms execution timing delta, and clean error contracts.
  - `tests/security/soc-report-security.test.ts`: 10 adversarial security tests covering unauthenticated access, IDOR protection, input sanitization, one-shot replay, race conditions, ground truth secrecy, and SQL `SECURITY DEFINER` auditing.
  - `tests/e2e/soc-report.spec.ts`: End-to-end Playwright test covering drafting, linting, submitting, scorecard inspection, model comparison, and automated Axe accessibility analysis.
- **Part I (Documentation)**: Authored `docs/dev/soc-report-grading.md`, `docs/dev/writing-soc-report-truth.md`, and updated `docs/dev/soc-practitioner-review.md` and `docs/design/soc-workspace.md`.

---

### Entry 8: Phase 3 Prompt 7 — AI-assisted grading (complete; default OFF, NOT calibrated)
Standing rules saved to `docs/ops/standing-rules.md`. Audit and corrections in `docs/ops/handoff-status.md` (adds S7 critical: question truths verified client-side; S8 fixed).

**Step 0 (done, `33305f5`):** lint gate fixed (46 errors → 0); typing exposed and fixed broken Explain-query AST reads; `/labs/soc/[id]` now serves shift/family labs (was 404); triage decisions on generated attempts fixed (regression test); SOC e2e 16/16 after selector/a11y fixes (labelled lookup input, 24px mobile targets). Known flake: `rank-2-web` capstone times out under full-suite load, passes alone.

| Part | Scope | Status | Commit |
| :--- | :--- | :---: | :--- |
| A | Design brief, AI rubric (6 criteria, original bands + synthetic anchors), prompts p1, config | ✅ | `8cd12c7`, `4abb838` |
| B | Handler provider `complete()` (no heuristic fallback, usage, JSON mode); Handler tests unchanged (139) + 7 new | ✅ | `b6eb5ba` |
| C | Boundary, sanitizer/PII, pre-filter, injection signals, prompt builder, output validation, aggregation, feedback tone filter, gradeCriterion, mocks; 63 unit tests | ✅ | `78d00c5` |
| D | Stores (local/Supabase), migration (7 tables, NOT executed), job pipeline, quotas/ceiling/kill switch, gate enforcement, score composition, sentinel deny-list (mutation-checked); corrected prompt-6 SQL audit test (S4) | ✅ | `1225980`, `b1efeee` |
| E | 113-case injection corpus; vs obedient mock: 0 counted elevations, 113/113 detected (corpus NOT held-out: first run found 7 bypasses, fixed by general rules); susceptibility metric fails injectable models | ✅ | `6e7cb7f` |
| F | Metrics (known answers incl. Krippendorff 2011, Shrout-Fleiss), consent-gated packets, fairness pairs (4 planted-flaw mocks fail), gate eval (empty sign-off), drift, review accept/override, CLIs, guarded real-provider script | ✅ | `0016759` |
| G | Server actions, learner UI (status chips, verified spans, review request, consent, How-AI-works panel), design evidence log (`docs/design/evidence/soc-ai-feedback.md`, screenshots outside repo), 390px overflow + table keyboard-scroll fixes | ✅ | `a12649c` |
| H | Export/erasure, adversarial action tests, operator guide, full gates green | ✅ | `9774696`, `ba95502` |

**Prompt 7 final gates (2026-10-14):** lint 0 errors · typecheck ✓ · check:content ✓ · check:soc ✓ · unit 1562/1562 · security 142/142 · build ✓ · e2e 125 passed / 0 failed / 23 intentional per-viewport skips.

**Not done / open:** migration not executed against a database (no Postgres available; PGlite would need a dependency install); no real-provider run (tests mock only); no human calibration data; S1–S3, S5–S7 from `handoff-status.md` still open (S4 fixed here; S8 fixed in Step 0).

**Human verification list (owner):** recruit 2–3 pseudonymous graders and score 60+ opted-in reports; run `npm run soc:ai:eval-real` and read 20+ outputs; try your own injections (incl. Hinglish); spot-check paired dialect outputs; confirm Groq/Gemini data-retention terms before any learner text is sent; review the gate file numbers before signing; confirm the UI copy reads well on a real Android phone.

### Entry 9: Security closure S1–S7 (2026-10-14)
All seven audit findings closed; see `docs/ops/handoff-status.md` §8 for commits and regression tests. New: `tests/db` (PGlite, Supabase-like roles, all migrations executed locally, 55 two-user checks), `npm run scan:bundle` (post-build leak gate, in CI), live e2e response leak check. Latent fix found on the way: the server query pipeline used the FIRST event as "now", hiding most events from server-side queries.

### Entry 10: Prompt A — SOC L1 curriculum, Parts 1–2 (pilots) — STOPPED for owner approval (2026-10-14)
Plan: `docs/design/soc-curriculum.md` (`26b8b2e`). Two pilot lessons to the full L1 standard under `content/tracks/soc/l1/` — the triage loop (conceptual) and email header analysis (hands-on) — each with a diagram, a server-checked micro-exercise, 5 checks with per-option rationales, flashcards and practice links. Owner guide: `docs/ops/pilot-lesson-review.md`; claims log: `docs/ops/soc-curriculum-claims.md`; design evidence: `docs/design/evidence/soc-curriculum-lessons.md` (screenshots outside the repo in `D:\CYBER-PLATFORM-evidence\soc-curriculum\`).

Built:
- **Reader components:** MicroExercise (server action, answer keys never sent), FlowDiagram, LogBlock, KeyTerms and PracticeThis.
- **SOC L1 linter** (`lib/content/soc-lesson-lint.ts`): template, generator-vocabulary leak scan, reserved IPs and domains, cert names and hype, computed time, prerequisite graph, coverage (`content/coverage/soc.yaml`) and generated track flashcards (category `soc`).
- **Bundle leak rule** `exercise-keys`.

Fixes on the way:
- Rank promotion now counts core lessons only.
- 390 px fieldset overflow.
- Two pre-existing reader contrast failures (`LessonNav`, `TableOfContents`).

**Gates (2026-10-14):** lint 0 errors · typecheck ✓ · check:content ✓ (2 warnings: pilots are 19 and 21 min, over the 15-min split threshold) · check:soc ✓ · unit 1678/1678 · security 158/158 · build ✓ · scan:bundle ✓ · e2e 137 passed / 1 failed / 24 skipped. The failure is the known `rank-2-web` capstone load flake; it passes alone (2/2).

**Next:** Part 4 (remaining ~40 lessons, track pages, glossary page, practice paths, module checkpoints) ONLY after owner approval of the pilots.

### Entry 11: Prompt A Part 4 — remaining SOC L1 modules (in progress)
Owner approved the pilots on 2026-10-14. The owner's pilot-feedback field was left as the template placeholder, so it was treated as "none".

Decisions applied:
- Lessons may run up to about 20 min; over 25 min fails the linter.
- New additive drill page `/practice/drills` (`3361fe0`).
- Focusable lesson tables, and a Rank 0–3 promotion test (`1f83482`).

Prerequisite changes from the plan: the plan's Rank 2 core prerequisites for lessons 9, 26 and 31 would be unreachable at the track gate (Rank 1), so they are replaced with Rank 0–1 core lessons, as each module lands.

| Module | Lessons | check:content | Targeted tests | Commit |
|---|---|---|---|---|
| M1 SOC foundations | soc-roles, alert-lifecycle, data-handling | ✓ | content + review 106/106 | `8c14f8d` |
| M2 Alert triage | alert-anatomy, prioritisation, dispositions, rationale-escalation (+ pilot triage-loop now depends on alert-anatomy) | ✓ | content + review 107/107 | `f30f131`, fix `e2c3c3c` (card fronts; linter rule added) |
| M3 Detection | attack-stages, attack-vocabulary, detection-blind-spots | ✓ | content + review 107/107 | `380c367` |
| M4 Phishing and email | how-email-travels, links-attachments, phishing-response (+ pilot email-headers now depends on how-email-travels) | ✓ | content + review 107/107 | `99b2e17` |
| M5 Network evidence | flow-vs-packet, dns-http-tls, beacon-scan-egress, proxy-firewall-logs (drill targets remapped to what each drill practises; see plan) | ✓ | content + review + drill-check 116/116 | `f708b55` |
| M6 Windows and Linux telemetry | windows-auth-events, process-creation, persistence, timelines-trees, lotl, linux-telemetry | ✓ | content + review 107/107 | `5ed8d89` |
| M7 Web and identity | web-logs (Rank 1 prereqs replace core-r2), credential-attacks, impossible-travel-mfa, cloud-logs | ✓ | content + review 107/107 | `489814a` |
| M8 Malware and intel | malware-behaviour, reputation (teaches hashing itself; Rank 0 prereq replaces core-r2), enrichment-workflow | ✓ | content + review 107/107 | `e201c8d` |
| M9 SIEM | thinking-in-queries, stats-timechart, sessions-correlation, hunting (every lesson query is executed by a new snippet test; drill links verified) | ✓ | content + review + snippets 125/125 | `2de3d36` |
| M10 Tier-1 incident response | ir-lifecycle, evidence-handoff | ✓ | content + review 125/125 | `aec57a8` |
| M11 Reporting | report-anatomy, report-summaries (craft only; no grading specifics) | ✓ | content + review 125/125 | `0fa2b49` |
| M12 Working the shift | queue-handover, judgment-career (all 42 lessons written; every skill has ≥1 lesson) | ✓ | content + review 125/125 | `0352a8b` |
| Track build | landing, module pages + checkpoints, glossary + first-use tooltips, practice paths, core-page card | ✓ | unit 9/9, e2e track 10/10, all-lessons sweep 2/2 | `c91da33`, `4cf622b` |

**Prompt A complete (2026-10-15).**
- **Content:** 42 lessons in 12 modules, 664 computed minutes, about 56,600 words, 210 checks, 42 micro-exercises (140 questions), 169 track flashcards, a 189-term glossary, 17 tested BladeQL snippets, 4 practice paths, and 12 module checkpoints.
- **Final gates:** lint 0 errors (51 warnings) · typecheck ✓ · check:content ✓ · check:soc ✓ · unit 1728/1728 · security 159/159 · build ✓ · scan:bundle ✓ (76 artefacts) · e2e 153 passed / 1 failed / 24 skipped.
- **The one e2e failure:** `soc-enrichment` timed out after 5 s under full-suite load and passes alone (2/2). This is a new entry on the load-flake list; it is not touched by this work.
- **Open owner decisions:** see the final report.

### Entry 12: Stage 1 (exam mode, results, readiness, Handler SOC mode) — complete
Design: `docs/design/soc-exams.md`. All exam numbers are provisional (`content/soc/exams/*.yaml`).
Pre-stage check (2026-10-15): build ✓, scan:bundle ✓ (76 artefacts).

| Part | Scope | Tests | Commit |
|---|---|---|---|
| 1 Data layer | exam attempts, answers, outcome self-reports, accommodations; migration 20261015120000 (NOT executed on a hosted DB; executed on PGlite); RLS read-only learner access, no seed column; one active exam per learner; atomic start function; answers frozen after submit; erasure + allowlisted export; local-store parity; flags SOC_EXAMS_ENABLED and SOC_HANDLER_ENABLED | db 77/77, progress + export 84/84 | `d6176ad` |
| 2 Exam service | start (accommodation multiplier, least-used variant, non-repeating seed per learner+format, unseen-first knowledge draw), server deadline with auto-submit on next touch, guards in existing entry points (exam attempts only: deadline, budgets with in-flight reservation, no marking or debriefs, report and model reveal after exam submit, no practice submit/abandon/start of exam attempts), idempotent finalize with XP once (`soc_exam:<id>`, score ≥ 50), knowledge bank 32 items (claims K1–K22, all certain; alignment UNVERIFIED) + content-gate checks, exam actions behind SOC_EXAMS_ENABLED | exam 15/15; soc + security + progress 622/622 | `0481f5c` |
| 3 Results + readiness | pure result builder (components with not-graded weight sharing, per-skill by alert source/questions/report/handoff/knowledge, decision quality, time analysis, thoroughness, report graded/not-graded breakdown, informational integrity flags, budgets), trend, study plan (lessons, due reviews, practice; drills hidden when SOC_QUERY_ENABLED is off; mini-queue link), provisional gate (exact wording, every unmet criterion listed), consented owner-only outcome self-report (generic families, never changes scores), offline `npm run soc:exam-calibration` | exam 45/45 (fixtures, 15-row gate table, calibration, study plan, outcomes) | `f6a2d0c` |
| 4 Handler SOC mode | server-side context provider (learner-visible alert fields + own decisions, searches, lookups, report excerpt; no ground truth), input guard with Socratic redirects (verdict, report/answer grading, IOC lists, answer-seeking, "exam is over"; EN + Hinglish) without a model call, output guard overriding verdict assertions, untrusted-data wrapping with forged-tag stripping, server-counted hint tiers, exam lockout in the SOC action and in the general Handler action; `askSocHandlerAction` behind SOC_HANDLER_ENABLED; mocked providers only | handler 197/197 (51 new: 24 attacks, 9 output leaks, 2 injection, 12 over-refusal, 4 context/tier/lockout) + actions 4/4 | `f1c2566` |
| 5 UI | lobby (rules in plain words, unproctored disclaimer, scoring, limits, history), exam page (server-synced timer HUD with text warnings + announce button, knowledge form, handoff note, workspace exam mode, native dialog confirmations), results, own review, readiness + study plan + trend + outcome form; labs entry link; e2e flags set in playwright config; evidence log `docs/design/evidence/soc-exams.md`, screenshots outside repo | e2e soc-exams 4/4 (desktop + mobile, keyboard only, axe) | `d5a6779` |
| 6 Admin + scan | `npm run soc:exam-accommodation` (multiplier 1–3, 1 = off, default off; local store or `--hosted` service role; JSON-lines audit in `<data>/audit/`), bundle scan rule `exam-keys` (bank loader, graders, review keys, readiness/result builders) with planted fixture | exam + bundle-scan 62/62 | `bbd603f` |
nFull gates (2026-10-15, after `efcad35`): lint ✓ (0 errors, 51 pre-existing warnings), typecheck ✓, check:content ✓, check:soc ✓, test ✓ 1865/1865, test:security ✓ 161/161, build ✓, scan:bundle ✓ (79 artefacts, no leaks), test:e2e ✓ 158 passed / 24 skipped. Migration 20261015120000 executed on PGlite only, NOT on any hosted project.

### Entry 13: L1 independent audit and fix pass (2026-10-15)
Audit (cold, by a separate read-only agent): `docs/ops/l1-audit.md`, 25 findings (2 Critical, 4 High, 9 Medium, 8 Low, 2 Info). Resolution table at the end of that file.
Fixed: both Critical, 3 of 4 High fully and L1-A-09 in part (indicator values; the rule-name -> verdict mapping is deferred as content work), 8 of 9 Medium (L1-A-14 nonce CSP deferred: needs site-wide dynamic rendering), 3 Low + both Info. Each fix has a regression test.
New migration `20261015180000_phase_3_soc_l1_audit_fixes.sql` (privileges only; executed on PGlite, NOT on any hosted project).
Generator 1.1.0 (IOC balancing) and 1.2.0 (per-seed indicator values); existing attempts stay pinned to their version; published content pinned in `content/soc/published-hashes.json` (`npm run soc:pin-hashes`).
Test isolation: vitest uses a throwaway data dir per worker (Handler tests had been writing into `.data/handler-usage.json`).
Note: Stage 1 commit hashes cited in Entry 12 were rewritten outside this session (same messages, new hashes; see `git log`).
Full gates after `8d54b30`: lint ✓ (0 errors, 53 warnings), typecheck ✓, check:content ✓, check:soc ✓ (scenario + 9 families + 4 shifts), test ✓ 1965/1965, test:security ✓ 180/180, build ✓, scan:bundle ✓ (79 artefacts), test:e2e ✓ 158 passed / 24 skipped.
