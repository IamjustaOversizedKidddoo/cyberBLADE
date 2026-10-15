# SOC track L1 independent audit

Date: 2026-10-15. Auditor: independent, cold read of code, tests, content and migrations (build notes in `docs/ops/progress*.md` not read). Read-only except this file. Nothing was run against a hosted database; database checks used PGlite with all migrations (`tests/db/supabase-emulation.ts`). Not run by rule: build, e2e, dev/start servers.

Commands run: `npx tsc --noEmit` (exit 0), `npm run check:content` (OK, 1 warning: `soc-l1-email-headers-01` 21 min), `npm run check:soc` (OK, 1 scenario), `npm run scan:bundle` (OK, 79 artifacts, existing `.next`), `npx vitest run tests/security tests/db tests/unit/lib/lab-engine/soc/cross-family-pooling.test.ts` (17 files, 240 tests passed), `npm audit --omit=dev` (4 moderate), `git log --all -p -G<pattern>` secret scans, plus inline `npx tsx -e` probes (no files written) for leaks, tells, determinism, RLS and exercise checkers.

"verified" = reproduced by a command or an unambiguous code path; "suspected" = reasoned, not reproduced.

## Summary

| ID | Severity | Area | Title | Status | Effort |
|---|---|---|---|---|---|
| L1-A-04 | Critical | Exam integrity / RLS | Learner reads `is_correct` of exam answers mid-exam via Supabase REST | verified (PGlite) | S-M |
| L1-A-05 | Critical | Exam integrity / export | "Export my data" returns `correct` for exam answers mid-exam (local and hosted) | verified (code) | S |
| L1-A-01 | High | Leaks | Family id, attack-chain title and half the seed reach the client | verified | S |
| L1-A-03 | High | Tells | IOC presence predicts true positive with 100% precision | verified | M |
| L1-A-09 | High | Tells (pooled) | Rule name fixes the verdict across seeds; TP IOCs from a 43-value pool | verified | M-L |
| L1-A-10 | High | Exam integrity | Practice attempt + debrief of the same family allowed during an active exam | verified (code) | S |
| L1-A-02 | Medium | Exam integrity | Exam variant (family id) and family title sent to the browser during the exam | verified | S |
| L1-A-06 | Medium | Flags / access | Workspace flag off hides pages but not the server actions | verified | S |
| L1-A-07 | Medium | Flags / coherence | Lessons and paths link into a "FEATURE FLAG" shell when workspace/enrichment are off | verified | S-M |
| L1-A-08 | Medium | Tests | Root causes of e2e load-sensitivity (lost updates, hydration race, global JSON lock) | verified (reading) | M |
| L1-A-11 | Medium | Determinism | No hash check for shift attempts; no published-version pinning | verified | M |
| L1-A-12 | Medium | Input validation | Report actions take `reportData`/`templateId` without a schema | verified (code) | S |
| L1-A-13 | Medium | Handler | General Handler forwards client `system` history messages to Groq | verified (code) | S |
| L1-A-14 | Medium | CSP | `script-src 'unsafe-inline'` in production | verified | M |
| L1-A-15 | Medium | Accessibility | SOC dialogs lack focus trap/return and Escape | verified (static) | M |
| L1-A-16 | Low | Leak scans | Scans/tests do not cover dynamic RSC/action payloads | verified | M |
| L1-A-17 | Low | Exercises | Checker rejects some legitimate variants (defanged IP, time formats) | verified | S |
| L1-A-18 | Low | Design | Missing design evidence entries for most SOC screens | verified | M |
| L1-A-19 | Low | Git hygiene | 31 screenshots (~11.4 MB) tracked under `docs/` | verified | S |
| L1-A-20 | Low | Abuse | Rate limits, budgets and locks are per process | verified | M |
| L1-A-21 | Low | Supply chain | npm audit: 4 moderate via gray-matter | verified | S |
| L1-A-22 | Low | Docs | Documented npm scripts missing (`verify` and 4 others) | verified | S |
| L1-A-23 | Low | Exports | CSV escaping misses tab/CR | verified | S |
| L1-A-24 | Info | Truthfulness | Claims-log triage; no forbidden claims in SOC surfaces | verified | - |
| L1-A-25 | Info | Misc | Dead `lintSocReport`, `check:soc` scope, Handler context notes | verified | - |

Counts: Critical 2, High 4, Medium 9, Low 8, Info 2.

## Checked and OK

