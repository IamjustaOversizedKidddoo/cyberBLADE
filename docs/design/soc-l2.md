# SOC Level 2: Architecture, Exams and Evaluation

Status: Stage 1 implementation complete.
Feature flags: `SOC_L2_ENABLED` and `SOC_RULES_ENABLED` (both off in production until reviewed).

## 1. Principles & Reuse of L1 Infrastructure
- **Additive & Non-Duplicative:** Extends the existing L1 exam infrastructure (`lib/lab-engine/soc/exam/service.ts`, `lib/lab-engine/soc/exam/results.ts`) by adding L2 formats and evaluators rather than duplicating the runner, timers, or storage loops.
- **Server Clock Authority:** Server deadline is set at start (`deadlineAt`). Every read/write checks against server time. Expiry triggers automatic server finalization.
- **Single Active Exam:** Database partial unique index on `(user_id, status = 'active')` ensures exactly one active exam attempt per learner.
- **Zero Oracle Before Submission:** Ground truth, hold-out datasets, answer keys, and rule performance are withheld strictly until submission.
- **Idempotency & XP Once:** Atomic finalization guarantees scores and XP are written exactly once per exam attempt.

## 2. Formats
### (a) Multi-Stage Investigation Exam (`investigation-l2`)
- **Focus:** Multi-stage attack investigation across endpoints, Active Directory, and identity telemetry.
- **Duration:** 180 minutes (provisional).
- **Deliverable:** Scoping report using template `scoping-report-l2` and rubric `scoping-report-l2-rubric.yaml` (35% weight on `incident_scoping`).
- **Scoring Weights:** 25% triage decisions, 25% questions, 50% scoping report.

### (b) Detection Rule Engineering Challenge (`detection-rule`)
- **Focus:** Authoring high-fidelity detection rules (BladeQL query, MITRE tactic/technique tagging, description, severity).
- **Duration:** 60 minutes (provisional).
- **Evaluation Mechanism:** On submission, `evaluateDetectionRuleChallenge` evaluates the candidate rule against:
  1. Hidden hold-out true positive variants derived deterministically from unreleased seeds.
  2. Benign decoy twins (false positive testing).
- **Budgets & Security:** ReDoS protection via BladeQL budgets (max execution time 2000ms, max regex matches 5000), 4000 character query limit, and prototype pollution defense in event transformations.
- **Scoring Weights:** 50% hold-out recall, 35% false-positive avoidance, 15% rule metadata quality.

### (c) Knowledge Exam (`knowledge-l2`)
- **Focus:** Advanced topics: Sigma, YARA, Prefetch, Shimcache, Amcache, Kerberoasting, AS-REP Roasting, Pass-the-Hash, Golden/Silver tickets, BloodHound, Process Hollowing, LOLBAS, Volatility memory analysis, CloudTrail IAM persistence, and scoping methodology.
- **Authored Bank:** `content/soc/exams/knowledge-bank-l2.yaml` (25 items K23–K45).
- **Curriculum Claims:** All facts logged in `docs/ops/soc-curriculum-claims.md`; objective alignment explicitly noted as **UNVERIFIED**.

## 3. Readiness Gate & Diagnostics
- **Config:** `content/soc/exams/readiness-l2.yaml`.
- **Criteria:** Window of 4 recent attempts, at least 2 distinct formats and 2 distinct variants, overall score ≥ 75%, per-skill floor ≥ 60%, report floor ≥ 65%, within time budget, and zero integrity flags.
- **Exact Disclaimer:**
  > *"Your recent practice meets our provisional readiness criteria. This is an estimate, not a guarantee of passing any exam."*
- **Study Plan:** Maps weak skills to lessons and review cards; works cleanly when drills are switched off.

## 4. Handler L2 Guard & Context
- **Context:** Restricted strictly to learner's own past queries, lookups, case notes, and authored detection rules (`soc_detection_rules`).
- **Socratic Redirects:** Rebuffs requests for detection rule writing, exam answers, or direct incident verdicts.
- **Exam Lockout:** Entirely disabled during any active exam attempt.
