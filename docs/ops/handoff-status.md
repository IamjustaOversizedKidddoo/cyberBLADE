# Handoff Status — Phase 3 (SOC track)

**Audited:** 2026-10-14 on `main` @ `d6dc315`, working tree clean, 194 commits.
**Method:** read-only. Every gate below was run in this session; the raw logs are summarized in §1. No code was changed.

---

## 1. Gate results (run 2026-10-14)

| Command | Result | Evidence |
|---|---|---|
| `npm run typecheck` | ✅ pass (exit 0) | `next typegen && tsc --noEmit` clean |
| `npm run lint` | ❌ **FAIL (exit 1)**: 99 problems (**46 errors**, 53 warnings) | 42× `no-explicit-any`, 2× `react/no-unescaped-entities`. All errors are in the SOC query layer (`lib/lab-engine/soc/query/*`, `components/labs/soc/search/*`, its tests) and `components/labs/soc/SocWorkspace.tsx`. |
| `npm run check:content` | ✅ pass | 38 lessons, 34 labs, 27 objectives |
| `npm run check:soc` | ✅ pass | Only 1 static scenario validated (`soc-l1-noisy-shift`) |
| `npm run check:soc:families` | ✅ pass | 9 families, 50 seeds each; ref-vs-naive margins ≥ +15% |
| `npm run check:soc:shifts` | ✅ pass | 4 shift profiles |
| `npm run test` | ✅ pass | 180 files, 1398 tests |
| `npm run test:security` | ✅ pass | 10 files, 123 tests |
| `npm run build` | ✅ pass | includes `/labs/soc/[scenarioId]` |
| `npm run test:e2e` | ⚪ **not run** in this audit | needs Playwright and a dev server; 4 SOC specs exist |
| `npm run verify` | ⚪ does not exist | — |

**CI:** `.github/workflows/ci.yml` runs lint first, so **CI is red on `main`**. The actions are tag-pinned (`@v4`), not SHA-pinned. `check:soc*` and `test:security` are not in CI.

---

## 2. Claims vs reality

### A. General passes

| Claim | Status | Evidence |
|---|---|---|
| P1 audit / P2 content accuracy | Done | `9a6019a`, `docs/content-review.md` |
| P3 lab engine integrity | Done | `2cccb9c`…`342d502` |
| P4 Handler hardening | Done | `ba9b847`, `a3dbe74`, `7e5247b`, `9591707` |
| P5 security hardening | Done | `ce3c5de`…`b30bca7`, `docs/security/*`, migration `20261011120000` |
| P6 design system + core screens | Done | `12df02f`…`69e95a7` |
| P7 landing / onboarding / mobile / a11y | Done | `02a38ea`…`3086b32` |
| **P8–P10 combined pass** | **Partial: Stage 1 only** | `docs/ops/progress.md`: Stage 1 (1A–1F: spaced review, mastery, streaks, readiness decay, analytics) is complete (`290ba9c`…`27ecd02`). **Stage 2 (2A–2D: test health, CI/flags/Docker, observability/backup/load, beta invites/feedback) and Stage 3 (3A–3C: backlog closure, manifest, docs, clean-clone) are not started.** Commit `07b3430` "advance to Stage 2" was followed directly by Phase 3 work. |
| Backlog | Stale | `docs/ops/backlog.md`: all 45 items are unchecked, including BL-06…BL-12, which Stage 1 delivered |

### B. Phase 3 prompts

| # | Prompt | Status | Evidence | Gaps found |
|---|---|---|---|---|
| 1 | SOC workspace engine | Done | `3803aea`…`c98c094`; `lib/lab-engine/soc/{engine,evaluator,schema,validator,types}.ts`; `to-client-view.test.ts`; `check:soc`; migration `20261012120000` | DB policy issues S1 and S3 below |
| 2 | Seeded generator + proof toolchain | Done | `55d5ad5`…`c2e23b8`; `generator.ts`, `family-schema.ts`, `family-validator.ts`; migration `20261013000000` | Seed exposure S2 below |
| 3 | L1 families + shift composer | Done | `32cd939`…`336feff`; 9 families in `content/soc/families/`, 4 shifts, `shift-composer.ts`, 14 `labs/soc-*` | Gates pass. Content is unreviewed by a SOC practitioner. |
| 4 | Enrichment / evidence tools | Done | `6833974`…`a039d0a`; `lib/lab-engine/soc/enrichment/*`, 10 panels in `components/labs/soc/enrichment/`, migration `20261013120000` | — |
| 5 | Query language (BladeQL) | **Partial** | `2f7b235`…`c4f579a`; `lib/lab-engine/soc/query/*` (lexer, parser, safe-regex, budgets, questions), migration `20261013180000` | **Owns all 46 lint errors.** Its "full gate" claim did not hold. |
| 6 | Report editor + rubric grader | **Partial** | `32dc119`…`d6dc315`; `lib/lab-engine/soc/reports/*`, `report-engine.ts`, `components/labs/soc/reports/*` (9 components), server actions in `app/(app)/labs/soc/actions.ts`, `scripts/soc-regrade.mts`, migration `20261013200000`, docs `docs/dev/soc-report-grading.md` and `writing-soc-report-truth.md` | See §3 |
| 7 | AI-assisted grading | Not started | no `soc-ai:` commits or files | — |
| A / B / C | Curriculum, mock exam, audit | Not started | — | — |

