# Design Evidence: SOC L1 lesson reader (pilot lessons)

- **Screens:**
  - `/learn/soc-l1-triage-loop-01` (conceptual pilot)
  - `/learn/soc-l1-email-headers-01` (hands-on pilot)
- **New reader components:** `components/lesson/{MicroExercise,FlowDiagram,LogBlock,KeyTerms,PracticeThis}.tsx`
- **Date:** 2026-10-14
- **Screenshots:** stored outside the repo in `D:\CYBER-PLATFORM-evidence\soc-curriculum\` at 390, 768 and 1440 px.
  - Per lesson: `<lesson>-<width>-{top,full,exercise,diagram}.png`, plus `triage-loop-<width>-table.png`.
  - Interaction states: `email-headers-<width>-{wrong-hint,correct}.png`.
  - Reproduce with `npm run build`, then `NEON_DATA_DIR=.data-visual npx playwright test --config scripts/visual/playwright.soc-lessons.config.ts`.

## Skill applied

- **Source:** owner skill folder `C:\Users\gone0\.claude\skills\`, `ui-ux-pro-max`. I ran `--design-system` for "education learning platform long-form lesson reader interactive exercise" and a `ux` search on long-form reading, forms, feedback, hints and accessibility.
- **Rejected from the skill:**
  - its recommended system: the "Vibrant & Block-based" style, an indigo palette, Baloo 2 / Comic Neue from Google Fonts, and "animated patterns". It targets children's education apps. Project tokens, the CSP rule (no external fonts) and the CLAUDE.md theme override it.
  - its "immersive full-screen interaction" pattern: lessons are reading-first.

**Rules applied:**

| Rule (skill) | How |
|---|---|
| Line length 65–75 ch | Article column stays `max-w-[70ch]`; exercise and diagram blocks sit inside it |
| Form labels | Text answers use `<label for>`; choice answers use a native `fieldset`/`legend` with a radio group (arrow keys work natively; e2e-tested) |
| Submit feedback | "Check answer" shows "Checking…" and disables while waiting, then announces "Correct." / "Not yet…" in a `role="status" aria-live="polite"` line |
| Colour is not the only indicator | Status uses a symbol and a word (✓ Correct / ✗ Not yet); hints are labelled "Hint 1:" in text, not only by the amber border |
| Touch targets 44 px | Buttons, text inputs and radio rows are at least 44 px tall on mobile |
| Focus states | `focus-visible:ring-2 ring-cyan` on every control and on scrollable log/table regions |
| Semantic HTML | Exercises are `<section aria-labelledby>`, diagrams are `<figure>` with an ordered list as the text alternative, key terms are a `<dl>` |
| Long content | Log blocks scroll sideways in a focusable, labelled region ("… (scrolls sideways)"); prose never scrolls sideways |
| Reduced motion | No new animation; the existing hero typing respects the app's motion preference |
| No emoji icons | Text glyphs only (✓ ✗ ↓ ↺), all `aria-hidden` or paired with words |

## Self-critique and fixes

1. **390 px: the last choice question was clipped on the right.**
   - The legend and the long `Message-ID: <…@relay.cheapvps.example>` option ran past the card edge.
   - Cause: a `fieldset` defaults to `min-width: min-content`, so it grew to the longest unbreakable option.
   - Fix: `min-w-0` on the fieldset, plus `overflow-wrap:anywhere` on the legend and option text.
   - Regression check: the capture script and the e2e spec now assert that the exercise sits inside the viewport and that no legend, label or fieldset extends past it.
2. **390 px: the 4-column SPF/DKIM/DMARC table forced sideways scrolling.**
   - The shared prose table wrapper cannot take keyboard focus, and I left it unchanged (additive rule).
   - Fix: I rewrote the content as a nested list ("A pass proves / It does NOT prove"), which also reads better on a phone. The shared issue is recorded in `docs/ops/pilot-lesson-review.md`.
3. **The worked example's inline header used a fenced code block, which renders as a non-focusable `pre`.** I switched it to `<LogBlock>`, which has a caption, a focusable scroll region and an accessible name.
4. **Axe failures in the reader shell:**
   - "First lesson in module" text at 2.3:1 contrast;
   - the table-of-contents back-to-top link at 3.77:1.

   Both were pre-existing and app-wide on lesson pages. I raised them to the `text-muted` token. Axe now reports zero serious or critical violations on both pilots at desktop and mobile.
5. **Evidence frames showed an empty hero kicker.** This was a capture-timing artifact, not a bug: the kicker types itself in over about 0.6 s, which I confirmed by sampling it over time. The capture now waits for the full kicker (`soc_l1 · email · 21 min`).
6. **Known and left as is:**
   - The floating Handler button overlaps content near the bottom at 390 px. It is pre-existing and app-wide.
   - Tall element screenshots show the sticky header stitched mid-frame. That is a Playwright stitching artifact, not the live page.

## Verification

- `tests/e2e/soc-l1-lessons.spec.ts`: 12 of 12 pass on `chromium-desktop` and `chromium-mobile` (Pixel 7). It covers:
  - template headings;
  - no sideways page scroll, and the exercise inside the viewport;
  - axe at WCAG 2.2 AA: zero serious or critical violations;
  - no answer key or explanation in the page HTML before a correct answer;
  - the keyboard-only flow (wrong answer → Tab to the hint → defanged correct answer → explanation revealed);
  - arrow-key radio selection;
  - the rank 0 learner redirect.

## Drill page (`/practice/drills`, `/practice/drills/[drillId]`), added 2026-10-14

- **Design approach:** it reuses the lesson exercise pattern rather than inventing a new one:
  - a labelled `textarea` (Ctrl/Cmd+Enter runs the query);
  - "Run and check", which disables and reads "Running…" while busy;
  - method-only hints behind a button;
  - a `role="status"` verdict with a symbol and a word;
  - the learner's own results in a labelled, focusable scroll region.
- **Screenshots:** `drill-<width>-{top,full}.png` at 390, 768 and 1440 px.
- **Self-critique:**
  - The results region was first labelled "Your query results", which clashed with the "Your query" textbox label. Renamed to "Results of your query".
  - Backticks in the drill prompts are stripped for display; inline code styling is left for later.
- **Verification:** `tests/e2e/soc-drills.spec.ts`, 4 of 4 on desktop and mobile. It covers axe (0 serious or critical), the keyboard run, no reference query in the HTML, no sideways page scroll, and the rank 0 redirect.