- Exam clock is server-side: deadline stored at start, every write checks `examTimeIsOver` against the server clock (`exam/guard.ts:27-35`); client clock changes do nothing.
- Two tabs / double start: unique partial index `soc_exam_attempts_one_active` + advisory-locked `soc_start_exam_attempt` (service role only, SECURITY INVOKER, pinned `search_path`); local store checks inside its serialized update.
- Refresh mid-exam: state is rebuilt from the server; expired exams finalize on the next read (`service.ts:159-162`, `getActiveExam`).
- Replayed/double submit: `finalizeOnce` + conditional repo finalize; XP source unique per exam (`service.ts:248-350`).
- Late work: decisions, cases, lookups, queries, question answers and report drafts are refused after the deadline; finalize keeps only rows created before the deadline.
- Handler during an exam: both entry points lock out server-side (`soc-mode.ts:64`, `handler/actions.ts:90`) before any context is read; SOC Handler context holds only client-visible alert fields and the learner's own work.
- Exam answer responses are uniform (same shape for right and wrong; answer-time floor), knowledge options use seeded hashed ids so order/index reveal nothing; the post-submit review is server-rendered.
- Exam budgets are enforced per kind with in-flight reservation (single instance); duplicate lookups are free and not double-counted.
- Practice exam start of `exam-` ids, submit/abandon of exam SOC attempts, practice report submit on exam attempts, model reveal and grading result before exam submission are all refused (`engine.ts:107,400,449`, `report-engine.ts:26-28,224`).
- RLS: every SOC and exam table has RLS on; learners have SELECT only on their own rows; no learner INSERT/UPDATE/DELETE policy on grading data; seeds and `scenario_hash` columns not granted; AI raw outputs/jobs/review items/usage not readable; all SQL functions SECURITY INVOKER with pinned `search_path` except `delete_user_account` (SECURITY DEFINER, justified, owner/service-role check, pinned path). Existing two-user PGlite tests pass.
- Deletion covers every SOC/exam/AI table in both the SQL function and the local store; export is allowlisted (no seeds, hashes, ground truth, raw AI outputs) apart from L1-A-05.
- Determinism: identical hashes across two processes and two time zones for a family variant, a shift, its investigation dataset and question set.
- Lessons: 42 SOC L1 lessons, all `status: draft`, all rank 1; every prerequisite exists, is rank 0/1 and comes earlier in track order. No true-positive IOC value from 440 generated variants appears in any lesson, exercise or the knowledge bank.
- With `SOC_QUERY_ENABLED` off: drill cards are hidden on lessons and paths, path times exclude drill steps, study plans drop drill targets, drill pages 404 and drill/query actions refuse.
- Secrets: no `gsk_`, `AIza`, `sk-`, `sk-ant-`, JWT, `service_role` key, Razorpay key or private-key block in any added line of git history; only `.env.example` (placeholders) is tracked.
- Client bundle scan of the current build: no leaks; no source maps emitted (`.next/static/**/*.map`: 0).
- Report text sanitizer strips HTML, images, control chars and guards CSV formulas; BladeQL regex forbids backreferences/lookaround; query input is schema-parsed and rate-limited.
- Generated flashcards (`lib/review/track-cards.generated.ts`: 169) match the 169 cards on disk.
- Typecheck clean; content gate clean.

## Findings

### L1-A-01 · High · Leaks · Family/shift id, attack-chain title and half the seed reach the client in every generated scenario (verified)
- Evidence: `lib/lab-engine/soc/generator.ts:693` sets `id: ${family.metadata.id}-${seed.slice(0, 8)}` and `:695` `title: ${family.metadata.title} (Variant ${seed.slice(0, 6)})`; `lib/lab-engine/soc/schema.ts:238-245` `toClientView` copies `id`, `title`, `skillsTested`. Ran an inline tsx check on `soc-f-phishing-cred-01` with seed `0123456789abcdef`: client view contains `soc-f-phishing-cred-01-01234567` and title `L1: Phishing to Credential Compromise & Session Hijacking (Variant 012345)`; both `seedprefix: true famid: true`. `components/labs/soc/SocWorkspace.tsx:223` and `ShiftBriefingModal.tsx:34` render the title.
- Why it matters: rule 2 (seeds and family internals never reach the client). Seeds are 8 bytes (`lib/generators/rng.ts:61-64`) and the RNG state is only 32 bits (`createRng` = `mulberry32(xmur3(seed)())`), so the leaked 32-bit prefix plus server content makes offline regeneration of ground truth a small search if family YAML/generator ever become readable. In exams (below, L1-A-02) the title states the incident category outright. Existing guard `scanClientViewLeaks` (`lib/lab-engine/soc/family-validator.ts:684`) and `tests/security/soc-security.test.ts:281` only look for the full seed string, so the prefix passes.
- Fix: build client `id` from an opaque HMAC of (attemptId) or just the attempt id; drop the seed suffix from titles; for exam attempts replace `title`/`skillsTested`/`id` with neutral values ("Investigation exam"); extend the leak scanner to deny any 8+ char substring of the seed and any `soc-f-`/`shift-` id.
- Effort: S

