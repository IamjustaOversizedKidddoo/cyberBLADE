# Design Evidence: SOC Report "Writing feedback (AI-assisted)" section

- **Screen:** `/labs/soc/[id]` → Incident Report → Evaluation Scorecard (below the deterministic scorecard).
- **Components:** `components/labs/soc/reports/ai/*`.
- **Date:** 2026-10-14.
- **Screenshots:** stored **outside the repo** in `D:\CYBER-PLATFORM-evidence\soc-ai-feedback\`, at 390, 768 and 1440 px (`<width>-viewport.png`, `<width>-expanded-viewport.png`). They were captured in preview mode with the deterministic e2e mock model, so the bands and feedback text in them are mock output, not real AI quality.

## Skill applied

- **Source:** owner skill folder `C:\Users\gone0\.claude\skills\`, `ui-ux-pro-max`. I ran `--design-system` and the `ux` / `nextjs` searches.
- **Rejected from the skill:** its palette, the Fira fonts from Google Fonts and the "webinar" pattern. Project tokens and the CSP rule (no external fonts or CDNs) override them.

**Rules applied:**

| Rule (skill) | How |
|---|---|
| Colour is not the only indicator | Every status chip is icon + word (Pending / Graded / Preview / Not graded / Under review / Not available); counted state is the text "Counts" / "Does not count" |
| Loading states | Skeleton rows on first load, "still being prepared" note, polling with backoff (stops after ~3 min) |
| Loading buttons | "Request human review" disables while sending and after success |
| Form labels | Consent is a native checkbox with a `<label for>` and `aria-describedby` help text |
| Touch targets 44 px | Disclosure summary, evidence toggle, retry and review buttons are at least 44 px on mobile; consent box is 24 px with the whole label clickable |
| Focus states | `focus-visible:ring-2 ring-cyan` on every control |
| Reduced motion | Pulse and rotate use `motion-safe:` / `motion-reduce:`; no layout animation |
| Transitions | Colour transitions only, 150–200 ms |
| No emoji icons | Inline SVG icons from `components/ui/icons.tsx` |
| Async status | `role="status" aria-live="polite"` summary ("3 of 6 criteria ready"), review and consent results announced |
| Disclosure | Native `<details>/<summary>` for "How AI feedback works" (keyboard and screen reader built in) |
| Avoid jargon | Plain-English reasons ("this section still contains template text") and band labels from the rubric |

## Self-critique and fixes

1. **390 px: content shifted 47 px sideways and was clipped at the left edge.**
   - Cause: the existing Prompt 6 scorecard sub-navigation row and score banner did not wrap, so the report pane was 419 px inside a 372 px column.
   - Fix: `flex-wrap` and `min-w-0` in `SocReportWorkspace.tsx` and `GradedResultsScorecard.tsx`.
   - Regression check: the e2e test now asserts the section's bounding box sits inside the viewport. The old check only measured document scroll, which did not catch this.
2. **Ambiguous duplicate placeholder.** The deterministic scorecard still listed the zero-weight `narrative_quality` seam row ("not yet available"), which contradicted the new section. Zero-weight not-available rows are now hidden there.
3. **Evidence toggle.** The button label changes (Show → Hide), with `aria-expanded` and `aria-controls` on the panel.
4. **Known and left as is:** the global floating Handler button overlaps the bottom of the page at 390 px. It is pre-existing and app-wide, outside this screen's scope.

## Verification

- `tests/e2e/soc-ai-feedback.spec.ts` runs on desktop and on mobile at 390 px. It covers preview statuses, evidence `<mark>`, the transparency panel, keyboard consent toggle and one-time review request.
- axe WCAG 2.2 AA reports no serious or critical issues, with no horizontal scroll and the section inside the viewport.
