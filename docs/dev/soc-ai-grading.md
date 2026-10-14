# Operating AI-Assisted Report Grading

Design and rules: `docs/design/soc-ai-grading.md`. This page covers how to run it.

> **Status (2026-10-14):** built, default **off**, **not calibrated**. Nothing may claim AI grading quality until a real calibration gate is signed off.

## 1. Switches (environment)

| Variable | Values | Effect |
|---|---|---|
| `SOC_AI_GRADING_MODE` | `off` (default), `shadow`, `preview`, `live` | `shadow` grades silently. `preview` shows feedback that does not count. `live` counts, capped, **only** with a valid signed gate (otherwise it is served as `preview`). |
| `SOC_AI_GRADING_KILL_SWITCH` | `1` / `true` | Forces `off` immediately; new jobs record "Not graded: AI feedback is paused". |
| `SOC_AI_GRADING_MODEL_ID` | e.g. `groq:llama-3.3-70b-versatile` | The model the gate and cache keys refer to. |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | keys | Shared with the Handler; server-side only. |

Budgets, weights, sampling and gate thresholds live in `content/soc/ai-grading/config.yaml`. All of them are provisional.

## 2. Day-to-day commands

| Command | What it does |
|---|---|
| `npm run soc:ai:worker [-- --loop]` | Drains due jobs. Submissions also trigger it through `after()`. |
| `npm run soc:ai:review -- list` | Lists the open review queue (low confidence, needs review, injection-flagged, 5% random sample, learner requests). |
| `npm run soc:ai:review -- show <id>` | Shows the grade and its raw model samples (operator only). |
| `npm run soc:ai:review -- accept <id> --reviewer <pseudonym>` | Writes a new grade that supersedes the AI one. |
| `npm run soc:ai:review -- override <id> --band 0-3 --reviewer <pseudonym>` | Same, with your band and rubric wording. |
| `npm run soc:ai:injection` | Runs the 113-case injection corpus against mock models (no network). |
| `npm run soc:ai:drift -- record\|check --provider mock\|real` | Records a canary baseline, or checks the current model against it. |

## 3. Calibration and sign-off (the only path to `live`)

1. Ask learners to opt in (the consent box under "Writing feedback"). It is off by default and revocable.
2. Export the opted-in reports: `npm run soc:ai:calibration -- export --set cal-2026-11`.
   - This writes anonymized `packets.json` under `.data/soc-ai-calibration/cal-2026-11/`.
   - Share **only** `packets.json` with graders. `private-map.json` stays with you so that revoked consent can be honoured (`purge-revoked`).
3. Have 2–3 graders, identified by pseudonyms (`g1`, `g2`, …), score at least 60 reports. Each report needs at least 2 graders. They return a CSV with the columns `packetId,graderId,band`.
4. Import their scores: `npm run soc:ai:calibration -- import-human --set cal-2026-11 --file scores.csv`.
5. Grade the packets twice with the real model (this sends packet text to the provider):

   ```bash
   npm run soc:ai:calibration -- grade --set cal-2026-11 --provider real --i-understand-this-calls-a-real-provider
   ```

6. Compute the gate (this also runs the fairness and injection suites against the real model):

   ```bash
   npm run soc:ai:calibration -- gate --set cal-2026-11 --provider real --write --i-understand-this-calls-a-real-provider
   ```

7. Read the numbers in `evaluation.json` and the gate file written to `content/soc/ai-grading/gates/`. If you accept them, fill in `signOff.signedOffBy` and `signOff.signedOffAt` by hand and commit.
8. Changing the prompt files, the AI rubric, the grader version, the thresholds or the model makes the gate stale, and live falls back to preview automatically.

`npm run soc:ai:calibration -- demo` runs the whole pipeline on a **synthetic** set to show the tooling. It always fails the gate by design.

## 4. Manual real-provider check

```bash
npm run soc:ai:eval-real -- --i-understand-this-calls-a-real-provider --n 4 [--injection]
```

- Sends only synthetic reports, and prints every verdict with its raw output so you can read them.
- Refuses to run in CI, in tests, without the flag, or without keys.
- Writes a log to `.data/soc-ai-calibration/`.

## 5. Where things are stored

| Data | Hosted (Supabase) | Local |
|---|---|---|
| Jobs, review queue, usage | `soc_ai_grading_jobs`, `soc_ai_review_items`, `soc_ai_usage_daily` (service role only) | `.data/soc-ai-grading.json` |
| Grades (learner-visible fields) | `soc_ai_criterion_grades` (owner SELECT) | same file |
| Raw model outputs | `soc_ai_raw_outputs` (no learner access at all) | `.data/soc-ai-raw-outputs.json` |
| Review requests, consent | owner SELECT tables | same main file |

Account deletion removes everything above for the user. Export includes grades, review requests and consent, but not raw outputs or prompts.

## 6. Known limits

- The migration `20261014120000_phase_3_soc_ai_grading.sql` has **not** been executed against any database. It is only statically tested.
- The injection detector reached 100% on its own corpus only after fixing bypasses that corpus revealed. Expect real-world gaps. The weight caps (2.5% per criterion, 15% total) bound the damage.
- Local-mode quotas use a JSON file and are per process.
- Mock models in tests and e2e only mimic shapes of behaviour. Nothing about real model quality can be inferred from them.