### L1-A-02 · Medium · Exam integrity · Exam variant (family id) and family title sent to the browser during an active exam (verified)
- Evidence: `lib/lab-engine/soc/exam/service.ts:202` returns `variantId` (e.g. `soc-f-outbound-exfil-01`, `content/soc/exams/config.yaml` investigation variants) in `ExamStateView`; `app/(app)/labs/soc/exams/[examId]/page.tsx:23` passes the whole state to the client component `ExamRunner` (RSC payload) and `startSocExamAction`/`getSocExamStateAction` return it. The SOC session for the exam attempt carries the family title (L1-A-01).
- Why it matters: the investigation exam asks the learner to work out the incident type; the payload and header tell them ("Suspicious Outbound Egress, C2 Beaconing & Exfiltration").
- Fix: omit `variantId` from `ExamStateView` while `status === "active"` (UI does not use it); neutralise scenario title/briefing for exam attempts in `getSocSession`.
- Effort: S

### L1-A-03 · High · Oracles/tells · IOC presence on an alert predicts "true positive" with 100% precision (families and shifts) (verified)
- Evidence: inline tsx run over all 9 families x 15 seeds (6,075 alerts): `ioccount:0` -> 4,245 benign, 810 duplicate, 645 FP, 60 TP; `ioccount>=1` -> 315 TP, 0 anything else. Shifts (4 x 10 seeds): `ioccount>=1` -> 113 TP, 0 others. Also `sev:LOW` never TP (2,475 alerts), `linked:2` only TP/FP, rawField key `operation` never on a TP (1,770). The tell detector `detectTells` (`lib/lab-engine/soc/family-validator.ts:608-617`) only checks summary length, capitals, rawField count, queue position, has-asset/user and id length, so `tests/unit/lib/lab-engine/soc/cross-family-pooling.test.ts:28` passes while this tell exists.
- Why it matters: rule 2 "identical code paths (no tells)". A learner (or exam candidate on alert-queue/investigation) can score most TPs by "has an IOC chip -> escalate", without investigation.
- Fix: attach decoy/benign IOCs (reserved-range IPs, benign domains from `vocab/benign-catalog.yaml`) to benign/FP alerts through the same alert builder, and let some TPs carry 0 IOCs; add extractors to `detectTells` for `relatedIocs.length`, `linkedRawEvents.length`, `severity`, and per rawField key presence (one-hot) and key=value pairs; fail pooled test above 0.72 balanced accuracy.
- Effort: M

### L1-A-04 · Critical · Exam integrity / access control · Learner can read `is_correct` of their exam question answers before submission via the Supabase REST API (verified, PGlite)
- Evidence: exam answers are marked at save time: `lib/lab-engine/soc/query/question-service.ts:174` stores `isCorrect: verifyAnswer(...)` while the response is neutral (`:181`). `supabase/migrations/20261014180000_phase_3_access_hardening.sql:78-83` grants table-level `SELECT` on `soc_question_attempts` (incl. `is_correct`) to `authenticated`, with an owner-only policy. Inline tsx run on PGlite with all migrations, as an authenticated learner with an `active` investigation exam: `SELECT question_id, submitted_answer, is_correct FROM soc_question_attempts` -> `{"question_id":"q-1","submitted_answer":"203.0.113.9","is_correct":true}`; the same session also reads `soc_exam_attempts.variant_id` and `soc_attempts.family_id` = `soc-f-outbound-exfil-01`. The anon key ships to the browser and `lib/supabase/client.ts:14` uses `createBrowserClient`, so a learner can lift their own access token from cookies/dev tools and call `/rest/v1/soc_question_attempts`.
- Why it matters: rule 2 "no correctness oracle before submission". With 20 question answers per exam (`content/soc/exams/config.yaml`), the learner can answer, check `is_correct`, and re-answer until right; "latest answer counts" (`lib/lab-engine/soc/exam/results.ts:109-113`) then scores it. Same oracle in practice mode is harmless (feedback is given anyway) but the exam claim "nothing is marked during the exam" is false in hosted mode. The local store path is not affected (no REST surface).
- Fix (pick one, both is best): (a) store exam answers without marking (`is_correct` NULL or false) and mark all of them inside `finalizeOnce` from `submitted_answer`; (b) column-level grant on `soc_question_attempts` that omits `is_correct` (as done for seeds) and add `variant_id`/`family_id` to the not-granted list while an exam is active (or drop those columns from the grants and serve them via the server). Add a PGlite test: learner with an active exam cannot read `is_correct`, `variant_id`, `family_id`.
- Effort: S-M

