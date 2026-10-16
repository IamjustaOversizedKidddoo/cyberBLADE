# Owner decisions log

Decisions the owner has accepted, newest first. Each entry says what was decided, where it applies and what would reopen it. Proposals and open questions live in reports and `progress.md`; only accepted decisions go here.

## 2026-10-16 · L1 audit follow-ups (`docs/ops/l1-audit.md`)

| # | Decision | Applies to | Reopen when |
|---|---|---|---|
| 1 | **Rule-name twins are built in the L2 prompt.** Every malicious rule name in L1 and L2 families gets benign variants so a rule name alone never predicts the verdict (the deferred half of L1-A-09). New family versions; existing attempts stay pinned to their generator and family versions. | Scenario families, generator 1.3.0, pooled tell tests | Pooled rule-name-to-verdict accuracy rises above the test threshold |
| 2 | **Nonce-based CSP before public launch** (L1-A-14). Until then the current CSP stays; the switch needs per-request nonces and dynamic rendering of every page. | `proxy.ts`, root layout, all pages | Before any public (non-invite) launch |
| 3 | **Exam thresholds, durations and retake caps stay provisional.** Readiness 75 / 60 / 65 (overall / skill floor / report floor), durations 75 / 150 / 40 / 10 minutes, retake caps 3 / 2 / 3 per week (mini-queue 10 per day). Labelled provisional everywhere. | `content/soc/exams/config.yaml`, `readiness.yaml`, exam UI | Enough real outcome reports for offline calibration (`npm run soc:exam-calibration`; at least 30 usable reports) |
| 4 | **Extended-time accommodation is owner-set only, at most ×2.** Default off; set with `npm run soc:exam-accommodation`; audit-logged. | Accommodation CLI and schema | A documented need for more than ×2 |

Related changes made with these decisions: the 10-minute drill now uses small beginner queues (about 30 alerts) instead of full shifts, and evidence screenshots are no longer tracked in git.
