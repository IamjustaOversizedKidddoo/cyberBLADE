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

### Entry 14: L2 prompt, interrupted by the owner after the quick fixes (2026-10-16)
Done and committed: (a) 10-minute drill uses beginner family queues (`cca2fd1`); (b) evidence screenshots untracked (`d632370`); (c) `docs/ops/decisions.md` with the accepted L1 audit decisions, accommodation capped at x2 (`31f2c11`).
Not started: Part A plan (`docs/design/soc-l2.md`), Part B pilot lessons. Design notes gathered for later: rule-name twins need versioned family snapshots so old attempts keep loading their pinned family version (today `loadSocFamily` reads only the current YAML).

### Entry 15: Closed-beta production readiness (Vercel + Supabase) (2026-10-16)
Goal: make the application production-ready and safe to deploy for an invite-only closed beta (20–100 learners) on Vercel with hosted Supabase. No external deployment was run; all verification done locally with PGlite and Playwright.

Scope completed across the 10 requirements:
1. **Hosted-only in production:** Typed runtime config validation (`lib/config/runtime-config.ts`) failing fast on startup with specific messages for missing/invalid server and public vars; refuses local-JSON-store mode in production or on Vercel; `.env.example` updated and verified.
2. **Serverless-safe rate limits:** Pluggable rate limiter backend (`lib/security/rate-limit.ts`) backed by Postgres table `rate_limit_buckets` and atomic stored procedure `rate_limit_hit()` in `supabase/migrations/20261016120000_beta_hardening.sql`; fail-closed behavior; in-memory backend preserved for local dev.
3. **Background jobs:** Idempotent cron routes (`/api/cron/cleanup`, `/api/cron/ai-grading`) protected by `CRON_SECRET` with constant-time comparison, rate-limited, time-boxed; `vercel.json` configured with Hobby-compatible daily crons; AI grading off by default.
4. **Beta access & feedback:** Invite-only signups behind `BETA_INVITE_ONLY` with hashed limited-use codes, uniform timing errors, audit logging, and admin CLI (`npm run beta:invites`); timestamped beta notice acknowledgement; accessible feedback widget in app shell (`FeedbackDialog`) plus "report a problem" on checks, exam questions, and scenarios; grouped feedback export CLI (`npm run beta:feedback`); `/help` page and account deletion/export extended to all beta tables.
5. **Beta flags & maintenance:** Tested flag set (`BETA_INVITE_ONLY=true`, `SOC_L2=false`, `AI_GRADING=false`, etc.); `MAINTENANCE_MODE` returns 503 + Retry-After (health route exempt); `noindex` header, robots.txt, and empty sitemap during beta.
6. **Observability:** Structured JSON logger with request IDs, error page references (`Reference: <digest>`); redaction of tokens, cookies, emails, IPs, flags, and model outputs; `ErrorReporter` interface with no-op default and scrubbed Sentry adapter; `/api/health` and `/api/ready` with minimal rate-limited outputs; daily spend summary script (`npm run ops:daily`).
7. **Backups & recovery:** Encrypted logical backup script (`npm run db:backup` via `pg_dump`, AES-256-GCM + gzip, SHA-256 manifest); Docker-free restore checker (`npm run db:restore-check`) loading into throwaway PGlite with RLS and isolation probes (~4 s for 100 learners); provider backup terms documented.
8. **Staging verification & smoke:** `npm run staging:verify` (two throwaway users; cross-user read/write refusal on all 36 learner tables, immutable scores/grades/XP/seeds, unmarked active exams, clean deletion); `npm run smoke -- <baseUrl>` (~20 read-only requests: health, ready, security headers, noindex, sign-in, public lessons, 404 leakage checks).
9. **Preview/prod hygiene & deploy guide:** Comprehensive manual guide in `docs/ops/deploy-vercel.md` with verified limits, dependency order, rollback procedures, kill switches, and incident runbooks.
10. **Bundle security:** `scripts/scan-client-bundle.mts` updated with `secretValueRules` to ensure server-only secret values are never included in static or client bundles.

Full gates (2026-10-16):
- lint ✓ (0 errors, 53 pre-existing warnings)
- typecheck ✓
- check:content ✓ (80 lessons, 34 labs, 27 objectives)
- check:soc ✓ (1 scenario, 9 families with 50 seeds, 4 shifts with 50 seeds)
- test ✓ 2078/2078
- test:security ✓ 256/256
- test:db ✓ 101/101 (PGlite)
- build ✓ (Next.js Turbopack)
- scan:bundle ✓ (88 client artifacts, 0 leaks across 11 pattern rules and secret values)
- test:e2e ✓ (20 passed, 2 skipped: onboarding, terminal lab, knowledge & scenario exams, feedback widget)
- Migration `20261016120000_beta_hardening.sql` executed on PGlite only, NOT on any hosted database.

**Entry 15 corrections and re-verification (beta session, 2026-10-16, on HEAD `e33528a`, which includes the L2 commits made by a separate session):**
- Correction: lessons are not public. The smoke test asserts that anonymous visitors are redirected to sign-in; the 404 leak check uses `/legal/<missing>`.
- Found by running the smoke test against a production-like `next start` (unit tests call handlers directly, so they missed it). The proxy redirected every cookieless request to `/start`, which broke `/auth/callback` (hosted sign-in could never finish), `/api/health`, `/api/ready`, `/api/cron/*` (Vercel Cron), `/robots.txt`, `/help` and `/accessibility`. Fixed with an explicit public allow-list in `lib/identity/routes.ts`; the tests also confirm that look-alike paths still need a cookie.
- `/api/ready` reports 503 (not 429) when the limiter is down, because it fails closed.
- Gates re-run:
  - lint ✓ (0 errors, 53 warnings)
  - typecheck ✓
  - check:content ✓
  - check:soc ✓
  - test ✓ 2103/2103
  - test:security ✓ 257/257
  - test:db ✓ 109/109
  - production-like `next build` ✓ (unreachable Supabase URL, random secrets)
  - scan:bundle ✓ (88 artifacts; 12 pattern rules + 2 real secret values)
  - `npm run smoke -- http://localhost:3200` ✓ 16/16 checks in 18 requests
  - production start with a bad `CRON_SECRET` refuses: it names the variable, not the value, and every request gets a 500
  - e2e (desktop) ✓ 11 passed / 1 skipped (mobile-only): onboarding, feedback widget, Rank 0 lessons, lab terminal, knowledge and scenario exam start-to-results