### L1-A-05 · Critical · Exam integrity / leaks · "Export my data" returns `correct` for exam question answers (and the exam `variantId`) while the exam is still running, in both local and hosted mode (verified by code reading)
- Evidence: `lib/identity/privacy-actions.ts:14-19` (`exportUserDataAction`, browser-callable, no exam check, no rate limit) -> `lib/identity/learner-export.ts:23,46` maps every SOC attempt (exam attempts included, no status filter) to `questionAnswers: { answer, correct: q.isCorrect }`, and `:82` exports `variantId` for active exams.
- Why it matters: second pre-submission correctness oracle (independent of L1-A-04 and of the database host): answer -> export -> check `correct` -> re-answer within the 20-answer budget. Also reveals the family id.
- Fix: in `buildLearnerExport`, for SOC attempts whose exam is `active` (or any `exam-` attempt whose exam is not submitted) omit `correct`, `score` and `variantId` (or refuse the export with "available after you submit your exam"); with L1-A-04 (a), `is_correct` is not set until submission anyway. Rate-limit the export action. Add a unit test: active exam + exported data contains no `correct` key for that attempt.
- Effort: S

### L1-A-06 · Medium · Flags / access control · `SOC_WORKSPACE_ENABLED=false` hides pages but not the workspace server actions (verified)
- Evidence: `app/(app)/labs/soc/actions.ts` (start, decide, case, submit, abandon, report draft/submit/result/model reveal) never calls `isSocWorkspaceEnabled()`; only `lookupSocEnrichmentAction` checks its flag (`:160`). `app/(app)/labs/soc/query-actions.ts` checks only `SOC_QUERY_ENABLED`, `handler-actions.ts` only `SOC_HANDLER_ENABLED`. The page `app/(app)/labs/soc/[scenarioId]/page.tsx:37` is the only workspace gate. Flags default off in production (`lib/config/env.ts:50-56`).
- Why it matters: the production kill-switch is cosmetic; action ids ship in the client bundle, so a learner (or script) can create attempts, run reports (and AI grading enqueue) while the owner believes the feature is off.
- Fix: add `assertSocWorkspaceEnabled()` at the top of every export in `actions.ts` and `query-actions.ts`/`handler-actions.ts`/`ai-actions.ts` (query/handler also require workspace on). Add a unit test that every exported action in `app/(app)/labs/soc/**` throws with the flag off.
- Effort: S

### L1-A-07 · Medium · Flags / coherence · With the workspace (or enrichment) flag off, SOC lessons and practice paths still link into the workspace, which renders a "FEATURE FLAG ... contact your administrator" shell (verified)
- Evidence: `app/(app)/learn/[lessonId]/page.tsx:59-64` filters only `kind === "drill"` cards; scenario/shift/tool/report cards (`lib/content/practice.ts:53-69`, all `href: /labs/soc/...`) stay. Same in the track page paths (`app/(app)/learn/soc-l1/page.tsx:108,130` filter drills only). Target shell: `app/(app)/labs/soc/[scenarioId]/page.tsx:37-58` shows `FEATURE FLAG: SOC_WORKSPACE_ENABLED = FALSE` and staff-facing copy. Path times include those hidden-in-effect steps. Tool cards (`practice.ts:63`) link to the workbench even when `SOC_ENRICHMENT_ENABLED` is off. Exam lobby `getExamLobby` (`lib/lab-engine/soc/exam/service.ts:423`) marks scenario formats `available` even when the workspace is off, so Start fails with a thrown error (`exams/actions.ts:40`); study plan points to `#mini-queue` which then cannot start.
- Why it matters: in the production default (workspace off) every SOC lesson's "practice" block and every path is a dead end; learner-facing copy leaks an env var name.
- Fix: one `practiceAvailability()` helper (workspace, enrichment, query flags) used by the lesson page, track paths, `pathMinutes`, study plan and lobby (`available: false, unavailableReason: "Not open yet"`); replace the shell copy with a neutral learner message.
- Effort: S-M

