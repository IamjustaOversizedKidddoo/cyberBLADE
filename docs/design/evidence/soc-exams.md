# Evidence log: SOC practice exams (Stage 1)

Screenshots (outside the repo): `D:\CYBER-PLATFORM-evidence\soc-exams\<screen>-<390|768|1440>.png`.
Design notes: ui-ux-pro-max rules applied once (contrast, 44px targets, focus, no colour-only state, reduced motion); project tokens win (bg-surface, border-line, text-ink/secondary/muted, cyan accent, font-ui/font-sans/font-mono). No new fonts, CDNs or trackers. No motion added.

| Screen | Evidence | Checks |
|---|---|---|
| Lobby `/labs/soc/exams` | lobby-*.png | Plain-word rules incl. "unproctored, not equivalent to any real exam"; per-format time, scoring, limits, attempts, readiness role; history table with caption; axe clean; no horizontal scroll at 390 |
| Start confirmation | start-confirm-*.png | Native `<dialog>`; focus starts on "Not yet" (safe default); Esc closes |
| Knowledge exam | knowledge-exam-*.png | Timer HUD sticks under the site header (never covers nav); time as text; warnings at 10/5/1 min with icon + text, announced once each; "Announce time remaining" on demand; no constant live-region chatter; answers save silently ("Saved"), never marked; fieldset/legend per item; ordering via Up/Down buttons |
| Submit confirmation | submit-confirm-*.png | Focus on "Keep working"; states consequences plainly; no pressure wording |
| Knowledge result | knowledge-result-*.png | Score + "does not predict any real exam result"; components with graded / not graded; skills (bar is decorative, % is text); time; integrity notes labelled informational; per-item review only after submit |
| Scenario exam (mini-queue / alert queue / investigation) | scenario-exam-*.png | Existing workspace in exam mode: "Submit exam (n/N triaged)" replaces practice submit/scorecard/exit; questions show "Answer saved"; report tab explains drafts are graded at exam submit; search notice when SOC_QUERY_ENABLED is off |
| Scenario result | scenario-result-*.png | Decision quality, time, thoroughness, budgets; link to own review (debriefs, model report) |
| Readiness `/labs/soc/exams/readiness` | readiness-*.png | State as icon + text, "provisional" everywhere; every unmet criterion listed; exact readiness sentence only when ready; study plan (drills hidden when search off); trend tables; optional consented outcome form |

Automated: `tests/e2e/soc-exams.spec.ts` (keyboard only, desktop + Pixel 7, axe WCAG 2.2 AA serious/critical = 0, overflow ≤ 1px).