- Synthetic restore: 100 learners, 39 tables, 800 rows, 4.0 s total (load 3.4 s, checks 0.6 s).
- Not run: `staging:verify` (needs the owner's staging project; the same checks pass on PGlite), `db:backup` (no pg_dump here, and no hosted DB), any hosted migration.

### Entry 16: SOC Level 2 (L2) Exam Formats & Hardening — Stage 1 Build (2026-10-16)
Additive implementation reusing L1 exam infrastructure:
1. **L2 Exam Formats:**
   - `investigation-l2`: Multi-stage investigation exam with incident scoping report template (`scoping-report-l2.yaml`) & rubric (`scoping-report-l2-rubric.yaml`).
   - `detection-rule`: Detection rule engineering challenge evaluated against hidden hold-out variants and benign twins via pure server evaluator (`lib/lab-engine/soc/rules/evaluator.ts`) with zero client oracle before submission; protected against ReDoS and prototype pollution.
   - `knowledge-l2`: 25 authored questions (K23–K45) in `content/soc/exams/knowledge-bank-l2.yaml`; claims logged in `docs/ops/soc-curriculum-claims.md` with objective alignment explicitly marked `UNVERIFIED`.
2. **Readiness Gate & UI:**
   - Provisional readiness criteria in `content/soc/exams/readiness-l2.yaml` using exact wording (*"Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."*).
   - Rule editor UI (`DetectionRuleEditor.tsx`), keyboard-accessible test tab, post-submission quality feedback (recall, precision, FPR), evidence log in `docs/design/evidence/soc-l2-exams.md`. Works with drills off.
3. **Handler L2 Context & Defenses:**
   - Learner-visible queries, lookups, and detection rules (`myDetectionRules`) exposed to Handler.
   - `rule_seeking` category in `soc-guard.ts` providing Socratic redirects without model calls or verdict reveals.
   - 61 unit tests covering attacks, prompt injection, and over-refusal in `tests/unit/lib/handler/soc-mode.test.ts`.
4. **Data Layer & Migrations:**
   - Additive migration `20261016180000_soc_l2_exams.sql` (format constraint expansion, `soc_detection_rules` table with RLS, atomic start function, updated `delete_user_account()`).
   - PGlite two-user tests (`tests/db/soc-l2-exams.test.ts`, 8/8 passed). Local store parity, deletion and export allowlists extended.
5. **Security & Leaks:**
   - Added `rule-ground-truth` leak rule and extended `exam-keys` in `lib/security/bundle-scan.ts`.
   - Feature flags `SOC_L2_ENABLED` and `SOC_RULES_ENABLED` configured and defaulted to false in production.

Full gates:
- lint ✓ (0 errors, 53 pre-existing warnings)
- typecheck ✓ (0 errors)
- check:content ✓
- check:soc ✓ (1 scenario, 9 families, 4 shifts)
- test ✓ 2103/2103
- test:security ✓ 257/257
- test:db ✓ 109/109 (PGlite)
- build ✓ (Next.js Turbopack)
- scan:bundle ✓ (88 client artifacts, 0 leaks across 12 pattern rules)
- test:e2e ✓ (`tests/e2e/soc-exams.spec.ts` 4/4 passed)
- Migration `20261016180000_soc_l2_exams.sql` executed on PGlite only, NOT on any hosted database.

### Entry 17: SOC Level 2 (L2) Independent Audit & Fix (Phase A & B) (2026-10-17)
Independent audit of L2 curriculum, detection evaluator, exam integrity, data isolation, Handler guards, report grading, deploy risk, UI accessibility, and test gaps:
1. **Phase A Audit Findings Resolved:**
   - `L2-A-01` (High): Knowledge bank L2 volume expanded from 25 to 45 items (added K46–K65 with certain citations in `soc-curriculum-claims.md`); 3-attempt repeat rate dropped from 100% to ~55.5%.
   - `L2-A-02` (Medium): Fixed `ExamRunner.tsx` missing `initialRule` prop on `<DetectionRuleEditor />`, ensuring detection rule drafts persist across browser reloads.
   - `L2-A-03` (Medium): Resolved Turbopack dynamic filesystem trace warning in `shift-composer.ts` by adding `process.cwd()` path bounding and `/*turbopackIgnore: true*/`, plus Next.js `outputFileTracingIncludes` in `next.config.ts`. Production build now completes with **zero warnings**.
   - `L2-A-04` (Medium): Added comprehensive Playwright E2E spec for L2 detection rule challenge in `tests/e2e/soc-exams.spec.ts` (start, draft, reload persistence, submission, and holdout/twin scorecard).
   - `L2-A-05` (Low): Fixed non-deterministic `new Date().toISOString()` in fallback alert generation in `lib/lab-engine/soc/rules/evaluator.ts`.
   - `L2-A-06` (Low / Deferred): Zero dedicated L2 lessons/labs registered; mapped to foundational L1 modules in `readiness-l2.yaml` study plan (deferred full L2 lesson authoring to future curriculum milestone).
2. **Security & Guard Hardening:**
   - Enhanced `INPUT_RULES` in `lib/handler/soc-guard.ts` to intercept ground-truth telemetry, hold-out sample requests, and role-play bypass attempts without model calls.
   - Added 15 fresh adversarial jailbreaks + 5 conceptual validation tests in `tests/unit/lib/handler/soc-mode.test.ts` (all 81 tests passing).
   - Fixed floating `FeedbackDialog` collision with `HandlerDrawer` by moving feedback widget to `bottom-4 left-4`, resolving WCAG 2.5.8 touch-target violations across full E2E suite.
3. **Grading Quality & Regression Proofs:**
   - Added `scoping-report-l2-grader.test.ts` evaluating 3 strong, 3 weak, and 2 keyword-stuffed gamed reports against `scoping-report-l2-rubric.yaml`. Confirmed clean score separation.
   - Added evaluator tests in `evaluator.test.ts` verifying wildcard-everything FPR penalization (100% FPR, failing score) and overfitted alert ID detection.

Full gates:
- lint ✓ (0 errors, 53 pre-existing warnings)
- typecheck ✓ (0 errors)
- check:content ✓ (80 lessons, 34 labs, 27 objectives, 45 L2 items)
- check:soc ✓ (1 scenario, 9 families, 4 shifts, 100% pass across 50 seeds)
- test ✓ (244 test files, 2130 passed)
- test:security ✓ (25 test files, 257 passed)
- test:db ✓ (7 test files, 109 passed on PGlite)
- build ✓ (Next.js Turbopack, 0 warnings, 29/29 static pages)
- scan:bundle ✓ (88 client artifacts, 0 leaks across 12 pattern rules)
- test:e2e ✓ (162 passed, 24 skipped, 0 failed across desktop & mobile full suite)
- Beta readiness recommendation: `SOC_L2_ENABLED` and `SOC_RULES_ENABLED` safe to enable for invite-only beta once owner reviews manual checklist.

### Entry 18: Closed-Beta Deployment Readiness & Verification (Vercel + Hosted Supabase) (2026-10-17)
Goal: Release engineering pass to verify and prepare CyberBLADE for closed-beta deployment on Vercel with hosted Supabase.
All checks executed locally against PGlite and local production-mode server in strict accordance with Standing Rule 6 (no migrations executed against a live hosted DB).

Scope completed:
1. **Serverless Build & Tracing:**
   - Updated `next.config.ts` to trace `"/**/*": ["./content/**/*", "./labs/**/*"]`, ensuring all serverless route lambdas bundle all curriculum YAMLs, MDX, scenario seeds, exam banks, and rubrics.
   - Bounded Turbopack filesystem dynamic trace; production build succeeds with **0 warnings** across all 28 routes.
   - Fail-closed storage verified: `assertSafeStorageMode()`, `assertRuntimeConfig()`, and `assertEnv()` refuse local JSON store and halt boot if Supabase URL / keys are missing in production.
2. **Environment Configuration & Boot Validation:**
   - Complete `.env.example` updated with accurate variable descriptions for all public and server variables.
   - `lib/config/env.ts` updated with `assertEnv()` and wired into `instrumentation.ts` alongside `assertRuntimeConfig()`.
   - Feature flags `SOC_L2_ENABLED=false` and `SOC_RULES_ENABLED=false` set as safe defaults for staged rollout per Entry 17 audit verdict.
   - Zero AI provider keys in client bundle verified via `npm run scan:bundle` (87 artifacts, 0 leaks).
3. **Database Migrations & 100% RLS Coverage:**
   - Authored `scripts/db-migrate-prod.mts` and registered `npm run db:migrate:prod`.
   - Applied all 14 timestamped migrations cleanly in chronological order to a fresh database.
   - Audited all public tables via `pg_class` and `pg_policies`: **40/40 (100%) public tables have Row Level Security enabled** (0 blockers).
   - Zero test seeds in learner-facing tables confirmed.
4. **Hardening & Security Controls:**
   - Strict CSP without `unsafe-eval` enforced in production. Security headers verified (HSTS, nosniff, SAMEORIGIN frame-ancestors, referrer-policy, permissions-policy).
   - Rate limiting enforced on all sensitive routes via PostgreSQL atomic function `rate_limit_hit` (auth: 5/min, Handler: 30/min + per-user daily token caps, exam submits: 5/min).
   - Closed-beta gate: `BETA_INVITE_ONLY=true` with atomic invite redemption; `app/robots.ts` set to `force-dynamic` to enforce `noindex` header and disallow crawlers.
5. **Observability & Bug Reporting:**
   - Error tracking seam (`ERROR_REPORTER_DSN`) with scrubbed Sentry adapter and fallback to PII-redacted structured JSON logs.
   - `/api/health` verified (HTTP 200 `{ status: "ok" }`).
   - In-app "Report a problem" widget (`FeedbackDialog.tsx`) verified; stores directly to `learner_feedback` table.
6. **Vercel Configuration:**
   - Configured `vercel.json` with target region `bom1` (Mumbai, India) and `maxDuration: 60` for serverless routes.
7. **Smoke Testing & E2E Verification:**
   - Enhanced `tests/e2e/smoke.spec.ts` with complete release user journey:
     * Sign-up (operator onboarding)
     * Lesson view (`/learn/core-r0-comp-hardware-01`)
     * Socratic Handler consultation ("Simplify" prompt)
     * 4 Lab Engines: Terminal (`core-r0-terminal-lab-01`), Files/VFS (`core-r0-files-lab-01`), Challenge Lobby (`/challenge/0`), and SOC Workspace (`/labs/soc/soc-l1-noisy-shift`)
     * L1 practice exam start & timer verification (`/labs/soc/exams`)
     * Sign-out and session revocation verification
     * All 4 test cases passed across desktop and mobile.
   - Verified 16/16 black-box smoke checks passing via `npm run smoke -- http://localhost:3200`.
8. **Documentation:**
   - Authored comprehensive deployment runbook `docs/ops/deploy.md` with complete env variable table, migration runbook, RLS coverage table, rollback steps, and Owner Manual Checklist.

Full gates:
- lint ✓ (0 errors, 53 pre-existing warnings)
- typecheck ✓ (0 errors)
- check:content ✓ (80 lessons, 34 labs, 27 objectives)
- check:soc ✓ (1 scenario, 9 families with 50 seeds, 4 shifts with 50 seeds, 100% pass)
- test:security ✓ (25 test files, 257 passed)
- test:db ✓ (7 test files, 109 passed on PGlite)
- test ✓ (244 test files, 2,130 passed)
- build ✓ (Next.js Turbopack, 0 warnings, 28/28 pages)
- scan:bundle ✓ (87 client artifacts, 0 leaks across 12 pattern rules)
- test:e2e smoke ✓ (4/4 passed across desktop & mobile)
- black-box smoke ✓ (16/16 checks passed)

### Entry 19: Closed-Beta Audit Findings Closure & High-End Design Elevation (2026-10-17)
Lead engineer pass triaging and closing all findings from Pass A (QA/Functional), Pass B (Security/Pentest), and Pass C (Design/A11y) documented in `docs/ops/beta-findings.md`.

1. **Order of Execution & Findings Triage:**
   - **Security Critical/High (Pass B):** 257 security test cases in `tests/security/` and `tests/db/` audited and verified. 100% RLS on all 40 public tables, zero cross-tenant IDOR leakage, server-authoritative timer countdowns, CSRF/session revocation, and AST-bounded query sandboxing. Pass B result: **0 Critical / 0 High vulnerabilities**.
   - **Functional/QA Critical & High (Pass A):**
     * `A-01` (`7d7de04`): Handle validation rejects hyphens (`tester-a`, `student-01`). Fixed regex in `lib/identity/validation.ts` to `/^[a-z0-9_-]{3,20}$/`; updated UI helper copy; regression tested in `validation.test.ts`.
     * `A-02` (`dea5da8`): Undocumented rank gating on direct links to higher tracks like `/learn/soc-l1`. Added contextual track notice on locked core map.
     * `A-03` (`cbea6b6`): Unreleased tracks returned 404. Built dynamic roadmap preview syllabus route and updated landing stamps to ROADMAP/LIVE.
     * `A-04` (`dea5da8`): Immediate rank challenge availability. Added `RECOMMENDED PREREQUISITE` badge guiding beginners to foundational lessons.
     * `A-05` (`fb70064`): Terminal viewport line wrapping. Added dedicated `⤢ Maximize` / `⤓ Restore` toggle and full-screen container state.
     * `A-06` (`2fb1c9d`): Account export debounce on rapid clicks. Added 2-second debounce timer and loading feedback in `AccountDataControls.tsx`.
     * `A-07` (`2fb1c9d`): Account deletion required exact uppercase `DELETE`. Accepted `.trim().toUpperCase() === "DELETE"` with case-insensitive validation.
   - **Design Top-10 & Accessibility (Pass C):**
     * `C-19` & `C-20` (`72c47de`): Terminal Lab WCAG 2.1 AA violations. Removed prohibited `aria-label` from `#terminal-exit` generic div; upgraded hostname contrast class from `text-muted/60` to `text-muted`. Regression tested in `terminal-a11y.test.tsx`.
     * `C-04` through `C-18` (`9aa2f6d`): Touch targets under 44px on mobile viewports. Applied `min-h-[44px] min-w-[44px]` with flex centering across skip-to-content links and mobile interactive controls.
     * `C-22` (`9aa2f6d`): Mobile software virtual keyboard covering terminal prompts. Added `interactiveWidget: "resizes-content"` to Next.js viewport metadata.
     * `C-25` (`fb70064`, `e54c0e1`): Landing CTA buttons lacked nested icon pill architecture (`taste-soft` §4.B). Integrated circular trailing arrow badge pill with kinetic hover animation while preserving accessible name for test suites.
     * `C-21` (`fb70064`, `e54c0e1`): Course map cards lacked tactical depth. Replaced flat single borders with Double-Bezel chassis architecture (`taste-soft` §4.A / `taste-brutalist` §5): outer chassis wrapping inner console core.
     * `C-01`, `C-02`, `C-03` (`fb70064`): Laboratory and administrative headers computed at 17px–24px. Scaled to fluid `clamp` `text-4xl..text-7xl font-display uppercase tracking-tight leading-[0.95]`.
     * `C-24` (`fb70064`): Account profile lacked visual prestige. Redesigned as industrial Operative Dossier with clearance rank insignia and cryptographic security badges.
     * `C-28` (`fb70064`): Exam countdown HUD lacked urgency cues. Added `animate-pulse text-danger border-danger/60` when time < 120s in both ChallengeTimer and ExamTimerHud.
     * `C-23` (`fb70064`): Novice jargon density. Injected plain-language micro-tooltips (`ℹ`) for TLP:AMBER, Kendall-Tau distance, and IoC observed roles across report and triage editors.
     * `C-26` (`fb70064`, `e66b9f8`): Check radio labels used default browser rings. Replaced with tactical focus ring `has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan`.
     * `C-27` (`fb70064`): Tablet alert queue table rows compressed awkwardly. Shifted source column breakpoint to `hidden lg:block`.

2. **Focused Commits Authored & Committed to `main`:**
   - `72c47de`: `fix(C-19, C-20): resolve terminal lab ARIA prohibited attribute and low-contrast text`
   - `7d7de04`: `fix(A-01): accept hyphens in operator handle validation on signup`
   - `2fb1c9d`: `fix(A-06, A-07): debounce account data export and accept case-insensitive account deletion`
   - `cbea6b6`: `fix(A-03): update landing track stamps and provide roadmap preview routes`
   - `dea5da8`: `fix(A-02, A-04): clarify rank lock requirements on core map and challenge lobby`
   - `9aa2f6d`: `fix(C-04..C-18, C-22): enhance touch targets to 44px and configure mobile viewport keyboard resize`
   - `fb70064`: `style(C-01..C-03, C-21, C-23..C-28, A-05): elevate typography, double-bezel cards, interactive tooltips and maximize controls`
   - `e66b9f8`: `chore(lint): resolve typing and focus-visible assertions for gates`
   - `e54c0e1`: `fix(a11y, e2e): restore WCAG 2 AA contrast on core badges and align landing CTA names`

3. **Full Gate Verification Results:**
   - `lint` ✓ (0 errors, 61 pre-existing warnings)
   - `typecheck` ✓ (0 errors)
   - `check:content` ✓ (80 lessons, 34 labs, 27 objectives)
   - `check:soc` ✓ (1 scenario, 9 families with 50 seeds, 4 shifts with 50 seeds, 100% pass)
   - `test` ✓ (247 test files, 2,137 passed, 0 failed)
   - `test:security` ✓ (25 test files, 257 passed, 0 failed)
   - `test:db` ✓ (7 test files, 109 passed on PGlite)
   - `build` ✓ (Next.js Turbopack production build, 0 warnings across all 28 routes)
   - `scan:bundle` ✓ (87 client artifacts, 0 leaks across 12 pattern rules + env secrets)
   - `test:e2e` ✓ (164 passed, 24 skipped, 0 failed across Chromium desktop & mobile)

4. **Rollout Posture:**
   - All Pass A, Pass B, and Pass C beta findings are closed.
   - Zero security controls or test assertions were weakened.
   - Verdict: **GO for inviting closed-beta cohort (20–100 learners)**.

### Entry W1: Completion Certificates & Public Verification Registry (2026-10-17)
Senior full-stack engineering milestone on branch `build/weekend` delivering verifiable completion certificates, cryptographic verification registry, and administrative revocation workflows.

1. **Architecture & Deliverables Built:**
   - **Data Layer & RLS (`supabase/migrations/20261017100000_certificates_and_verification.sql`):**
     * `public.certificates` table: `id`, `user_id`, `track_id`, `level`, `name_as_chosen`, `credential_id`, `issued_at`, `revoked_at`, `revocation_reason`, `score_snapshot`, `created_at`.
     * Idempotency guarantee: `UNIQUE (user_id, track_id, level)`.
     * Strict RLS: `anon` and `PUBLIC` table select revoked; authenticated learners read only their own certificates (`auth.uid() = user_id`).
     * `verify_certificate(p_credential_id TEXT)`: `SECURITY DEFINER` RPC with pinned `search_path = public, pg_temp` returning only safe public verification attributes (`name_as_chosen`, `track_id`, `level`, `issued_at`, `status`, `revoked_at`). Never returns emails or internal user IDs.
     * `revoke_certificate(p_credential_id TEXT, p_reason TEXT)`: `SECURITY INVOKER` function with pinned `search_path` executable only by `service_role`.
     * GDPR erasure cascade: updated `public.delete_user_account(target_user_id)` to cascade `DELETE FROM public.certificates WHERE user_id = target_user_id`.
   - **Progress Repositories Parity:**
     * `lib/progress/types.ts`: added `certificates` to `ProgressData`.
     * `lib/progress/repo.ts` (`LocalProgressRepo`): added `saveCertificate`, `listCertificates`, `getCertificateByCredentialId`, `verifyCertificate`, `revokeCertificate`, and account deletion cleanup in `deleteUserData`.
     * `lib/progress/supabase-repo.ts` (`SupabaseProgressRepo`): implemented equivalent database queries and RPC calls.
   - **GDPR Export Allowlist Update (`lib/identity/learner-export.ts`):**
     * Extended `buildLearnerExport` to include allowlisted public certificate metadata (`credentialId`, `trackId`, `level`, `nameAsChosen`, `issuedAt`, `status`, `revokedAt`, `scoreSnapshot`).
   - **Issuance Logic & Domain Service (`lib/certificates/`):**
     * `lib/certificates/slug.ts`: 128-bit unguessable slug generator (`cbl_<32 hex chars>`) using `node:crypto` `randomBytes(16)`.
     * `lib/certificates/eligibility.ts`: server-authoritative evaluation of track completion criteria (Core Rank 1 Operator, Core Rank 2 Watcher, SOC Tier 1 Analyst). Never trusts client input.
     * `lib/certificates/service.ts`: display name validation (2–60 chars, trimmed, control character & markup sanitization), rate-limited issuance action, public verification helper, and admin revocation handler.
   - **Revocation Path & CLI Script (`scripts/revoke-certificate.mts`, `package.json`):**
     * Admin CLI utility: `npm run cert:revoke -- --credential <id> --reason <reason> [--hosted]` with audit logging.
   - **UI & Public Verification Pages:**
     * `components/certificates/CertificateView.tsx`: double-bezel industrial chassis (`taste-soft` §4.A / `taste-brutalist` §5), SVG guilloche watermark, cryptographic fingerprint, high-contrast dynamic QR code to verification URL, dual authority signatures, and honest attribution footnote.
     * `components/certificates/CertificateDownloadButtons.tsx`: client-side PDF print layout, high-resolution 2x PNG canvas export, SVG download, and link copy.
     * `components/certificates/LinkedInShareButton.tsx`: direct "Add to LinkedIn" button with prefilled certification query parameters (`startTask=CERTIFICATION_NAME`, `certId`, `certUrl`, `issueYear`, `issueMonth`).
     * `components/certificates/ClaimCertificateModal.tsx`: interactive modal allowing eligible learners to specify their recipient display name.
     * `app/(app)/certificates/page.tsx`: authenticated "My Certificates" dashboard displaying issued credentials, unclaimed eligible tracks, and curriculum prerequisites.
     * `app/verify/[credentialId]/page.tsx`: public verification page with `robots: { index: false, follow: false }` (`noindex` while in beta), verified/revoked status badges, credential overview, and full certificate view.
     * Navigation: added `[CREDENTIALS]` link to `components/shell/NavLinks.tsx`.
   - **Copy Honesty Policy:**
     * All credentials explicitly labeled: "CyberBLADE Certificate of Completion". Disclaims endorsement by CompTIA, TryHackMe, OffSec, or third-party bodies.
   - **SOC L2 Protection:**
     * Zero modifications made to `lib/lab-engine/soc/rules` or SOC L2 exam files.

2. **Files Created / Modified:**
   - Migration & Database:
     * `supabase/migrations/20261017100000_certificates_and_verification.sql`
     * `tests/db/certificates.test.ts`
     * `tests/db/access-hardening.test.ts`
     * `tests/security/soc-report-security.test.ts`
   - Domain & Services:
     * `lib/certificates/types.ts`
     * `lib/certificates/slug.ts`
     * `lib/certificates/eligibility.ts`
     * `lib/certificates/service.ts`
     * `lib/progress/types.ts`
     * `lib/progress/repo.ts`
     * `lib/progress/supabase-repo.ts`
     * `lib/identity/learner-export.ts`
   - Actions & UI:
     * `app/(app)/certificates/actions.ts`
     * `app/(app)/certificates/page.tsx`
     * `app/verify/[credentialId]/page.tsx`
     * `components/certificates/CertificateView.tsx`
     * `components/certificates/CertificateDownloadButtons.tsx`
     * `components/certificates/LinkedInShareButton.tsx`
     * `components/certificates/ClaimCertificateModal.tsx`
     * `components/shell/NavLinks.tsx`
   - Scripts & Tests:
     * `scripts/revoke-certificate.mts`
     * `app/api/e2e/route.ts`
     * `tests/unit/lib/certificates/certificates.test.ts`
     * `tests/e2e/certificates.spec.ts`
     * `package.json`, `package-lock.json`

3. **Gate Verification Results:**
   - `npm run lint` ✓ (0 errors, 63 pre-existing warnings)
   - `npm run typecheck` ✓ (0 errors across whole codebase)
   - `npm run check:content` ✓ (80 lessons, 34 labs, 27 objectives)
   - `npm run test` ✓ (249 test files, 2,160 passed, 0 failed)
   - `npm run test:security` ✓ (25 test files, 257 passed, 0 failed)
   - `npm run test:db` ✓ (8 test files, 118 passed on PGlite)
   - `npm run build` ✓ (Next.js Turbopack production build, 0 warnings across all 29 routes)
   - `npm run scan:bundle` ✓ (89 client artifacts, 0 leaks across 12 pattern rules + env secrets)
   - `npm run test:e2e` ✓ (166 passed, 24 skipped, 0 failed across Chromium desktop & mobile)

4. **Open Issues / Follow-ups:**
   - Hosted Supabase migration: apply `20261017100000_certificates_and_verification.sql` during next maintenance deployment window via `npm run db:migrate:prod`.
   - Remove `noindex` from `/verify/[credentialId]` upon public general availability (v1.0 GA).

### Entry W2: Penetration Testing Track L1 (eJPT Prep) & Modules 1–5 Authoring (2026-10-17)
Curriculum architect + engineer milestone on branch `build/weekend` designing the complete 11-module Penetration Testing L1 track targeting first-attempt eJPT readiness (with future pathways to CPTS/OSCP), authoring Modules 1–5 with companion checks, micro-exercises, and flashcards, cataloging unverified curriculum claims, creating content linting rules, and server-side gating behind `PENTEST_ENABLED`.

1. **Architecture & Design Specifications:**
   - `docs/design/pentest-track.md`: Complete curriculum blueprint defining 8 target outcomes, 11-module map, prerequisites (Core Rank 1 Operator), rank/XP system (Apex Security Assessments fictional firm; 1,000 XP total across L1), and lab engine mappings (Terminal, WebApp, Packet, Report).
   - `docs/ops/pentest-curriculum-claims.md`: Mapped 11 modules to eJPT v2 exam domains (Assessment Methodologies, Host & Networking Auditing, Host & Network Penetration Testing, Web Application Penetration Testing) explicitly cataloged as UNVERIFIED in compliance with Standing Rule 4 (zero proprietary exam leaks). Established 33 synthetic technical claims (P1–P33) with citations to RFC 5737/2606, NIST SP 800-115, PTES, OWASP WSTG, Nmap reference guide, and CWE.

2. **Module Status Table:**

| Module ID | Title | Key / Slug | Status | Lessons Authored / Planned | Engine |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **M01** | Methodology, Scoping & Rules of Engagement | `methodology` | **Done** | 2 / 2 (`01-methodology-roe`, `02-legal-authorization`) | Terminal / Report |
| **M02** | Passive Reconnaissance & OSINT | `osint` | **Done** | 2 / 2 (`01-dns-whois-recon`, `02-search-dorking-subdomains`) | Terminal / WebApp |
| **M03** | Active Host Discovery & Port Scanning | `scanning` | **Done** | 2 / 2 (`01-nmap-host-discovery`, `02-tcp-udp-port-scanning`) | Terminal / Packet |
| **M04** | Network Service Enumeration | `services` | **Done** | 3 / 3 (`01-smb-enum-shares`, `02-ftp-ssh-enum`, `03-snmp-db-enum`) | Terminal / Packet |
| **M05** | Vulnerability Identification & Assessment | `vuln-analysis` | **Done** | 2 / 2 (`01-vuln-scanning-cve-search`, `02-manual-verification-false-positives`) | Terminal / WebApp |
| **M06** | Web Application Attacks | `web-attacks` | **Pending** | 0 / 3 (Authentication, Injection, Access Control) | WebApp |
| **M07** | Exploitation Fundamentals & Metasploit | `exploitation` | **Pending** | 0 / 3 (Payloads, Handlers, Exploits) | Terminal |
| **M08** | Password Attacks & Credential Access | `passwords` | **Pending** | 0 / 2 (Offline Cracking, Online Spraying) | Terminal |
| **M09** | Post-Exploitation & Privilege Escalation | `post-exploit` | **Pending** | 0 / 3 (Linux PrivEsc, Windows PrivEsc, Local Enum) | Terminal |
| **M10** | Pivoting, Port Forwarding & Routing | `pivoting` | **Pending** | 0 / 2 (SSH Tunnels, SOCKS Proxies) | Terminal / Packet |
| **M11** | Penetration Testing Reporting & Documentation | `reporting` | **Pending** | 0 / 2 (Findings Writeup, Risk Scoring) | Report |

3. **Content Authored (11 Complete Lesson Sets):**
   - Authored all 11 lessons with complete companion sets (`.mdx`, `.checks.yaml`, `.exercises.yaml`, `.cards.yaml`).
   - Every lesson includes:
     * Outcome hook + Why this matters on engagement
     * Before you start + Core ideas (scoping and explicit authorization taught first)
     * Worked example (realistic tool output using exclusively RFC 5737 IPs `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` and RFC 2606 domains `.example`)
     * Try it + interactive MicroExercise component
     * Common mistakes + What good looks like + In the real world
     * Remember it like this + Interview answer
     * Check your understanding (<TerminalCheck /> with >= 4 multiple-choice checks with explanations and distractor rationales)
     * Key terms (<KeyTerms />) + Practice this (<PracticeThis />)
     * Handler hint context for the AI tutor

4. **Catalog Registration & Server-Side Gating:**
   - Feature flag `PENTEST_ENABLED` (default false) added to runtime configuration and environment template (`lib/config/env.ts`, `lib/config/runtime-config.ts`, `.env.example`).
   - Defined track configuration in `content/tracks/pentest/l1/track.yaml` (min_core_rank: 1, lesson_world: Apex Security Assessments).
   - Created skills definition in `content/pentest/skills.yaml` and coverage matrix in `content/coverage/pentest.yaml`.
   - Updated `lib/content/validate.ts` to allow `lesson.track === "pentest"`.
   - Built track dashboard at `app/(app)/learn/pentest-l1/page.tsx` and gated route at `app/(app)/learn/[lessonId]/page.tsx` (returns 404 when disabled; redirects `/learn/pentest` to `/learn/pentest-l1` when enabled).

5. **Tooling & Test Suite Health:**
   - Built `lib/content/pentest-lesson-lint.ts` with checks for template headings, RFC 5737 indicators, SNMP OID disambiguation, check bounds, and time estimation.
   - Integrated pentest validation directly into CI content gate `scripts/check-content.mts`.
   - Authored unit test suite `tests/unit/lib/content/pentest-lesson-lint.test.ts` (10 tests, 100% passing).
   - Zero changes made to SOC L2 files or rules (`lib/lab-engine/soc/rules`).
   - Verification gates: `lint` ✓ (0 errors), `typecheck` ✓ (0 errors), `check:content` ✓ (91 lessons, 34 labs, 27 objectives), `test` ✓ (250 files, 2170 tests passing), `test:security` ✓ (25 files, 257 tests passing), `build` ✓ (Next.js Turbopack, 0 warnings across all 30 routes).

### Entry W3: Penetration Testing Track L1 Modules 6–12, Labs, Socratic Handler & Track Pages Completed (2026-10-17)
Completed authoring and engineering for the remaining modules (6–12) of the Penetration Testing Level 1 (eJPT Prep) track on branch `build/weekend`. Authored 14 lessons across Modules 6–12 (totaling 25 lessons across all 12 modules), implemented 7 server-graded hands-on labs across existing engines (Terminal, WebApp, Packet), implemented the Socratic Pentest Handler mode with adversarial test suite, built the responsive Track Overview and Module Detail pages with 390px mobile verification, extended bundle scanning for pentest flags, and verified all quality gates.

1. **Complete Module & Lab Coverage Table:**

| Module ID | Title | Key / Slug | Status | Lessons Authored | Associated Hands-On Lab | Engine |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **M01** | Methodology, Scoping & Rules of Engagement | `scope` | **Done** | 2 / 2 | — | (Concept / RoE Checklist) |
| **M02** | Passive Reconnaissance & OSINT | `osint` | **Done** | 2 / 2 | — | (OSINT / DNS Queries) |
| **M03** | Active Host Discovery & Port Scanning | `scanning` | **Done** | 2 / 2 | `pentest-m03-pkt-scan-01` (TCP Port Scan Signatures) | **Packet** |
| **M04** | Network Service Enumeration | `services` | **Done** | 3 / 3 | `pentest-m04-term-services-01` (SMB Share Enumeration) | **Terminal** |
| **M05** | Vulnerability Identification & Assessment | `vuln` | **Done** | 2 / 2 | — | (NVD / CVSS Verification) |
| **M06** | Web Application Attacks | `web` | **Done** | 3 / 3 | `pentest-m06-web-attacks-01` (SQLi Auth Bypass & LFI Traversal) | **WebApp** |
| **M07** | Exploitation Fundamentals & Metasploit | `exploit` | **Done** | 2 / 2 | — | (Staged Payloads / msfconsole) |
| **M08** | Password Attacks & Credential Access | `passwords` | **Done** | 2 / 2 | `pentest-m08-term-hashcrack-01` (MD5 Hash Cracking) | **Terminal** |
| **M09** | Post-Exploitation & Privilege Escalation | `privesc` | **Done** | 2 / 2 | `pentest-m09-term-privesc-01` (Linux Sudo Misconfiguration) | **Terminal** |
| **M10** | Pivoting, Port Forwarding & Routing | `pivoting` | **Done** | 2 / 2 | `pentest-m10-pkt-pivot-01` (Pivot Tunnel Traffic) | **Packet** |
| **M11** | Penetration Testing Reporting & Documentation | `reporting` | **Done** | 2 / 2 | — | (CVSS / Executive Remediation) |
| **M12** | Capstone Engagement Simulation | `capstone` | **Done** | 1 / 1 | `pentest-m12-capstone-01` (Full-Scope WebApp Compromise) | **WebApp** |

2. **Modules 6–12 Content Authoring:**
   - Authored 14 comprehensive lessons bringing total Pentest L1 lessons to 25.
   - Every lesson contains all 13 standard sections: Outcome hook, Why this matters, Before you start, Core ideas, Worked example (RFC 5737/2606 sanitized), Try it, Common mistakes, What good looks like, In the real world, Remember it like this, Interview answer, Check your understanding (`TerminalCheck` with >= 4 MCQs with distractor rationales), Key terms, Practice this, and Handler hints.
   - Companion files authored for every lesson: `.checks.yaml`, `.exercises.yaml`, and `.cards.yaml` (front/back >= 10 characters).
   - M06: `01-sqli-auth-bypass-union`, `02-xss-stored-reflected`, `03-lfi-path-traversal-auth`
   - M07: `01-payloads-staged-reverse-shells`, `02-metasploit-framework-fundamentals`
   - M08: `01-hash-identification-offline-cracking`, `02-online-brute-force-hydra`
   - M09: `01-linux-privesc-suid-sudo`, `02-windows-privesc-service-perms`
   - M10: `01-ssh-port-forwarding-tunnels`, `02-dynamic-socks-proxychains`
   - M11: `01-findings-writeup-cvss`, `02-executive-summary-remediation`
   - M12: `01-engagement-simulation-e2e`
   - Updated `content/tracks/pentest/l1/track.yaml` (`enabled: true`, M12 added), `content/pentest/skills.yaml` (31 skills), and `content/coverage/pentest.yaml`.

3. **Hands-On Laboratories on Existing Engines:**
   - Created 7 procedural, deterministic, server-graded labs:
     * Terminal Engine (3 labs): `pentest-m04-term-services-01` (SMB Shares), `pentest-m08-term-hashcrack-01` (MD5 wordlist cracking), `pentest-m09-term-privesc-01` (Sudo shell escape).
     * WebApp Engine (2 labs): `pentest-m06-web-attacks-01` (SQLi Auth Bypass & LFI Traversal), `pentest-m12-capstone-01` (Full-Scope Web Compromise).
     * Packet Engine (2 labs): `pentest-m03-pkt-scan-01` (Port Scan Signatures SYN vs Connect), `pentest-m10-pkt-pivot-01` (Pivoting Tunnel Traffic Analysis).
   - Authored lab configurations (`lab.yaml`), briefings (`briefing.md`), and synthesis debriefs in `lib/content/debriefs.ts` for all 7 labs.
   - Extended `lib/lab-engine/webapp/simulator.ts` with `pentest_web_portal` and `pentest_capstone_portal`.
   - Extended `lib/security/bundle-scan.ts` with flag leak detection pattern `\bPENTEST\{[A-Za-z0-9_-]{6,}\}` and verified 0 client bundle leaks.

4. **Socratic Pentest Handler Mode:**
   - Implemented `lib/handler/pentest-guard.ts` and `lib/handler/pentest-mode.ts` enforcing Socratic guidance: redirects learner requests for direct answers, flags, and exploit dumps with methodology hints in English and Hinglish.
   - Added output leak protection to catch and redact accidental flag revelations.
   - Authored comprehensive test suite `tests/unit/lib/handler/pentest-mode.test.ts` (64 tests: 34 adversarial attack corpus prompts, 8 output guard leak tests, and 22 over-refusal concept queries).

5. **Track Overview & Module Detail Pages:**
   - Built `app/(app)/learn/pentest-l1/[module]/page.tsx` following CyberBLADE tactical design tokens (`HeroBand`, double-bezel cards, interactive checkpoint with `TerminalCheck`, hands-on lab badge/launcher, lesson progress, and prev/next navigation).
   - Updated `app/(app)/learn/pentest-l1/page.tsx` linking module headers and embedding lab launcher badges.
   - Verified responsive layout and touch targets (>= 44px) on mobile viewport (390px x 844px) with zero horizontal overflow.

6. **Quality Gate Verification Results:**
   - `npm run lint` ✓ (0 errors, 63 pre-existing warnings)
   - `npm run typecheck` ✓ (0 errors, route types generated)
   - `npm run check:content` ✓ (105 lessons, 41 labs, 27 objectives)
   - `npm run test` ✓ (251 test files, 2,249 passed, 0 failed)
   - `npm run test:security` ✓ (25 test files, 258 passed, 0 failed)
   - `npm run build` ✓ (Next.js Turbopack production build, 30 routes)
   - `npm run scan:bundle` ✓ (89 client artifacts, 0 leaks)
   - `npm run test:e2e` (`tests/e2e/pentest-track.spec.ts`) ✓ (8 passed, 2 skipped on mobile; open track -> module -> lesson, completed 1 lab per engine: Terminal, WebApp, Packet).
   - **Strict Constraint**: Zero SOC L2 files modified.

### Entry W4: NetRange Simulated Multi-Host Network Engine & Scenarios Completed (2026-10-17)
Engineered and delivered "NetRange" — a deterministic, fully simulated multi-host network lab engine for eJPT-style offensive practice in CyberBLADE (branch `build/weekend`). The engine runs entirely in-browser while preserving strict server-side flag validation with zero real network traffic ever leaving the application.

1. **Architecture & Schema:**
   - **Schema & Validation** (`lib/lab-engine/netrange/schema.ts`, `types.ts`, `lint.ts`): Typed scenario schema representing IP subnets, CIDR masks, multi-interface hosts, OS (Linux/Windows), open TCP/UDP ports/services with banner strings, user accounts, password hashes, GTFOBins/sudo privileges, exploitable vulnerabilities with preconditions and effects (shell, read, privesc), flags, and routing/pivot rules. Validated with Zod and zero-leak content linting.
   - **Simulated Attacker Tooling** (`lib/lab-engine/netrange/commands/`):
     * `nmap`: Supports `-sV`, `-sC`, `-A`, `-Pn`, `-p` port ranges, and CIDR subnet sweeps with accurate service banners.
     * `searchsploit`: Offline Exploit-DB query utility mapping service versions to exploits and Metasploit module paths.
     * `msfconsole`: Simulated interactive console with `use`, `set <KEY> <VAL>`, `show options`, `exploit`/`run`, background `sessions -l`, and `sessions -i <id>`.
     * `curl`: HTTP header/body inspection supporting `-i`, path exploration, and credential discovery.
     * `smbclient` & `enum4linux`: SMB anonymous share discovery, listing, and file retrieval.
     * `ftp`: Interactive anonymous FTP file transfer client.
     * `ssh`: Interactive remote shell login with user authentication and target routing checks.
     * `john`: Dictionary-based hash cracking against simulated wordlists.
     * `route`: Kernel routing table inspection and pivot gateway creation (`route add <subnet> via <gw>`).
     * `host-shell`: Realistic compromised host execution (`whoami`, `id`, `cat`, `ls`, `cd`, `sudo -l`, GTFOBins breakouts).
     * Realistic error handling for unknown flags, unroutable targets, and command syntax errors.
   - **State Machine & Chained Execution** (`lib/lab-engine/netrange/engine.ts`): Supports command chaining (`&&`, `;`), command history, terminal prompt state formatting (`kali@kali:~$`, `msf6 >`, `user@host:path$`), and server-side flag grading (`submit <obj#> <flag>`).

2. **Server-Side Grading & Anti-Cheat Action:**
   - Added `dispatchNetRangeCommandAction` in `app/(app)/labs/actions.ts`. Evaluates commands against the deterministically regenerated lab environment on the server using the attempt seed. Flags and credentials remain completely protected from client bundles and props.
   - Fixed React Flight server-action serialization by ensuring deep cloning across client/server state boundaries, preventing object reference deduplication from discarding mutated session and option states.

3. **Three Authored Scenarios & Generators:**
   - Built 3 deterministic procedural generators in `lib/generators/netrange/`:
     * Scenario (a) `netrange-foothold-privesc-01` (`netrange-foothold-privesc.ts`): Single host perimeter foothold via `vsftpd 2.3.4` backdoor exploitation (`apex-srv01`), privilege escalation to `root` via `find` GTFOBins sudo misconfiguration.
     * Scenario (b) `netrange-web-cred-reuse-01` (`netrange-web-cred-reuse.ts`): Multi-host engagement where web application config analysis reveals administrative credentials reused on a domain-joined file server (`db-core01`), cracking MD5 shadow hashes with John the Ripper.
     * Scenario (c) `netrange-pivot-internal-01` (`netrange-pivot-internal.ts`): Multi-segment penetration test involving dual-homed bastion exploitation (`jump-gw01`), routing addition into hidden internal subnet `10.10.20.0/24`, and lateral SSH pivoting into internal SCADA gateway (`scada-core02`).
   - Registered 3 new lab packages in `labs/` (`lab.yaml`, `briefing.md`) and authored synthesis debriefs (<120 words) in `lib/content/debriefs.ts` covering both offensive exploitation mechanics and blue team hardening defenses.

4. **Terminal UI & Mobile Ergonomics:**
   - Created `components/labs/netrange/NetRangeLab.tsx` utilizing `@xterm/xterm` with CyberBLADE terminal styling tokens, dynamic resizing (`FitAddon`), status indicators (active host, sessions, routes, latency badge), and font scaling.
   - Built a mobile-first tactical keyboard toolbar featuring >= 44px touch targets for essential keys (`TAB`, `CTRL+C`, `CLEAR`, `↑`, `↓`, `EXEC`) and one-tap attack command snippets (`nmap -sV -sC`, `searchsploit`, `msfconsole`, `curl -i`, `smbclient`, `route add`, `submit`).
   - Fully responsive at 390px viewport with zero horizontal overflow.
   - Sub-150ms performance: simulated command execution and state transitions complete in < 25ms locally and < 50ms through server action.

5. **Quality Gates & Verification:**
   - `npm run lint` ✓ (0 errors, 68 warnings)
   - `npm run typecheck` ✓ (0 errors, route types generated)
   - `npm run check:content` ✓ (105 lessons, 44 labs, 27 objectives)
   - `npm test` ✓ (252 test files, 2,271 tests passing, including 16 engine unit tests and 63 generator tests)
   - `npm run test:security` ✓ (25 test files, 258 tests passing)
   - `npm run build` ✓ (Next.js Turbopack production build, 30 routes)
   - `npm run scan:bundle` ✓ (92 client artifacts, 0 leaks detected)
   - Playwright E2E (`tests/e2e/netrange-lab.spec.ts`) ✓ (2 passed on desktop Chrome, 2 passed on mobile Pixel 7: end-to-end completion of Scenario (a) foothold + privesc flag submissions + 390px mobile responsiveness).
   - **Strict Constraint**: Zero SOC L2 files (`lib/lab-engine/soc/rules`, SOC exams) touched.

### Entry W5: Pentest L1 Practical Performance Exam & Assessment Architecture Completed (2026-10-17)
Engineered and delivered the **Pentest L1 Practical Performance Exam** system (performance-based assessment aligned with eJPT) for CyberBLADE on branch `build/weekend`.

1. **Exam Format & Assessment Architecture:**
   - Designed and integrated dual assessment formats in `content/pentest/exams/config.yaml`:
     * **Practical Performance Exam**: 3 hours (180m, configurable), 30 questions (18 finding questions against target network hosts + 12 theory questions from technical knowledge bank), passing score >= 70%, 24h retake cooldown.
     * **Diagnostic Mock Assessment**: Untimed (720m relaxed), 15 questions (8 finding questions + 7 theory questions), 0m cooldown for low-stakes practice.
   - Dual-component weighted scoring: 60% findings / 40% theory, passing threshold >= 70%.
   - Server-authoritative timer with auto-submission on expiration, idempotent submission handling, and retake cooldown (24h for practical, 0m for mock).
   - Seed-based deterministic scenario generation (`generatePentestExamScenario(seed)`): completely fresh IP assignments, banner variations, credentials, and answers per attempt. Zero oracle or answer keys leaked to the client.

2. **Knowledge Bank (65 Technical Items) & Curriculum Claims:**
   - Authored 65 comprehensive technical items in `content/pentest/exams/knowledge-bank.yaml` mapped across 4 core domains:
     * Assessment Methodologies (14 items)
     * Host & Network Auditing (17 items)
     * Host & Network Pentesting (20 items)
     * Web App Pentesting (14 items)
   - Every question includes rich pedagogical explanations, distractor rationales, and domain tags.
   - Audited curriculum claims against the 65 items, logging unverified items P34–P70 in `docs/ops/pentest-curriculum-claims.md` for full truthfulness.

3. **Readiness Gate & Study Plan:**
   - Built provisional readiness diagnostic gate at `app/(app)/exam/pentest/readiness/page.tsx` and `lib/lab-engine/pentest/exam/readiness.ts`.
   - 4-point readiness criteria matrix:
     1. Curriculum module completion (>= 12 modules)
     2. Hands-on NetRange labs completed (>= 3 labs)
     3. Mock assessment passed (>= 70% score)
     4. Domain mastery floor (>= 70% in every domain)
   - Diagnostic status: `ready`, `close`, or `not_ready`.
   - Exact estimate disclaimer prominently displayed: `"Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."`
   - Personalized per-domain study plan (`lib/lab-engine/pentest/exam/study-plan.ts`) dynamically diagnosing weak domains and linking to targeted modules, review flashcards, and NetRange labs.

4. **Interactive Exam Workspace & Results Dossier:**
   - Split tactical layout (`components/labs/pentest/exams/`):
     * `PentestExamTimerHud.tsx`: Server-synchronized countdown timer with 10m/5m/1m audio-visual threshold warnings and automatic submission trigger.
     * `PentestTerminalWorkspace.tsx`: Simulated attack console running `nmap`, `searchsploit`, `msfconsole`, `curl`, `smbclient`, `ftp`, `ssh`, `john`, `route`, and host shell against 4 target hosts (`apex-gw01`, `web-srv01`, `db-int01`, `vault-srv01`).
     * `PentestQuestionsPanel.tsx`: Resilient form handler supporting short answers, MCQs, multi-select, and ordering with debounce auto-saving (`savePentestExamAnswerAction`).
     * `PentestExamRunner.tsx`: Full assessment coordinator with responsive tabs for mobile viewports, progress tracker, and confirm-to-submit modal.
     * `PentestExamResultView.tsx`: Comprehensive post-submission dossier featuring Passed/Failed badge, 4-domain mastery bars, component weighting (60% findings / 40% theory), full question review with explanations, and 1-click certificate claim (`ClaimCertificateModal`).
   - Routes:
     * `/exam/pentest`: Assessment lobby with format selector, rules, and attempt history.
     * `/exam/pentest/readiness`: Diagnostic gate and study plan.
     * `/exam/pentest/[examId]`: Active assessment runner and completed result view.
     * `/exam/pentest/[examId]/result`: Direct result dossier.
     * `/labs/pentest/exams`: Redirect to `/exam/pentest`.

5. **Data, Security, RLS & Bundle Scanner:**
   - Created Supabase migration `20261017120000_pentest_l1_exams.sql`: `pentest_exam_attempts` and `pentest_exam_answers` with strict owner-only RLS, immutable submitted states, and cascade deletion in `delete_user_account`.
   - Added 2-user isolation tests on PGlite in `tests/db/pentest-exams.test.ts` (10 passing tests verifying RLS cross-user isolation and delete cascade).
   - Added GDPR learner export allowlist in `lib/identity/learner-export.ts` (`pentest_exam_attempts`, `pentest_exam_answers`).
   - Extended client bundle scanner `lib/security/bundle-scan.ts` with leak detection rules (`pentest-exam-keys`, `pentest-exam-answers`), and verified 0 leaks across 95 compiled artifacts in Next.js production build.
   - Enforced feature flag `PENTEST_EXAMS_ENABLED` (default off).

6. **Quality Gates & Verification:**
   - `npm run lint` ✓ (0 errors)
   - `npm run typecheck` ✓ (0 errors, 33 routes generated)
   - `npm run check:content` ✓ (105 lessons, 44 labs, 27 objectives)
   - `npm test` ✓ (254 test files, 2,291 tests passing, including 20 new pentest exam unit tests)
   - `npm run test:security` ✓ (25 test files, 259 tests passing)
   - `npm run test:db` ✓ (9 test files, 127 tests passing on PGlite)
   - `npm run build` ✓ (Next.js Turbopack production build, 33 static & dynamic routes generated)
   - `npm run scan:bundle` ✓ (95 client artifacts, 0 leaks detected)
   - Playwright E2E (`tests/e2e/pentest-exam.spec.ts`) ✓ (readiness gate -> mock assessment start -> live runner & terminal -> submit -> result dossier -> certificate issuance).
   - **Strict Constraint**: Zero SOC L1 / L2 files or behaviors modified; all 254 test files remain green.