### L1-A-08 · Medium · Tests / flakiness · Root causes of load-sensitivity in `soc-enrichment.spec.ts` and `rank-2-web.spec.ts` (verified by reading; not executed per audit rules)
Root cause 1 (rank-2, both tests): the test process writes the server's live data files behind its back.
- `tests/e2e/helpers/rank0.ts` `promoteToRank` (read-modify-rename of `.data-e2e/operators.json`) and `unlockRankChallenge` (`:152-190`, read-modify-write of `.data-e2e/progress.json`) take a `mkdir` lock (`withFileLock`) that the server never takes. The server's `createJsonStore.update` (`lib/storage/json-store.ts:84-90`) serialises only inside its own process: load -> mutate -> rename. Any server write that loaded the file before the test's rename and saves after it silently drops the test's edit (lost update). `progress.json` is rewritten by every SOC/lesson action of the other worker (and of the mobile project), so under load the unlocked lessons vanish and `rank-2-web.spec.ts:78` ("Start the challenge") or the `Rank 2` check at `rank0.ts` end time out. Raising timeouts cannot fix a lost write.
- Fix: never edit server files from tests. Add a test-only server route/action guarded by `CYBERBLADE_ALLOW_LOCAL_E2E` (already set in `playwright.config.ts`) that calls `operators.setRank()` / `repo.saveLessonProgress()` through the same in-process queue, or drive the real UI path. If a file edit is unavoidable, stop the server writes via a per-test data dir.
Root cause 2 (rank-2 test 1): `answerAllChecks` (`tests/e2e/helpers/checks.ts:4-8`) clicks radios and "Check answer" right after `rank-2-web.spec.ts:21` waits only for the SSR heading, so under load the click can land before hydration (no handler, `data-attempts` never increments; 5 s default). Fix: wait for a hydration signal (e.g. `data-hydrated` on the lesson root, or `expect(button).toBeEnabled()` where the button is disabled until mounted) before interacting.
Root cause 3 (soc-enrichment): every repo read and write goes through one per-file promise queue over a single, ever-growing `progress.json` (`json-store.ts:84-90`; `read` is serialised too), and global setup wipes data only once per run (`tests/e2e/global-setup.ts`). Each lookup does 3+ full-file parse/serialise cycles (`enrichment/pipeline.ts:47,69,120`), so latency scales with run length x concurrent workers. The spec then uses fixed waits that assume a fast server: `soc-enrichment.spec.ts:101-102` waits for the first alert row with the default 5 s while test 1 allows 15 s (`:26`) for the same `startSocSessionAction`; `:74` 10 s for a lookup result. Additionally `:34-41` uses a non-waiting `isVisible()` branch, and `getByRole("button", { name: /Investigate/i }).first()` matches both the header launcher (`SocWorkspace.tsx:293`) and the alert-panel button (`AlertDetailPanel.tsx:123`, which pre-fills and runs its own lookup), so which lookup renders last depends on timing. `beforeEach` handles `soc_analyst_${Date.now() % 1_000_000}` can collide across the two projects started in the same ms.
- Fix: (a) store: make `read()` lock-free (rename is atomic) and keep an mtime-validated in-memory copy, or move e2e to a store per worker; (b) spec: first wait for the session (`await expect(page.getByText("SOC//WORKSPACE")).toBeVisible()` in both tests, or `page.waitForResponse` on the start action), target the header launcher by its title (`getByTitle("Open Investigation Workbench (i)")`) instead of `.first()`, drop the `isVisible()` branch, and assert on the lookup response (`waitForResponse`) before checking text; use `crypto.randomUUID()` slices for handles.
- Effort: M

### L1-A-09 · High · Oracles/tells (pooled) · Rule name determines the disposition across variants, and true-positive IOCs come from a tiny fixed pool (verified)
- Evidence: inline tsx over 9 families x 10 seeds: 66 of 73 rule names map to exactly one disposition across all seeds (e.g. all 9 rules in `soc-f-brute-force-auth-01`, all 13 in `soc-f-mixed-signal-01`, 8/8 in `soc-f-attachment-script-01`). Over 9 families x 40 seeds + 4 shifts x 20 seeds, true-positive alerts used only 43 distinct IOC values in total (pools in `content/soc/vocab/iocs.yaml`, e.g. 5 IPs per pool).
- Why it matters: rule 2 (no tells, pooled across families/shifts/dataset). After one practice debrief per family a learner has a lookup table "rule name -> verdict" and a list of "bad" IOCs that carries over to every new seed and to exams; variety is cosmetic. The existing pooled check cannot see this (feature list in `family-validator.ts:608-617`).
- Fix: give each rule both TP and benign/FP instances across seeds (the same `ruleName` must be produced by malicious and benign templates, with the deciding evidence in fields/raw events); generate IOCs per seed from the reserved ranges (e.g. random host in 198.51.100.0/24, random label under `.example`) instead of fixed pools; add pooled detectors for `ruleName`, `source+ruleName`, and IOC-value reuse across seeds (fail if any IOC value appears as TP in more than N% of variants).
- Effort: M-L

