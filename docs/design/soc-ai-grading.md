# SOC Report AI-Assisted Grading: Design Brief (Phase 3, Prompt 7)

Status: **built behind `mode: off` by default. Not calibrated against human graders.** Nothing in code, UI or docs may claim AI grading quality until a signed-off calibration gate exists (standing rules, Prompt 7 addition).

## 1. What this adds

The deterministic grader (`lib/lab-engine/soc/reports/grader.ts`, rubric `incident-report-l1-rubric@1.0.0`) stays **authoritative and unchanged**. It scores verdict, scope, IoCs, timeline, evidence, ATT&CK, actions, escalation and hygiene against server-side ground truth.

This prompt adds a separate, optional layer that judges six **communication** criteria that set logic cannot measure:

| Criterion id | What it judges | Report fields the model sees |
|---|---|---|
| `narrative_quality` | Does the narrative tell a clear, synthesized attack story? | executive summary, attack narrative |
| `reasoning_evidence_linkage` | Are conclusions tied to cited evidence ("because alert X shows…")? | verdict justification, attack narrative, timeline descriptions, IoC notes |
| `coherence` | Do the sections agree with each other and flow logically? | summary, justification, narrative, lessons learned |
| `recommendation_quality` | Are recommended actions specific, prioritized and justified? | response action names and rationales, lessons learned |
| `handoff_usefulness` | Could a Tier-2 analyst act on the handoff without re-investigating? | escalation team, urgency, handoff summary |
| `tone_concision` | Is the writing professional, plain and free of padding? | executive summary, handoff summary, verdict justification |

The criteria live in a **separate versioned AI rubric** (`content/soc/ai-grading/rubric.yaml`, id `incident-report-l1-ai`, version `0.1.0`). The published deterministic rubric `1.0.0` is not edited (rule 3: published versions are immutable). Its existing `narrative_quality` entry stays weight 0 and is superseded by the AI rubric's criterion of the same id.

## 2. Hard rules (enforced in code and tests)

1. **Information boundary.** The model sees only:
   - the learner's report text for that criterion's fields;
   - template guidance;
   - the criterion's band descriptors and synthetic anchors;
   - learner-visible scenario facts (scenario title and briefing from the client view).

   It never sees ground truth, IoC truth sets, model reports, seeds, family ids or deterministic scores. `buildAiGradingInput` cannot see them: its input type has no field for them. A deny-list test plants sentinels in every forbidden source and scans every prompt the code can build.
2. **PII.** Emails, phone numbers, the analyst handle and the header analyst field are replaced with placeholders before any call.
3. **The AI only scores the AI rubric's criteria.** It never changes a deterministic criterion score or the deterministic `GradingResult`.
4. **No guesses.** Invalid output is retried once. If it is still invalid, the result is **Not graded** with a reason, never a fallback number. The Handler's heuristic fallback is disabled for grading.
5. **Tests never call real providers.** A manual script (`npm run soc:ai:eval-real`) is the only real-provider path. It refuses to run in CI and without explicit flags.

## 3. Grading one criterion

```
report ─▶ sanitize (bidi/zero-width/control chars, PII) ─▶ pre-filter ─┬─▶ Not graded: <reason>
                                                                       │   (empty / template-only /
                                                                       │    copy-paste-dominated / over-length)
                                                                       ▼
            injection signal scan (flags only; never blocks) ─▶ build prompt (per-request random
            fence + canary; learner text labelled UNTRUSTED) ─▶ provider × N=3 (temperature 0)
                                                                       │
            each sample: strict JSON ─▶ schema ─▶ spans verbatim? ─▶ canary absent? ─▶ band/span rule
                         (invalid → retry once → still invalid → sample discarded)
                                                                       ▼
            ≥2 valid samples ─▶ median band; spread ≥2 = low confidence ─▶ sanity rule ─▶ grade record
```

- **Output schema:** `band` 0–3, `confidence` 0–1, `evidenceSpans` (≤4 verbatim quotes, each ≤240 chars), `strengths` (≤3), `improvements` (≤3), `insufficientInformation`.
- **Span rule:** band ≥1 needs ≥1 verified span; band 3 needs ≥2 verified spans. Spans that overlap a detected instruction-like region do not count.
- **Sanity rule:** band ≥2 on a criterion input under 25 words becomes **needs_review** and is not counted.
- **Learner text:** strengths and improvements pass a tone filter (no insults, no absolute/guarantee language, no URLs, no score talk, length-capped) and are rendered through fixed templates. The model never writes free-form feedback straight to the learner.

## 4. Modes and the release gate

| Mode | Jobs run | Learner sees | Counts toward total |
|---|---|---|---|
| `off` (default) | no | "Not graded: AI feedback is off" | no |
| `shadow` | yes | nothing new (criteria shown as not available) | no |
| `preview` | yes | AI feedback labelled **Preview, does not count** | no |
| `live` | yes | AI feedback labelled **counts** | yes, capped |

- **Selecting the mode:** set with `SOC_AI_GRADING_MODE`. The kill switch `SOC_AI_GRADING_KILL_SWITCH=1` forces `off` immediately.
- **Live is refused server-side.** `resolveEffectiveMode()` downgrades `live` to `preview` and records the reason unless a gate file exists at `content/soc/ai-grading/gates/<rubric>@<version>__<prompt>__<model>.json` that:
  - was computed by `npm run soc:ai:calibration -- gate --set <id> --provider real` from a non-synthetic calibration set;
  - has `passed: true`;
  - has non-empty `signOff.signedOffBy` and `signOff.signedOffAt` (filled in **by the owner by hand**);
  - matches the current rubric, prompt and model versions.
