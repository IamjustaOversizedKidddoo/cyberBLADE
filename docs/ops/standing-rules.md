# Standing Rules (Phase 3 onward)

Source: owner handoff message, 2026-10-14. These apply to all work, always. When this file and a prompt disagree, ask.

1. **ADDITIVE:** do not change existing lessons, labs, engines, validation, capstones, rank gating, the Handler's guardrails, auth or security controls unless explicitly asked. Keep stable IDs. Existing learner data must stay valid.
2. **GROUND TRUTH NEVER REACHES THE CLIENT** or any user-readable column. That covers scenario answers, IOC sets, timelines, seeds, family internals and model reports; they stay server-side. No correctness oracle before submission. Use opaque IDs. Generate malicious and benign data through identical code paths (no tells). Latency must not reveal truth. Verify with deny-list and bundle scans.
3. **DETERMINISTIC AND VERSIONED:** generation, grading and scoring are pure functions of versioned inputs. Published versions are immutable. Seeds are server-only.
4. **ORIGINAL SYNTHETIC CONTENT ONLY:**
   - No copying or close paraphrase of any course, vendor or certification material, and no exam questions.
   - Use reserved domains (example.com/.net/.org, .test, .invalid), documentation IP ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32), inert artifacts, synthetic hashes and fictional people.
   - No claims of affiliation or endorsement. Name certifications only as "aligned with the published objectives of...".
5. **TECHNICAL ACCURACY OVER VOLUME:** if unsure of a log format, event ID, header, protocol detail or ATT&CK ID, generalize it and add it to a human-verification list instead of guessing. Scores are provisional and labeled so.
6. **DATABASE:**
   - Additive, timestamped, idempotent migrations only. Never edit applied migrations.
   - RLS owner-only, with rollback notes.
   - Never run migrations against any real hosted project. Mark "not executed against a database" when true.
   - Review every SQL function for SECURITY DEFINER and a fixed search_path.
   - Keep hosted and local-store parity. Extend account deletion/export to every new table.
7. **SECURITY AND PRIVACY:** validate every route input with schemas, rate limit, audit log, return generic errors with request IDs. No secrets in the repo, no learner free text in telemetry, no PII to AI providers. Tests never call real providers.
8. **QUALITY:**
   - Accessibility (keyboard complete, aria-live, reduced motion, no color-only meaning) and mobile at 390px are requirements.
   - Gates: check:content, check:soc, typecheck, lint, test, security suite, build, test:e2e (or npm run verify).
   - Never claim something passes without showing command output.
9. **DESIGN:**
   - All UI work follows the owner's premium design skill folder: `C:\Users\gone0\.claude\skills\` (index: its `README.md`; the stack is ui-ux-pro-max / taste-* → GSAP + Lenis → React Bits / ThreeUI / 21st → Motion, review with 21st-ui-review). Read it before UI work and apply it.
   - Keep an evidence log per screen: rules applied, screenshots at 390/768/1440 stored outside the repo, self-critique and fixes.
   - The existing design tokens stay the single source of truth.
   - Readability, accessibility, performance and the CSP always override decoration. No external fonts, CDNs or trackers.
   - If the skill path is missing, stop and ask.
10. **PROCESS:**
    - Small commits with prefixes (soc-, soc-gen:, soc-enrich:, soc-query:, soc-report:, soc-ai:, soc-curriculum:).
    - Run the relevant tests after each Part, then update the relevant docs/ops/progress file.
    - If context runs low, update the progress file and stop cleanly.
    - End every task with a human-verification list (what the owner must check by hand) and `git log --oneline`.

**Owner context:** not yet provided (the handoff template line was left blank).

**Additional rule (Prompt 7):** make no claim about AI grading quality in code, UI or docs without real calibration data.