### L1-A-10 · High · Exam integrity · During an active exam the learner can start and submit a practice attempt of the same family/shift and read its full debrief (verified by code reading)
- Evidence: `lib/lab-engine/soc/engine.ts:100-107` `startSocSession` refuses only `exam-` scenario ids; there is no `getActiveExam` check (unlike the Handler: `lib/handler/soc-mode.ts:64`, `app/(app)/handler/actions.ts:90`). `submitSocAttemptAction` (`app/(app)/labs/soc/actions.ts:137`) then returns the evaluation with per-alert correct dispositions; practice question answers reveal debriefs/reference queries after 3 tries (`query/question-service.ts:62-69`); `getSocReportModelRevealAction` shows the model report. The exam variant is visible (L1-A-02/L1-A-04) and the exam lobby rules promise "no right/wrong, no hints, no debriefs" (`app/(app)/labs/soc/exams/page.tsx:20`).
- Why it matters: with L1-A-09, a practice run of the same family/shift during a 75-150 minute exam yields the verdict for most exam alerts.
- Fix: in `startSocSession`, `submitSocAttempt`, practice `submitInvestigationAnswer`, report submit/model reveal and drill actions, refuse with "Finish your exam first" when `getActiveExam(ctx, userId)` is non-null (same server-side lockout pattern as the Handler). Add a unit test per entry point.
- Effort: S

### L1-A-11 · Medium · Determinism / immutability · Shift attempts have no scenario-hash check and no published-version pinning exists for families or shifts (verified)
- Evidence: `lib/lab-engine/soc/engine.ts:82-86` regenerates shift attempts with `composeShiftScenario` and never compares `attempt.scenarioHash` (families do, `:92-94`). No test or registry pins `family@version` -> content hash (searched `tests/unit/lib/lab-engine/soc/*`); `computeScenarioHash` (`generator.ts:731-751`) covers only rule/time/asset/disposition/incident title, not IOC values, raw events or field values. Cross-process determinism itself is good: same hashes in two processes with different TZ for a family variant, a shift, its investigation dataset and questions.
- Why it matters: rule 3 (published versions immutable). Editing a shift or any family it composes silently re-grades open and submitted shift and exam attempts against different ground truth; editing a family without a version bump makes existing family attempts throw "Scenario hash mismatch" (learner data no longer opens, rule 1).
- Fix: check the hash for shift attempts too; hash the full client view + ground truth; add `content/soc/published-hashes.json` (family/shift id@version -> hash of a fixed reference seed) and a test that fails when content changes without a version bump; keep old versions loadable.
- Effort: M

### L1-A-12 · Medium · Abuse / input validation · Report draft/submit actions take `reportData` and `templateId` without a schema (verified by code reading)
- Evidence: `app/(app)/labs/soc/actions.ts:197-228` passes `reportData: SocReportData` and `templateId` straight through (TypeScript types are not runtime checks). `lib/lab-engine/soc/report-engine.ts:34-90` `sanitizeReport` dereferences `report.header`, `report.verdict`, `report.scope`, `report.escalation` (a missing object throws a TypeError, i.e. an unhandled 500 rather than a validation error), spreads arbitrary client keys into stored rows (`...row`, `...ioc`, `...t`, `...a`, `...ev`), stores `caseId`, `createdAt`, enum fields and IOC `value` unvalidated, and caps no string length or array size. Unknown `templateId`s fall back to the L1 template (`reports/templates.ts:40-52`) but are stored as given, and "already submitted" is checked per `templateId` (`report-engine.ts:118,159,244`), so one attempt can be submitted and graded any number of times under new ids (each also enqueues AI grading, bounded only by the per-user daily cap).
- Why it matters: rule 7 (schema-validate every route input, size limits); storage bloat inside the 1 MB action limit; repeated grading of one practice attempt.
- Fix: a zod `socReportDataSchema` (strict objects, enum checks, per-field `max()`, `timeline/iocs/actions/techniques/evidenceAppendix` `.max(50)`), `templateId: z.enum([...known template ids])` in the actions, and reject unknown templates in the engine.
- Effort: S

### L1-A-13 · Medium · Handler (general, used on SOC lessons) · Client-supplied history may contain `system` messages, which the Groq provider forwards as system prompts (verified by code reading)
- Evidence: `app/(app)/handler/actions.ts:14-15` allows `role: "system"` in `history`; `lib/handler/service.ts:83` keeps it; `lib/handler/providers/groq.ts:72-73` sends `history.map((m) => ({ role: m.role, ... }))` after the real system prompt. SOC mode strips it (`lib/handler/soc-mode.ts:79`), the general Handler on SOC lesson pages does not.
- Why it matters: a learner can add instructions with system authority (scope/guardrail bypass, e.g. real-world targeting help the Handler must refuse). Output sanitisation still guards lab flags, so this is a guardrail weakness, not an answer leak. Rule 1 says Handler guardrails change only on request, so this is reported, not fixed.
- Fix: `role: z.enum(["user", "assistant"])` in `messageSchema` (same as SOC mode), and map any non-user/assistant role to `user` inside providers.
- Effort: S