- **Score composition (live only).** The deterministic total stays exactly as computed. With `W` = the sum of the weights of AI criteria that are graded and counted:

  ```
  displayed total = deterministic_total × (1 − W) + Σ_counted w_c × (band_c / 3) × 100
  ```

  - **Caps:** each `w_c` ≤ 0.05; `W` ≤ 0.15 (provisional, config).
  - An AI criterion that is not graded, under review or low-confidence contributes nothing. Its weight returns to the deterministic part, so a missing AI grade never lowers a score.

## 5. Pipeline

- **Jobs and results.** Submitting a report enqueues one job per AI criterion (table-backed, idempotent). Each job's key is `sha256(userId | submissionId | criterionId | aiRubricVersion | promptVersion | graderVersion | modelId | inputHash)`.
  - Results are cached under the same key. The key includes the user id, so two learners with identical text never share a result. There is no cross-user batching.
- **Workers.** A worker (`processAiGradingJobs`) runs through `after()` once the submit response is sent, and through `npm run soc:ai:worker`.
  - It leases jobs, retries with exponential backoff (max 4 attempts) and moves failures to `dead`.
- **Budgets:**
  - per-user daily graded-submission quota;
  - per-submission token cap;
  - global daily token ceiling;
  - kill switch.

  Every limit degrades to **Not graded: <reason>**.
- **Stored per grade:** model id string, AI rubric/prompt/grader versions, params, input hash and token counts.
- **Raw model outputs** go in a separate table (`soc_ai_raw_outputs`) with RLS on, no policies and privileges revoked from `anon`/`authenticated`. Only the service role reads them.

## 6. Review and transparency

- **Review queue.** These grades go to the queue: low-confidence, needs_review, injection-flagged, learner-requested, plus a deterministic 5% random sample.
  - `npm run soc:ai:review` lists items and accepts or overrides them. An override writes a **new versioned grade record** that supersedes the old one (append-only).
- **Learner controls.** A "Request human review" button allows one request per submission, rate-limited.
- **"How AI feedback works" panel.** It states what is deterministic vs AI, what the AI never sees, and each criterion's current status. It shows calibration status only from a real signed-off gate, which today is: *not calibrated*.
- Verified evidence spans are highlighted in the learner's submitted report.

## 7. Calibration harness (`lib/lab-engine/soc/ai-grading/calibration/`)

- **Export.** Anonymized grading packets for human graders. Packets include only reports from learners with **active opt-in consent** (default off, revocable).
- **Import.** Human scores with pseudonymous grader ids.
- **Metrics** (known-answer tests):
  - quadratic-weighted kappa;
  - Krippendorff's α (ordinal);
  - ICC(2,1);
  - MAE, within-one-band and signed bias;
  - test–retest band-flip rate;
  - seeded bootstrap 95% CIs;
  - human–human agreement.
- **Fairness pairs.** Same content in a different form:
  - longer vs shorter;
  - bullets vs prose;
  - formal vs simple English;
  - Indian-English phrasing;
  - padded vs not;
  - reordered sections.

  The band must not move beyond a tolerance.
- **Injection corpus.** 100+ cases, run against a mock "compliant-with-injection" model so the defences are proven independent of real model behaviour.
- **Gate.** `npm run soc:ai:calibration -- gate --set <id> --provider mock|real` computes pass/fail from provisional thresholds in `config.yaml`:
  - weighted κ ≥ 0.60;
  - within-one-band ≥ 90%;
  - human–human κ ≥ 0.60;
  - fairness and injection suites pass;
  - the calibration set matches the current prompt and model.

  A bundled **SYNTHETIC demo set** proves the tooling but is marked `synthetic: true`, which the gate always rejects.
- **Drift.** `npm run soc:ai:drift` re-grades a frozen canary set and alerts on band shifts.

## 8. Data model (migration `20261014120000_phase_3_soc_ai_grading.sql`)

| Table | Learner can read | Contents |
|---|---|---|
| `soc_ai_grading_jobs` | no | queue state, idempotency key |
| `soc_ai_criterion_grades` | own rows | validated band, confidence, filtered feedback, verified spans, versions, token counts |
| `soc_ai_raw_outputs` | **no (privileges revoked)** | raw model text, prompt hash |
| `soc_ai_review_items` | no | review queue |
| `soc_ai_human_review_requests` | own rows | one per submission |
| `soc_ai_calibration_consent` | own row | opt-in state |
| `soc_ai_usage_daily` | no | quota and ceiling counters |

Account deletion covers every table. Export includes grades, review requests and consent, and **excludes** raw outputs and prompts.

## 9. Known limits (honest list)

- No calibration data exists. Every threshold is provisional, and live mode is impossible until the owner signs a gate.
- Injection defences are tested against mocks, not against real model behaviour.
- No PostgreSQL instance was available. The migration is checked statically and **not executed against a database**.
- Hosted quotas use the `soc_ai_usage_daily` table. Local mode uses a JSON file, so quotas there are per-process.
