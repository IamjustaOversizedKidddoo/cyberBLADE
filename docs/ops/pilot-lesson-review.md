# SOC L1 pilot lessons: owner review guide

Two pilot lessons are written to the full L1 standard. They are `status: draft` with `review_status: agent-checked`. Only a human sets `reviewed` or `published`. Part 4 (the other ~40 lessons) waits for your approval of these.

| Pilot | Kind | Files |
|---|---|---|
| The triage loop (`soc-l1-triage-loop-01`) | conceptual | `content/tracks/soc/l1/m02-triage/05-triage-loop.{mdx,exercises.yaml,checks.yaml,cards.yaml}` |
| Reading email headers (`soc-l1-email-headers-01`) | hands-on | `content/tracks/soc/l1/m04-email/13-header-analysis.{mdx,exercises.yaml,checks.yaml,cards.yaml}` |

To read them: `npm run dev` with `NEON_SHOW_DRAFTS=true` and an operator at Rank 1 or higher, then open `/learn/soc-l1-triage-loop-01` and `/learn/soc-l1-email-headers-01`.

## What to judge

1. **Level.** Can a smart beginner with only core Ranks 0–1 follow it? Is any term used before it is explained?
2. **Length.** The computed times are 19 and 21 minutes; the plan's split threshold is 15. The linter warns but does not fail, so the choice is yours. Options:
   - Accept about 20 minutes as the L1 norm.
   - Split each lesson into two. For example, headers would become "envelope, From and the Received path" and "SPF/DKIM/DMARC".
3. **Worked examples.** Each has a dead end or false lead: the "no data" reputation result and the travel calendar in triage, and "SPF and DKIM both passed" in headers. Do they feel realistic and not staged?
4. **Exercises.**
   - Are the hints method-only? The linter fails any hint that contains the answer.
   - Is the triage "open first" answer (A4) defensible from the data alone?
5. **Checks.** Five per lesson, with a rationale on every option. Are any of the wrong options too obviously wrong?
6. **Tone.** Calm, second person, no hype and no vendor names. The linter rejects certification names and absolute claims.
7. **Accuracy.** Read `docs/ops/soc-curriculum-claims.md`, especially rows 1, 4 and 6 (marked "fairly sure").

## What the linter now enforces (`npm run check:content`)

- **Template:** the outcome line and the 13 sections in order. It also requires `<TerminalCheck />`, `<KeyTerms>`, `<PracticeThis />` and at least one `<MicroExercise>` whose id exists.
- **Frontmatter:**
  - rank must equal the track gate (`min_core_rank: 1`), and the module must be listed in `track.yaml`.
  - status stays `draft` and `review_status` is required.
  - skills must exist in `content/soc/skills.yaml`, and objectives must be `soc:<one of the lesson's skills>`.
  - practice targets must resolve to real pages.
- **Checks and exercises:** at least 4 checks. Hints must never contain the answer, and choice answers must be one of the options.
- **Leak scan:** no lesson, exercise, check or card may reuse the scenario generator's markers. These are IOC pools, family sender addresses, subjects and payload file names; the scan found 77 markers. It caught a real collision in pilot 2 (`192.0.2.140`), which is now changed.
- **Indicators:** only documentation or private IPs and reserved names (`.example`, `.test`, `example.com/net/org`).
- **Wording:**
  - no certification names, no hype or absolute claims;
  - canonical disposition terms ("benign true positive", never "benign positive");
  - one definition per key term across the track.
- **Time:** `estimated_minutes` must equal the computed time. Above 15 minutes it warns. `npm run soc:curriculum -- times` shows the breakdown.
- **Prerequisites:** each must exist, form no cycle, and point backwards (an earlier L1 lesson, or a core lesson at or below the gate).
- **Coverage:** `content/coverage/soc.yaml` must agree with the lessons in both directions, and gaps are stated rather than hidden.
- **Flashcards:** `lib/review/track-cards.generated.ts` must match the `.cards.yaml` files. Regenerate it with `npm run soc:curriculum -- cards`. SOC cards join the daily review at Rank 1 (category `soc`).

## Known limits and decisions for you

- **`drill:` and `skill:` practice targets have no page yet.** BladeQL drills exist as data but are not routed anywhere in the UI, so the resolver rejects them and neither pilot uses them. Part 4 lessons that need drills (the plan's M9) need a drill page first, or will use `family:`/`shift:` targets instead.
- **The shared lesson table is not keyboard-scrollable.** On narrow screens, wide tables in `components/lesson/prose.tsx` scroll sideways in a wrapper that cannot take keyboard focus. I did not change that shared component (additive rule). Pilot 2 uses a list instead of its 4-column table. Fixing it for core lessons is a one-line change if you approve it.
- **Reader contrast fix (shared, small).** Axe found two serious contrast failures in the existing reader shell, which every lesson renders:
  - "First lesson in module" / "Module complete" in `LessonNav`;
  - the back-to-top link in `TableOfContents`.

  I raised both from 40–60 % opacity to the `text-muted` token. No other behaviour changed.
- **Rank promotion (fix).** `getRankSummary` now counts core lessons only, so L1 lessons at rank 1 do not block promotion to Rank 2. There is a regression test.
- **Unsure claims:** none at "unsure"; three at "fairly sure" (see the claims log).