### L1-A-14 · Medium · CSP · Production CSP allows `script-src 'unsafe-inline'` (verified)
- Evidence: `proxy.ts:71` `script-src 'self' 'unsafe-inline'` in all environments (only `unsafe-eval` is dev-only).
- Why it matters: rule 9 (CSP overrides decoration); inline-script allowance removes most XSS protection on pages that render learner and generated text (reports, rationales, Handler replies).
- Fix: per-request nonce in `proxy.ts` (`script-src 'self' 'nonce-<n>' 'strict-dynamic'`), pass it via header so Next applies it to its inline bootstrap scripts (see the Next 16 CSP guide under `node_modules/next/dist/docs/`); keep `'unsafe-inline'` for `style-src` only. Verify with the e2e suite.
- Effort: M

### L1-A-15 · Medium · Accessibility · SOC modal dialogs declare `aria-modal` but most have no focus move, focus trap, focus return or Escape (verified statically; not run in a browser)
- Evidence: `role="dialog"` + `aria-modal="true"` without Escape handling or focus management in `components/labs/soc/ShiftBriefingModal.tsx:17-21`, `ShiftResultsModal.tsx`, `reports/PreSubmitLintModal.tsx:25-28`, `reports/EvidencePickerDrawer.tsx`, `reports/ReportExport.tsx`, `search/TeachingPanelsModal.tsx`; `enrichment/EnrichmentWorkbenchDrawer.tsx` has focus code but no Escape of its own. The workspace-level Escape (`SocWorkspace.tsx:81-85`) closes only help, briefing, submit-confirm and the workbench.
- Why it matters: rule 8 (keyboard complete). Keyboard and screen-reader users can tab behind a modal that claims to be modal, and the report modals cannot be closed with Escape.
- Fix: one shared `<Modal>` (native `<dialog>` with `showModal()` gives trap, Escape and top-layer for free; restore focus to the opener on close) and use it for all eleven SOC dialogs; add a Playwright keyboard test per dialog.
- Effort: M