---

## 3. Prompt 6 (report system): gate-by-gate

| Required gate | Status | Notes |
|---|---|---|
| Lint / build / full test / security suite | Lint ❌ (prompt 5's files); the rest ✅ | |
| E2E | ⚪ exists, not run | `tests/e2e/soc-report.spec.ts`: 1 test, includes an axe scan |
| Grader tests | Thin | `report-grader.test.ts` 6, `report-engine.test.ts` 4 |
| Fixtures at many quality levels × many seeds | Done, with a caveat | `reports/fixtures.ts` (9 tiers) and `report-monotonicity.test.ts` (~1000 seeds). Caveat: fixtures are generated **from the ground truth itself**, so the test proves the grader agrees with its own fixture author, not that it ranks real learner writing correctly. The seed counter also increments before the `continue` that skips incidents without report truth. |
| Planted-flaw tests | Done | `report-planted-flaws.test.ts` (5) |
| No-oracle statistical tests | Done | `report-no-oracle.test.ts` (4) |
| Adversarial API tests | Partial | `soc-report-security.test.ts` (10), all against `MemoryProgressRepo`. The race test only asserts `toBeDefined()`, and the defang test only asserts the value `toBeDefined()`; neither proves anything. |
| User-scoped clients cannot read ground truth | **Not proven at the DB level** | No test runs against Postgres with RLS. The model report is not stored in a table (good). |
| SQL functions reviewed for SECURITY DEFINER / search_path | Done, with a flawed rule | See S4 |
| Migration executed against a database | **No** | The migration header says "Not executed against a live hosted database"; the backlog marks hosted execution deferred (BL-44) |
| Editor UI accessibility | Unverified | Covered only by the single e2e axe check, which was not run |
| Design-skill evidence log | **Missing** | No evidence log in `docs/`. Screenshots exist only for the SOC workspace (390/768/1440), not for the report editor, search tab or enrichment, and they are stored **inside** the repo (`docs/design/screenshots/`), against the rule. |
| Docs | Done | `docs/dev/soc-report-grading.md`, `writing-soc-report-truth.md`, `docs/design/soc-reports.md` |

---

## 4. Security / data findings (needs owner decision before fixing)

Found by reading the migrations. None of these has been run against Postgres yet; S2b follows from documented PostgreSQL privilege rules and should be confirmed on a local instance.

- **S1: Learners can write their own scores (hosted mode).** `soc_attempts` has an owner `FOR ALL` policy (`20261012120000:44`), so a signed-in learner using the Supabase client can `UPDATE status / score_summary` directly. (Prompt 1)
- **S2: Seeds are readable by learners (hosted mode). Breaks rule 2.**
  - (a) `soc_used_seeds` has an owner `FOR ALL` policy (`20261013000000:58`), so learners can `SELECT` their own seeds and regenerate answers offline.
  - (b) `REVOKE SELECT (seed) ON soc_attempts FROM authenticated` (`:65`) is a column-level revoke. It has **no effect** while a table-level `SELECT` grant exists, and Supabase grants that to `authenticated` by default.
  - The same pattern applies to Phase 2: `lab_attempts.seed`.
- **S3: "Immutable submitted report" is not enforced in the DB.** The `soc_report_submissions` owner UPDATE/INSERT policies let a learner edit a submitted row or insert one already marked `status='submitted'`. Immutability is enforced only in app code.
- **S4: The SQL audit rule is backwards and fragile.**
  - `soc-report-security.test.ts` *requires* every function to be `SECURITY DEFINER`. That is the riskier choice: the trigger function `set_updated_at` should be `SECURITY INVOKER`. DEFINER should be reserved for `delete_user_account`-style functions.
  - Its regex uses `\Z`, which JavaScript reads as a literal "Z" (case-insensitive here), so function bodies get cut off at any "z".
- **S5: The report migration is not idempotent.** `CREATE TRIGGER` and `CREATE POLICY` run without `DROP … IF EXISTS`, so a re-run fails. Its rollback also drops the generically named `set_updated_at()`.
- **S6: Account erasure and export are incomplete.**
  - The `delete_user_account()` RPC covers none of the `soc_*`, `review_*` or `exam_reports` tables.
  - *Correction (2026-10-14, Prompt 7 Step 0):* `SupabaseProgressRepo.deleteUserData` uses the **service-role admin client** (`lib/progress/supabase-repo.ts:31`), so RLS does not block those deletes. My earlier claim that they "silently remove nothing" was wrong. Its errors are still unchecked.
  - `exportUserDataAction` exports only `socAttempts`. It omits decisions, report submissions/evaluations, query logs, enrichment lookups and review items.
- **S7 (CRITICAL, found 2026-10-14): investigation questions are verified in the browser, not on the server. Breaks rule 2.**
  - `components/labs/soc/search/SocSearchTab.tsx` (a client component) imports `generateScenarioQuestions` and `submitQuestionAnswer` from `lib/lab-engine/soc/query/questions.ts`, which has no `"use server"`.
  - The answer truths (`serverTruths`), the attempt counter and the rate limit therefore all run in the browser. The string `serverTruths` is present in `.next/static/chunks/`.
  - The browser builds the dataset from a placeholder seed (`"scenario-seed"`), while the server query pipeline uses `attempt.seed`. Questions and the server dataset can therefore disagree.
  - Prompt 5's "server-verified investigation questions" claim does not hold. A fix means moving dataset and question generation behind server actions keyed by `attemptId`.
- **S8 (fixed 2026-10-14):** `recordSocDecision` and one other engine function loaded only static scenario files, so triage decisions threw on every generated family or shift attempt. The `/labs/soc/[id]` route also returned 404 for every family and shift lab. Both are fixed, with a regression test.

---

## 5. Placeholders in the handoff prompt

- Rule 9's design skill path is `[PATH TO YOUR DESIGN SKILL FOLDER]`. Proposed value: `C:\Users\gone0\.claude\skills\` (index in its `README.md`), pending owner confirmation.
- `OWNER CONTEXT` was left as the template text.
- The "status audit and completion" prompt for #6 left no trace in git or docs after `d6dc315`.

## 6. Human verification list

1. Run `npm run test:e2e` locally. It was not run in this audit.
2. Confirm S2b on a local Supabase: as `authenticated`, run `select seed from soc_attempts`.
3. Decide whether S1–S6 are fixed now (before prompt 7) or batched into Prompt C.
4. Confirm the design skill path and the owner-context line.
5. Before any beta, a working SOC analyst should review the 9 families and the report rubric.

## 7. Status after Prompt 7 (2026-10-14)

| Finding | Status |
|---|---|
| S1 learner can write own SOC scores (hosted RLS) | **Open**, needs a policy-tightening migration |
| S2 seeds readable (`soc_used_seeds`, column REVOKE ineffective) | **Open**, needs a migration + seed-free projections |
| S3 submitted reports editable via direct client access | **Open** |
| S4 SQL audit rule backwards / broken regex | **Fixed** (`1225980`): pinned search_path + explicit mode required; DEFINER allowlisted |
| S5 report migration not idempotent | **Open** (applied migrations must not be edited; fix with a follow-up migration) |
| S6 deletion/export gaps | **Partly fixed**: AI tables covered; older SOC tables still missing from the RPC/export |
| S7 question truths verified client-side | **Open, critical**, needs server-side questions (`serverTruths` still in `.next/static`) |
| S8 decisions on generated attempts + 404 routes | **Fixed** (`33305f5`) |

## 8. Status after the security-closure prompt (2026-10-14)

| Finding | Status | Commit | Regression test |
|---|---|---|---|
| S7 question truths client-side | **Fixed** | `2a2e2e3` | `tests/unit/lib/lab-engine/soc/question-service.test.ts`; `tests/security/bundle-scan.test.ts`; `tests/e2e/soc-no-leaks.spec.ts` |
| S2 seeds readable / passed to client | **Fixed** | `2a2e2e3` (client prop), `2a9ead8` (DB), `60b62de` (scan) | `tests/db/access-hardening.test.ts` (secrets block); e2e live seed check |
| S1 learners write grading data | **Fixed** (incl. Phase 2 lab/lesson/XP/challenge tables) | `2a9ead8` | `tests/db/access-hardening.test.ts` (17 write refusals) |
| S3 submitted reports editable | **Fixed** (trigger, every role) | `2a9ead8` | same file |
| S5 report migration not re-runnable | **Fixed** (unexecuted migration edited per owner instruction) | `2a9ead8` | re-run of all post-Phase-2 migrations |
| S6 erasure/export gaps | **Fixed** | `2a9ead8`, `faf51cf` | `tests/security/learner-export-privacy.test.ts`; PGlite erasure check |
| S4 function security modes | **Fixed** (2 allowlisted DEFINER functions) | `2a9ead8` | static audit + PGlite `pg_proc` check |

Holes found by the PGlite checks: column-level `REVOKE SELECT (seed)` was a no-op (S2b confirmed); learners could insert `is_correct=true` question attempts (would have defeated S7); Phase 2 `lab_attempts.objectives_solved`, `lesson_progress`, `rank_challenges` were learner-writable; `20261010000000` (Phase 2 initial schema) is not re-runnable (left unedited: possibly applied in a hosted project).
