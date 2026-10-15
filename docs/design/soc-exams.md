# SOC exam mode, results, readiness and Handler SOC mode (Stage 1)

Status: building. Every number in `content/soc/exams/*.yaml` is **provisional** and is labelled as such in the UI.

## Principles
- **Additive.** Practice behaviour does not change.
  - Exam rules are enforced by guards that only act when an attempt belongs to an exam (`lib/lab-engine/soc/exam/guard.ts`).
  - The guards are called from the existing server entry points.
- **The server is authoritative.**
  - Deadline: `deadlineAt` is computed and stored at start. Every exam read or write compares it with the server clock; the client only displays the remaining time the server reports.
  - Expiry: an expired active exam is finalised the next time anything touches it (`finalize(reason: "deadline")`).
  - Lockouts: Handler and practice-submit lockouts are server-side.
- **One active exam per learner.** This is a partial unique index in Postgres and the same check in the local store. A second tab, a double click or a refresh returns the same attempt.
- **Exam SOC attempts are separate from practice.**
  - Each has `scenarioId = "exam-<examId>"` and `familyId` set to the shift or family, so the scenario still resolves through `familyId`.
  - Practice routes cannot open them: `findActiveSocAttempt` matches on `scenarioId`, the practice page rejects ids that are not shifts or families, and `startSocSession` refuses `exam-` ids.
- **No feedback before submission.**
  - Answers to investigation questions are stored with correctness, but the response is only "recorded".
  - The query workspace shows no question status or debrief.
  - The report is submitted as part of exam submission; its result and model report are blocked until then.
- **Submission is idempotent** (an atomic `active → submitted` transition). XP is awarded once, with source `soc_exam:<examId>`.
- **Budgets** (queries, lookups, question answers) are counted server-side from the existing per-attempt logs and checked before each action.
- **Seeds** do not repeat per (user, exam format). Variants rotate, least-used first, so attempts use different variants. Knowledge items are drawn unseen-first until the bank is exhausted.

## Formats (described as "in the spirit of" practical exams, never as equal to one)
- **Alert queue:** a composed shift with SLA-style pacing guidance, triage decisions, investigation questions and a handoff note.
- **Investigation:** one family scenario with a long window (continuous server clock, resumable), questions and a full incident report.
- **Knowledge:** a timed set drawn from an authored bank of single-choice, multi-select, ordering and log-interpretation items. Objective alignment stays **UNVERIFIED** until the owner confirms current exam versions.
- **Mini-queue drill:** a short timed practice queue. It does not count toward readiness, and its debrief is shown straight after submission.

## Grading
- Decisions use the existing `evaluateSocAttempt`.
- Questions use the existing `verifyAnswer`.
- Reports use the existing deterministic grader. AI criteria are graded only if their live gate is signed; otherwise they show as "not graded".
- The handoff note has a deterministic completeness check, labelled as such.

## Readiness gate (provisional)
- A pure, table-driven function over recent submitted exam attempts.
- Criteria:
  - at least two formats and two different variants;
  - overall score;
  - per-skill floors;
  - time within budget;
  - report quality;
  - no integrity flags.
- Every unmet criterion is listed.
- Wording rule: "Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."

## Data
- **New tables:**
  - `soc_exam_attempts`: learners read non-secret columns only; no seed.
  - `soc_exam_answers`: learners read their own.
  - `soc_exam_outcome_reports`: service role only (owner-only).
  - `soc_exam_accommodations`: service role only; changes are written to `audit_events`.
- **Writes** go through the service role only.
- **Erasure and export** are extended.

## Flags
- `SOC_EXAMS_ENABLED` and `SOC_HANDLER_ENABLED`: on in development and test, off in production until reviewed.
- When `SOC_QUERY_ENABLED` is off, exams run without search and questions, and study plans leave out drills.