### L1-A-16 · Low · Leak-scan coverage · `scan:bundle` and the leak tests do not see dynamic RSC/server-action payloads (verified)
- Evidence: `npm run scan:bundle` -> "OK: 79 client artifacts, no leaks", yet L1-A-01/02 leak through authenticated, dynamically rendered responses that are never written to `.next`. `lib/security/bundle-scan.ts` scans only build output; `seed-in-payload` matches only a `"seed":` key, not seed substrings; no rule for `soc-f-`/`shift-` ids. `tests/security`, `tests/db` and the pooled-tell test all pass (`npx vitest run tests/security tests/db .../cross-family-pooling.test.ts`: 17 files, 240 tests passed) while L1-A-01..05 exist.
- Fix: add a vitest "response scan" that calls each SOC/exam server action and page loader against the local store and runs `LEAK_RULES` plus dynamic deny-lists (the attempt's seed and any 8+ char substring, family/shift ids during exams, `is_correct`/`correct` before submission) over the serialized result.
- Effort: M

### L1-A-17 · Low · Exercises · Checker rejects some legitimate answer variants (verified with an inline run over all 140 SOC exercise questions)
- Evidence: all 140 accept their own answer with extra spaces/case where `case` is on, reject empty answers, reject other options and truncated answers. Variants rejected: `27-credential-attacks.exercises.yaml#brute` (`192.0.2.100`) has no `refang` rule, so `192.0.2[.]100` (the defanged form the track teaches) is marked wrong; `04-alert-anatomy.exercises.yaml#utc-time` accepts only `19:42` (not `19:42 UTC` or `19:42:00`); `21-process-creation.exercises.yaml#parent-of-js` accepts only `mailclient.exe`.
- Fix: default `normalize` to include `refang` for every IP/domain answer (lint it), and add accepted variants for times and process names.
- Effort: S

### L1-A-18 · Low · Design evidence · Several SOC screens have no evidence-log entry (verified)
- Evidence: `docs/design/evidence/` has only `soc-ai-feedback.md`, `soc-curriculum-lessons.md`, `soc-exams.md`. No evidence entries (390/768/1440 + self-critique) for the workspace, enrichment workbench, search/BladeQL tab, query drills, report editor, Handler panel or readiness page; the design docs for those (`docs/design/soc-workspace.md`, `soc-enrichment.md`, `soc-query-language.md`, `soc-reports.md`) contain no screenshot references or critique. `soc-exams.md` evidence has no self-critique section.
- Fix: add one evidence file per screen per rule 9 (screenshots stored outside the repo, linked by path).
- Effort: M

### L1-A-19 · Low · Git hygiene · 31 screenshots (about 11.4 MB) are tracked under `docs/` (verified)
- Evidence: `git ls-files docs` -> 19 in `docs/design/screenshots`, 6 in `docs/visual/before`, 6 in `docs/visual/after`; largest `docs/visual/after/landing-desktop.png` 3.1 MB. Rule 9 says evidence screenshots live outside the repo. No `.env`, key or certificate files are tracked (only `.env.example` with placeholders).
- Fix: `git rm --cached -r docs/design/screenshots docs/visual`, add both to `.gitignore`, keep them in the owner's evidence folder (history rewrite optional).
- Effort: S

### L1-A-20 · Low · Abuse · Rate limits, exam budget reservations and per-question locks are per process (verified, documented as shortcuts)
- Evidence: `lib/progress/rate-limit.ts:2,10` in-memory map; `exam/guard.ts:48-50` and `query/question-service.ts:75-77` note the in-process limits. The IP key trusts the first `x-forwarded-for` entry (`app/(app)/labs/soc/handler-actions.ts:27`). On serverless hosting each instance has its own counters.
- Fix: before the hosted launch, move the counters to Postgres (`INSERT ... ON CONFLICT` with a window) or a KV store, and take the client IP from the platform header.
- Effort: M

### L1-A-21 · Low · Supply chain · `npm audit --omit=dev`: 4 moderate (verified)
- Evidence: chain `gray-matter` -> old `js-yaml` 3.x -> `argparse` 1.x -> `sprintf-js`; no high/critical.
- Fix: replace `gray-matter` with the already-installed `yaml` package for front matter (two call sites), or pin a patched fork.
- Effort: S

### L1-A-22 · Low · Docs · Documented commands that do not exist in `package.json` (verified)
- Evidence: `npm run verify` (`docs/ops/standing-rules.md`, `docs/ops/handoff-status.md`), `soc:ai:gate` (`docs/design/soc-ai-grading.md`), `soc:calibrate` (`docs/design/soc-reports.md`), `soc:curriculum:times` (`docs/design/soc-curriculum.md`), `report:manifest` (`docs/ops/backlog.md`).
- Fix: add the scripts (at least `verify` chaining the rule 8 gates) or correct the docs.
- Effort: S

### L1-A-23 · Low · Exports · CSV escaping in the PCAP flow export misses tab/CR and CR-in-cell quoting (verified)
- Evidence: `components/labs/soc/enrichment/PcapFlowEvidencePanel.tsx:17-28` guards `= + - @` only and quotes on `,` `"` `\n` (not `\r`). Report text uses the stricter `sanitizeReportText` (`reports/sanitizer.ts:27`, includes `\t\r`). Data is synthetic, so impact is low.
- Fix: reuse one `csvCell()` helper with `^[=+\-@\t\r]` and quote on `[",\r\n]`.
- Effort: S

### L1-A-24 · Info · Truthfulness · Claims log triage (`docs/ops/soc-curriculum-claims.md`)
- "unsure": #77 only (L1 roles involve shift work; progression paths; "no single source was checked").
- "certain"/"fairly sure" without an external source: #10 (certain; reasoning claim), #15, #17, #20, #29, #38, #53 (fairly sure; general behaviour, no reference), #50 (certain; "default access-log formats", no link). Repo-verified simulator claims (#31-33, 41, 43, 52, 55, 57, 61, 63, 65, 66) cite files.
- Forbidden-claim grep over app/components/content/lib found no "guaranteed"/"will get you hired"/"certified by"/affiliation claims in SOC surfaces; cert names in SOC code appear only in a code comment (`lib/lab-engine/soc/query/questions.ts:3` "SAL1/BTL1-Style"). Outside SOC, `app/(app)/exam/page.tsx:92` says "mapped to official certification domain objectives" (rule 4 prefers "aligned with the published objectives of").

### L1-A-25 · Info · Misc
- `lintSocReport` (`lib/lab-engine/soc/report-engine.ts:146`) is used only by tests (dead in the app).
- `npm run check:soc` validates only the single static scenario (`soc-l1-noisy-shift.yaml`); families and shifts are covered by separate scripts (`check:soc:families`, `check:soc:shifts`) that are not part of the documented gate list.
- The SOC Handler prompt context includes `scenarioTitle` (L1-A-01: family title + seed prefix) and learner free text (rationale, report excerpt) sent to the provider; no ground truth is included (`lib/handler/soc-mode.ts:24-45`).
- `ExamStateView.variantId` is also exported in the account export (`learner-export.ts:82`); after submission this is fine.
