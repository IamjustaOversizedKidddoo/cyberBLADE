# CYBERBLADE — Brand + Cinematic Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to CYBERBLADE and turn the landing page, dashboard entry, course map and challenge/rank moments into scroll-driven cinematic scenes, on top of the art system already built (art-system plan Tasks 1–4).

**Architecture:** One GSAP timeline per `ScrollScene`, built from a declarative data-attribute scene language on server-rendered markup (final state in HTML; the timeline animates from offsets). Lenis smooth scroll on cinematic routes only. CSS 3D for camera/depth; one lazy WebGL `BladeObject` (plain `three`) on capable desktops, `BladeMark` SVG fallback elsewhere.

**Tech Stack:** existing (Next 16, React 19, Tailwind v4, gsap 3.15, motion 14, Vitest, Playwright) + `lenis@^1`, `three@^0.17x` (versions confirmed for React-19/Next-16 build at install).

**Spec:** `docs/specs/2026-10-08-cyberblade-cinematic-design.md` (+ `docs/specs/2026-10-08-visual-art-system-design.md` for everything it doesn't change). Supersedes art-system plan Tasks 5–10 (`docs/plans/2026-10-08-visual-art-system.md`), whose remaining work is folded in below.

## Global Constraints

- All 12 owner rules from the art-system plan still bind (art serves content; primitives only — new ones only with a stated reason; original art; intentional placeholders; content first; real mobile compositions; motion hierarchy with complete reduced-motion off-switch; performance; accessibility; preserve functionality; staged build; quality bar).
- Brand: `BRAND = { name: "CYBERBLADE", fullName: "Breach-Level Analysis of Digital Exploitation", tagline: "Learn. Breach. Analyze. Defend." }`; no visible "NEON"; internal identifiers unchanged (spec §2).
- Budgets (spec §6): lessons/labs +0 KB; cinematic routes ≤ +110 KB compressed first-load over baseline; `three` chunk ≤ 160 KB, lazy, desktop-only, motion-allowed only.
- Reduced motion (OS OR toggle) ⇒ no camera, pin, Lenis, kinetic type, morph, 3D: final states immediately.
- Local git only; commits end with the session attribution line.

## Review Focus

1. Lenis + keyboard/anchors: Page Down/Space/Home/End, `#rank-1` links and Tab-into-view must scroll correctly with smooth scroll on. Test in Task C2.
2. Reduced motion toggled while a pinned scene is mid-way: timeline reverted, pin spacers removed, Lenis destroyed, WebGL paused/disposed — content in final state. Test in Task G.
3. Resize across 768 px (desktop ↔ phone layout) mid-page: scenes switch between pinned and static without leaving offsets. Test in Task C1.
4. WebGL unavailable or context lost → `BladeMark` shown, no console error loop. Test in Task C3.
5. Very short desktop windows (1280×600): every pinned scene's content fits or scrolls internally; nothing essential is cut off. Test in Task D.

---

### Task A: Brand migration

**Files:** `lib/brand.ts`, `lib/generators/flag.ts`, `labs/core-r1-net-web-lab-01/lab.yaml`, `app/page.tsx` (h1), `components/shell/AppShell.tsx` / header + `components/theme/SiteFooter.tsx` (wordmark), `README.md`, `CLAUDE.md` (product name line only), tests that pin the name/flag (`tests/unit/lib/brand.test.ts`, `tests/e2e/review-focus.spec.ts`, `tests/e2e/helpers/rank0.ts`, `tests/e2e/rank-0.spec.ts`, `tests/labs/helpers.ts`), code comments that say "NEON's".
- [ ] Failing tests: `brand.test.ts` expects the three BRAND fields; a flag test expects `formatFlag(...)` to match `/^CYBERBLADE\{[0-9a-f]{12}\}$/`; new e2e `tests/e2e/brand.spec.ts`: `/`, `/start`, `/dashboard`, `/learn/core`, `/credits` contain no visible text matching `/\bNEON\b/` and the title ends with "CYBERBLADE".
- [ ] Implement; update the pinned expectations; `npm test && npm run check:content && npx playwright test` → PASS. Commit `feat(brand): CYBERBLADE — Breach-Level Analysis of Digital Exploitation`.

### Task B: Finalize tokens and primitives for cinema

**Files:** `components/art/PosterHeading.tsx` (`split="chars"`), `components/art/TechnicalDiagram.tsx` (node `morph`), `components/art/BladeMark.tsx` (new, justified in spec §3.4), `app/globals.css` (perspective/stage tokens, pink-dominant and cyan-dominant scene tones), tests.
- [ ] Failing tests: split heading keeps accessible name "CYBERBLADE" and renders one `[data-char]` per letter; diagram node with `morph` renders `data-morph` JSON and its final position in `style`; `BladeMark` is an `aria-hidden` SVG unless given `title`.
- [ ] Implement → PASS. Commit `feat(art): cinematic primitive extensions — split type, morphing nodes, blade mark`.

### Task C1: Scene engine (`ScrollScene` scene language)

**Files:** `lib/art/scene.ts` (pure: parse/validate attributes → tween specs), `components/art/motion/ScrollScene.tsx`, tests.
- [ ] Failing tests (`scene.test.ts`): `parseScene` turns `data-from/at/dur/chars/morph/camera` into tween specs; invalid JSON is ignored with no throw; `at`/`dur` clamp to 0–1; morph interpolation at p=0/0.5/1. Component: one timeline per scene; none with reduced motion; `mobile="play"` on < 768 px builds an unscrubbed, unpinned timeline; crossing 768 px reverts and rebuilds (Review Focus #3).
- [ ] Implement → PASS. Commit `feat(art): scene engine — declarative camera, kinetic type and morph timelines`.

### Task C2: Smooth scroll

**Files:** `components/art/motion/SmoothScroll.tsx` (client; mounted only by cinematic pages), tests + `tests/e2e/art-scroll.spec.ts`.
- [ ] Failing tests: not created with reduced motion / on touch / below 768; e2e (desktop): `End` reaches the footer, `#rank-1` link lands the rank in view, Tab to a below-fold link scrolls it into view (Review Focus #1).
- [ ] Install `lenis`; implement → PASS. Commit `feat(art): smooth scroll on cinematic routes`.

### Task C3: 3D blade

**Files:** `components/art/motion/BladeObject.tsx` (client, lazy `three`), `lib/art/blade-geometry.ts` (pure geometry), tests.
- [ ] Failing tests: geometry builder returns closed facets and N orbit nodes; loader not called when width < 1024, coarse pointer, reduced motion or no WebGL2; context loss → falls back to `BladeMark` (Review Focus #4); unmount disposes renderer/geometries.
- [ ] Install `three`; implement → PASS; record the chunk size. Commit `feat(art): lazy WebGL blade with SVG fallback`.

### Task D: Landing — six scenes

**Files:** `app/page.tsx`, `lib/art/landing.ts` (scene copy, network/interface/attack/defence node sets with morph paths, learning-system stages), `tests/e2e/art-landing.spec.ts` (rewrite), unit tests.
- [ ] Failing tests: six scene sections BOOT…ENTER in order with headings; one `h1` "CYBERBLADE"; two Start links; four track headings; learning-system stages LEARN→MASTER in order; node sets share ids across morph stages; no-JS and reduced motion show all copy; phone: no overflow and no request for the `three` chunk; leaving mid-scene leaves no pin spacer; 1280×600: each pinned scene's heading and primary copy within the viewport at its midpoint (Review Focus #5).
- [ ] Implement scene by scene (01 → 06), reviewing each in the browser at 1280 and 375 with motion on, against the quality bar. Commit after each pair of scenes.

### Task E: Dashboard entry + course map + /learn/core

**Files:** `app/(app)/dashboard/page.tsx`, `components/dashboard/CourseMap.tsx`, `app/(app)/learn/core/page.tsx`, tests (art-system plan Tasks 5–7 content, plus the cinematic intro/scene).
- [ ] Failing tests: art-system plan Task 5–7 assertions (operator file, CLASSIFIED file, campaign path stamps, mission log, locked notice) + dashboard intro builds one timeline and none with reduced motion; extreme data (24-char handle, 99,999 XP) fits at 375.
- [ ] Implement → full e2e PASS. Commit per page.

### Task F: Challenge entry + rank-up

**Files:** `app/(app)/challenge/[rank]/page.tsx` (+ its client components), rank-up moment where promotion is shown, tests.
- [ ] Failing tests: "MISSION DEPLOYED" intro present; timer, objectives and terminal fully usable during/after the intro (keyboard focus lands in the terminal as before); rank-up shows `ACCESS_GRANTED_` and the new rank; reduced motion shows final states.
- [ ] Implement → rank-0 challenge e2e still PASS. Commit.

### Task G: Performance, mobile, accessibility pass

- [ ] Tests: art-system plan Task 8–10 assertions (320/375 no overflow, tap targets, tilts off, vertical paths, keyboard order, high contrast luminance, `aria-hidden` decor, one h1) + Review Focus #2 (toggle reduced motion mid-scene).
- [ ] Measure first-load JS per route with the shoot script and the lazy `three` chunk; fix anything over budget. Commit.

### Task H: Full regression + report

- [ ] `npm run lint && npm run typecheck && npm test && npm run check:content && npm run build && npm run test:e2e` → all exit 0.
- [ ] Browser walkthrough at desktop and 375 px (motion on, reduced motion, high contrast, keyboard); after-screenshots with the shoot script.
- [ ] `docs/visual/report.md`: brand changes, cinematic architecture, ScrollScene architecture, 3D architecture, landing scene breakdown, pages upgraded, performance, mobile, accessibility, tests. Final whole-branch review, then local merge.
