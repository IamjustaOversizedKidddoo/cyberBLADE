# NEON Visual Art System — Part 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NEON's reusable art system (textures, poster type, compositions, diagrams, art slots, motion primitives) and use it to recompose the landing page, dashboard, course map and `/learn/core` into art-directed editorial experiences — without breaking any existing behaviour.

**Architecture:** Three layers with one owner each (spec §3): server-rendered SVG/CSS art (no JS), GSAP + ScrollTrigger for scroll storytelling inside `ScrollScene`/`Parallax` only (code-split), Motion for component-level motion inside `Reveal`/`Counter`/`Magnetic`/`MissionMarker` only. Pages import primitives from `components/art/`, never `gsap`/`motion` directly (lint-enforced). Server HTML is always the final readable composition.

**Tech Stack:** Next.js 16.3.8 App Router, React 19.2, Tailwind v4 tokens, TypeScript, Vitest + Testing Library (jsdom), Playwright. New: `gsap@^3.15`, `@gsap/react@^2.1`, `motion@^14` (peer deps verified 2026-10-08: React ≥17 / ^18||^19).

**Spec:** `docs/specs/2026-10-08-visual-art-system-design.md` (approved 2026-10-08). Also `CLAUDE.md` theme rules; `AGENTS.md` (Next 16 — check `node_modules/next/dist/docs/` before using a Next API).

## Global Constraints

Owner rules (2026-10-08), binding on every task:

1. **Art serves the content.** Every illustration, diagram, texture and composition communicates something about its section; nothing is added to fill space.
2. **No one-off visual components.** Pages compose only: HalftoneField, NoiseLayer, InkEdge, PosterHeading, SystemLabel, Annotation, PosterSection, DossierCard, VisualDivider, TechnicalDiagram, EditorialIllustration, RankNode, MissionMarker, ScrollScene, Parallax, Reveal, Counter, Magnetic, TypingText, BlinkCursor (plus existing non-visual building blocks: DisplaySettings, TerminalPanel, AppShell, SiteFooter, RankBadge). **If another visual component seems necessary, stop and explain before creating it.**
3. **Original artwork only.** No Watch Dogs/Ubisoft assets, logos, characters, screenshots, DedSec symbols, names or copied artwork.
4. **Placeholders look intentional:** `EditorialIllustration` without `src` renders a composed NEON editorial piece (halftone + shapes + annotations), never a grey box.
5. **Content hierarchy first:** art never makes lessons, navigation, buttons, forms or terminals harder to use.
6. **Mobile is a real composition:** use the spec's mobile arrangements (spec §5, §6), never just scaled desktop.
7. **Motion hierarchy:** strong for storytelling moments, restrained for UI. Reduced motion (system `prefers-reduced-motion` OR `html[data-motion="reduce"]`) disables scroll scenes, parallax and all decorative animation completely.
8. **Performance is hard:** GSAP only on routes that render `ScrollScene`/`Parallax` (dynamic import); textures are CSS/tile based (≤ 4 KB tiles, no live `feTurbulence`, no large blurs); no unnecessary client components. Budgets: lesson/lab routes +0 KB JS; landing/dashboard/learn-core ≤ +80 KB gzip over the baseline measured in Task 1.
9. **Accessibility:** decorative art `aria-hidden="true"`; meaningful art has useful alt/text equivalents; annotations never carry essential information only through styling; keyboard navigation and readable typography intact; one `h1` per page; DOM order = reading order.
10. **Preserve functionality:** auth/onboarding, dashboard, course and lesson links, labs, tests, display settings, reduced motion, high contrast. Accessible names/selectors used by tests (spec §2) stay, unless a test is deliberately updated in the same commit.
11. **Build order:** A primitives → B visual tokens/composition utilities → C landing → D dashboard → E course map → F `/learn/core` → G responsive/mobile → H motion polish → I accessibility/performance. One page at a time.
12. **Quality bar:** before a page task is done, review its desktop and 375 px screenshots against "does this feel like a deliberately art-directed digital experience?" and fix what doesn't.

Project constraints: palette tokens only (`void`, `ink`, `paper`, `muted`, `line`, `cyan #0FBEFF`, `purple #C83CFF`, `pink #FF1065`); fonts unchanged (Hacked display only, Pixel Operator UI, Plex reading, JetBrains Mono code); high contrast turns paper bands dark; Hacked credit kept; local git only (merge to local `main`, never push); commits end with the session's attribution line.

## Review Focus

1. Reduced motion switched on with NEON's toggle **after** a page has loaded → running scroll scenes are reverted at once (no pins, no hidden content, no parallax offset). Test in Task 9.
2. Client-side navigation away from the landing page mid-scroll and back (App Router) → no leftover pin spacers or ScrollTriggers; the next page isn't offset or scroll-locked. Test in Task 4.
3. JavaScript disabled or not yet hydrated → every section's text, links and the Start buttons are visible (Reveal/Counter render final state in server HTML). Test in Task 4.
4. Extreme operator data — a 24-character handle, XP 99,999, rank 2 with every lesson done → dossier wraps without overflow at 375 px; numbers stay legible. Test in Task 5.
5. High contrast on → every paper band is dark and every diagram/annotation stroke is still visible (art uses `currentColor`/tokens). Test in Task 10.

---

### Task 1: Motion foundation and baselines (build order A, part 1)

**Files:**
- Modify: `package.json` (deps), `eslint.config.mjs` (restricted imports)
- Create: `components/art/motion/reduced.ts`, `components/art/motion/ScrollScene.tsx`, `components/art/motion/Parallax.tsx`, `components/art/motion/Reveal.tsx`, `components/art/motion/Counter.tsx`, `components/art/motion/Magnetic.tsx`, `components/art/motion/MotionProvider.tsx`, `components/art/motion/index.ts`
- Create: `docs/visual/baseline.md` (route sizes + before screenshots list), screenshots under `docs/visual/before/`
- Test: `tests/unit/components/art/motion.test.tsx`

**Interfaces:**
- Produces:
  - `useReducedMotion(): boolean` — true when `matchMedia("(prefers-reduced-motion: reduce)")` matches OR `document.documentElement.dataset.motion === "reduce"`; updates live (MutationObserver on `data-motion`, media-query listener). Server/first render: `false`-safe because components render final state regardless.
  - `<MotionProvider>` — client wrapper: `LazyMotion features={domAnimation}` + `MotionConfig reducedMotion={reduced ? "always" : "never"}`; mounted once in `app/layout.tsx` around `children`.
  - `<Reveal mode="clip" | "mask" | "rise" delay?: number as?: keyof JSX.IntrinsicElements>` — children are in the server HTML in final state; after hydration, if motion allowed and the element is below the fold, animates from offset to final when it enters view (Motion `whileInView`, `once: true`).
  - `<Counter to: number format?: (n) => string>` — renders `format(to)` in markup; animates 0→to on view only when motion allowed; `aria-label` holds the final value.
  - `<Magnetic strength?: number>` — wraps one interactive child; pointer-follow translate ≤ 8 px only under `(hover: hover) and (pointer: fine)` and motion allowed; never affects focus/keyboard.
  - `<ScrollScene pin?: boolean scrub?: boolean | number steps?: number onStep?: (i: number) => void minWidth?: number = 768 className children>` — client; lazily imports `gsap` + `ScrollTrigger` + `useGSAP`; only active when motion allowed AND viewport ≥ `minWidth`; reports progress step via `onStep` and sets `data-step` on its root; cleans up on unmount and when reduced motion turns on.
  - `<Parallax speed: number children>` — client; GSAP y-translate scrubbed, same gating as ScrollScene.
  - `components/art/motion/index.ts` re-exports these; `ScrollScene`/`Parallax` exported via `next/dynamic(() => import(...), { ssr: true })` wrappers so GSAP chunks load only where used.

- [ ] **Step 1: Baselines.** On this branch before any change: `npm run build` → record the per-route First Load JS for `/`, `/dashboard`, `/learn/core`, `/learn/[lessonId]`, `/labs/[labId]` in `docs/visual/baseline.md` (if Next 16's output omits sizes, sum the route's client chunks from `.next/` build manifests with a scratch script and record the method). Take before screenshots (desktop 1280×800 and 375×812) of `/`, `/dashboard`, `/learn/core` via the browser pane into `docs/visual/before/`.
- [ ] **Step 2: Install** `npm install gsap@^3.15 @gsap/react@^2.1 motion@^14`; `npm run build` → PASS (compatibility smoke). If it fails on a peer/API incompatibility: stop and report to the owner.
- [ ] **Step 3: Failing tests** `motion.test.tsx` (jsdom): `useReducedMotion` true when `data-motion="reduce"` is set after mount (re-renders), true when the media query matches, false otherwise; `Reveal` server-renders children visible (no `opacity:0`/hidden style in `renderToString`); `Counter to={1234}` renders "1234" in `renderToString` output and `aria-label="1234"`; `Magnetic` does not change the child's tab order or add `tabIndex`; `ScrollScene` renders its children and, with reduced motion, never calls the GSAP loader (spy on the dynamic import module).
- [ ] **Step 4:** Run → FAIL. Implement. Run `npx vitest run tests/unit/components/art` → PASS.
- [ ] **Step 5: Lint guard.** Add `no-restricted-imports` for `gsap`, `gsap/*`, `@gsap/react`, `motion`, `motion/*` everywhere except `components/art/motion/**`; `npm run lint` → 0 errors.
- [ ] **Step 6:** Mount `MotionProvider` in `app/layout.tsx`. `npm test && npm run typecheck && npm run build` → PASS. Commit `feat(art): motion foundation — reduced-motion switch, GSAP scenes, Motion primitives`.

---

### Task 2: Art primitives (build order A, part 2)

**Files:**
- Create: `lib/art/diagram.ts`; `components/art/HalftoneField.tsx`, `NoiseLayer.tsx`, `InkEdge.tsx`, `PosterHeading.tsx`, `SystemLabel.tsx`, `Annotation.tsx`, `PosterSection.tsx`, `DossierCard.tsx`, `VisualDivider.tsx`, `TechnicalDiagram.tsx`, `EditorialIllustration.tsx`, `RankNode.tsx`, `MissionMarker.tsx` (client: Motion pulse), `components/art/index.ts`; `public/art/tiles/{grain,photocopy}.png` (≤ 4 KB each, generated by a committed script `scripts/art/make-tiles.mts` from seeded noise)
- Modify: `components/theme/HeroBand.tsx` (becomes a thin `PosterSection` wrapper keeping `.neon-hero`), `components/theme/Scanlines.tsx` (thin `NoiseLayer kind="crt"` wrapper keeping `.neon-scanlines`), `components/theme/GlitchText.tsx` (used by `PosterHeading glitch`)
- Test: `tests/unit/lib/art/diagram.test.ts`, `tests/unit/components/art/primitives.test.tsx`

**Interfaces:**
- Produces (`lib/art/diagram.ts`):
  - `type DiagramNode = { id: string; x: number; y: number /* 0–100 viewBox units */; label: string; kind?: "host" | "step" | "rank" | "cloud" | "signal" }`
  - `type DiagramLink = { from: string; to: string; shape?: "straight" | "orthogonal" | "curve"; dashed?: boolean }`
  - `linkPath(a: DiagramNode, b: DiagramNode, shape): string` — SVG path `d`.
  - `stackVertically(nodes: DiagramNode[], gap = 100 / nodes.length): DiagramNode[]` — mobile layout: same order, x = 50, evenly spaced y.
  - `zigzag(count: number): { x: number; y: number }[]` — course-map desktop layout, alternating x 20/80, increasing y.
  - `rankStatus(operatorRank: number, rank: number): "cleared" | "current" | "locked"`.
- Produces (components; props exactly as spec §4): `HalftoneField({ tone, density = 6, angle = 45, fade?: "left"|"right"|"top"|"bottom"|"radial" })`, `NoiseLayer({ kind })`, `InkEdge({ edge, variant = 1, tone })`, `PosterHeading({ as = "h2", lines: string[], bleed?: "left"|"right", vertical?: boolean, glitch = false, size: "hero"|"section"|"label" })`, `SystemLabel({ children, tone = "muted" })`, `Annotation({ from: [x,y], to: [x,y], label, hand = true })`, `PosterSection({ tone, labelledBy?, className, children })` with zone children `PosterSection.Type`, `.Art`, `.Caption`, `.Labels` (each takes `desktop` and `mobile` grid-area class strings), `DossierCard({ fileNo, stamp?, title, redact?, children })`, `VisualDivider({ kind })`, `TechnicalDiagram({ nodes, links, active?: string, style = "schematic", title: string /* accessible name */, mobileNodes?: DiagramNode[] })`, `EditorialIllustration({ slot: "operator" | "system" | "signal", alt?: string, decorative?: boolean, caption?, src?, crop? })`, `RankNode({ rank, name, status, xp, lessons: { done, total }, mission, children? })`, `MissionMarker({ active: boolean })`.
- Rules: textures, `InkEdge`, `VisualDivider`, `MissionMarker` and diagram strokes are `aria-hidden`; `TechnicalDiagram` renders an SVG with `role="img"` + `aria-label={title}` AND a visually-hidden `<ol>` of node labels in order (text equivalent); `EditorialIllustration` throws in development when neither `alt` nor `decorative` is given; all colours via `currentColor`/token CSS variables.

- [ ] **Step 1: Failing tests.** `diagram.test.ts`: `linkPath` for straight (`M x1 y1 L x2 y2`), orthogonal (one elbow at mid-x), curve (cubic); `stackVertically` keeps order, x=50, y strictly increasing within 0–100; `zigzag(3)` → `[{x:20,y:…},{x:80,…},{x:20,…}]`; `rankStatus(1,0)="cleared"`, `(1,1)="current"`, `(1,2)="locked"`. `primitives.test.tsx`: HalftoneField/NoiseLayer/InkEdge/VisualDivider render `aria-hidden="true"`; `PosterHeading lines={["RANK_00"]} as="h1"` renders exactly one `h1` with text "RANK_00" (decorative glitch copies aria-hidden); `TechnicalDiagram title="Learning loop"` exposes `role="img"` named "Learning loop" and a list with every node label; `EditorialIllustration slot="operator"` without alt/decorative throws; with `alt` renders the placeholder with that alt and no `<img>`; with `src` renders an `<img>` with that alt; `DossierCard redact` replaces redacted text (the original string is absent from the DOM); `RankNode status="locked"` shows "SECTOR LOCKED" text, `"cleared"` shows "CLEARED".
- [ ] **Step 2:** Run → FAIL. Implement (tiles via `npx tsx scripts/art/make-tiles.mts`; check each ≤ 4 KB). Run → PASS.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint && npx playwright test` → PASS (HeroBand/Scanlines wrappers keep existing pages and the `.neon-hero`/`.neon-scanlines` e2e checks green). Commit `feat(art): NEON art primitives — textures, poster type, compositions, diagrams, art slots`.

---

### Task 3: Visual tokens and composition utilities (build order B)

**Files:**
- Modify: `app/globals.css`
- Test: `tests/unit/components/art/tokens.test.ts` (reads `globals.css` as text), e2e smoke later in Task 10

**Interfaces:**
- Produces CSS custom properties and utilities used by all primitives:
  - Band tones: `--band-bg`, `--band-fg`, `--band-accent` set by `.band-paper`, `.band-void`, `.band-cyan`; under `[data-contrast="high"]` `.band-paper` and `.band-cyan` resolve to dark backgrounds with light foregrounds (art strokes use `--band-fg`, so they invert).
  - Type scale for poster type: `--poster-hero: clamp(4rem, 17vw, 15rem)`, `--poster-section: clamp(2.75rem, 9vw, 7.5rem)`, `--poster-label: clamp(1.25rem, 3vw, 2rem)`.
  - Layering: `--z-texture: 0`, `--z-art: 1`, `--z-type: 2`, `--z-ui: 3`.
  - Composition: `.poster-grid` (12-col desktop / 4-col mobile CSS grid with named lines), `.bleed-left`, `.bleed-right` (translate past the edge, clipped by the band's `overflow: clip`), `.vertical-type` (`writing-mode: vertical-rl`), `.tilt-1/.tilt-2/.tilt--1` (±1.5°/±3°, removed under 640 px).
  - Motion CSS: `html[data-motion="reduce"] *, @media (prefers-reduced-motion: reduce)` → `animation: none !important; transition-duration: 0s !important` scoped to `.art-anim` classes only (never disables focus outlines).
- Primitives from Task 2 switch from ad-hoc classes to these tokens.

- [ ] **Step 1: Failing test** `tokens.test.ts`: `globals.css` defines `--poster-hero`, `.band-paper`, `.band-void`, `.band-cyan`, `.poster-grid`, and a `[data-contrast="high"] .band-paper` rule; and the reduced-motion block exists for both the media query and `data-motion="reduce"`.
- [ ] **Step 2:** Run → FAIL. Implement; refactor primitives to the tokens. Run `npm test && npx playwright test tests/e2e/review-focus.spec.ts` → PASS (existing high-contrast hero test still green).
- [ ] **Step 3:** Commit `feat(art): visual tokens and composition utilities`.

---

### Task 4: Landing page (build order C)

**Files:**
- Modify: `app/page.tsx`
- Create: `lib/art/landing.ts` (pure data: section copy, learning-loop nodes/links, track glyph diagrams)
- Test: `tests/unit/lib/art/landing.test.ts`, `tests/e2e/art-landing.spec.ts`

**Interfaces:**
- Consumes: all Task 1–3 primitives; `BRAND`, `TRACKS`.
- Produces: `LOOP_DIAGRAM: { nodes: DiagramNode[]; links: DiagramLink[] }` (Briefing → Terminal Check → Lab → Debrief → Briefing, existing LOOP copy as annotations); `TRACK_GLYPHS: Record<"purple-team" | "soc" | "pentest" | "cloud", { nodes; links }>` (split attack/defend paths; signal trace; attack path through 3 hosts; 3-region topology). Track ids must match `lib/catalog/tracks.ts`.
- Composition: exactly spec §5.1 sections ENTER, DISCOVER, UNDERSTAND (pinned `ScrollScene` ≥ 768 px, `onStep` sets the diagram `active` node), CHOOSE (dossier wall), START. Each section is a `PosterSection` with its `labelledBy` heading; the page has one `h1` ("NEON" via `PosterHeading as="h1"`); both "Start" links keep the accessible name "Start" and href `/start`.

- [ ] **Step 1: Failing tests.** `landing.test.ts`: `LOOP_DIAGRAM` has 4 nodes in order Briefing, Terminal Check, Lab, Debrief and a link back to Briefing; every open track in `TRACKS` has a `TRACK_GLYPHS` entry. `art-landing.spec.ts`: (desktop) one `h1`; sections ENTER/DISCOVER/UNDERSTAND/CHOOSE/START present by heading; both "Start" links go to `/start`; the four open track titles visible. (Review Focus #3) with `javaScriptEnabled: false` every section heading, all four LOOP step texts, all four track titles and both Start links are visible. (Review Focus #2) scroll to the middle of UNDERSTAND, click a link to `/credits`, go back, then navigate to `/start`: no element with class `pin-spacer` exists on `/start` and `document.documentElement.scrollHeight` on `/start` equals a fresh load's value (±2 px). (mobile 375) no horizontal scroll; ENTER uses the stacked heading arrangement (heading box narrower than viewport).
- [ ] **Step 2:** Run → FAIL. Implement. Run `npx playwright test tests/e2e/art-landing.spec.ts tests/e2e/smoke.spec.ts tests/e2e/review-focus.spec.ts tests/e2e/onboarding.spec.ts` + unit → PASS.
- [ ] **Step 3: Quality bar** (rule 12): screenshots desktop + 375 to `docs/visual/after/landing-*.png`; review against the brief; fix and repeat until it holds. Commit `feat(landing): art-directed landing — enter, discover, understand, choose, start`.

---

### Task 5: Dashboard (build order D)

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Test: `tests/e2e/art-dashboard.spec.ts`

**Interfaces:**
- Consumes: primitives; existing dashboard data (operator, xp, rank progress, `CourseMap`).
- Composition: spec §5.2 — briefing band (`PosterHeading as="h1"` `RANK_0N`, "OPERATOR FILE" `DossierCard` with handle, rank name, `Counter` XP, lessons done, the existing next-mission link with unchanged name/href, `SystemLabel`s), the welcome kicker keeps `[data-typed]`; campaign map (CourseMap, restyled in Task 6); "CLASSIFIED — FUTURE OPERATIONS" `DossierCard` listing coming-soon roles by group (role names readable).

- [ ] **Step 1: Failing tests** `art-dashboard.spec.ts`: after onboarding, heading "RANK_00" is the page's only `h1`; "OPERATOR FILE" visible with the handle and "0 XP"; link "Begin rank_0" → `/learn/core#rank-0`; "CLASSIFIED" file lists every coming-soon role name from `TRACKS`. (Review Focus #4) onboard with a 24-character handle, set XP 99999 and rank 2 via the dev-only progress store fixture used by existing e2e helpers (or seed the JSON store file directly in the test's temp data dir): at 375 px no horizontal scroll, the handle and "99,999" fully visible inside the dossier box.
- [ ] **Step 2:** Run → FAIL. Implement. Run the dashboard + onboarding + rank-0 e2e specs → PASS.
- [ ] **Step 3: Quality bar** screenshots `docs/visual/after/dashboard-*.png`, review, fix. Commit `feat(dashboard): operator file and classified operations`.

---

### Task 6: Course map (build order E)

**Files:**
- Modify: `components/dashboard/CourseMap.tsx`
- Test: `tests/unit/components/dashboard/CourseMap.test.tsx`, extend `tests/e2e/art-dashboard.spec.ts`

**Interfaces:**
- Consumes: `zigzag`, `stackVertically`, `rankStatus`, `RankNode`, `MissionMarker`, `TechnicalDiagram`, `ScrollScene` (path draw scrub).
- Composition: spec §5.3 campaign path — ranks 00→01→02 then a branch to the four track nodes; current node: `MissionMarker active` + cyan, keeps heading text `rank_N · Name` and the `Begin rank_N`/`Continue` link; cleared nodes stamped "CLEARED"; locked nodes "SECTOR LOCKED" with hatched `HalftoneField`; path fully drawn without motion; vertical on mobile.

- [ ] **Step 1: Failing tests** `CourseMap.test.tsx`: for `currentRank=1` → rank 0 shows "CLEARED", rank 1 has the "Continue"/"Begin rank_1" link to `/learn/core#rank-1`, rank 2 shows "SECTOR LOCKED" and no link; headings read `rank_0 · Initiate`, `rank_1 · Operator`, `rank_2 · Watcher`; the four open tracks appear as locked sector nodes. e2e: the rank-0 journey (`tests/e2e/rank-0.spec.ts`) and rank gate still pass unchanged.
- [ ] **Step 2:** Run → FAIL. Implement. Run unit + `npx playwright test tests/e2e/rank-0.spec.ts tests/e2e/rank-gate.spec.ts tests/e2e/art-dashboard.spec.ts` → PASS.
- [ ] **Step 3: Quality bar** screenshots, review, fix. Commit `feat(course-map): campaign path with rank nodes and locked sectors`.

---

### Task 7: `/learn/core` (build order F)

**Files:**
- Modify: `app/(app)/learn/core/page.tsx`
- Test: extend `tests/e2e/art-dashboard.spec.ts` (or new `tests/e2e/art-learn-core.spec.ts`)

**Interfaces:**
- Composition: spec §5.3 — each rank section opens with a `RankNode` banner (keeps `id="rank-N"` and the `rank_N · Name` heading); lessons as a numbered mission log (`ol > li > a`, numbers `01`, `02`…, status glyph with text equivalent, minutes, XP) with unchanged hrefs; locked ranks list titles without links under "SECTOR LOCKED"; the `?locked=N` notice is a `DossierCard`-styled box keeping `role="status"` and its exact text.

- [ ] **Step 1: Failing tests:** lesson rows are `main ol a[href^="/learn/core-r0-"]` (6 for rank 0) with visible "01"…"06"; `?locked=1` shows the status text "Locked — pass the Rank 0 challenge to open this." inside the dossier; every row's status is announced as text (e.g. "completed", "not started"), not only by colour.
- [ ] **Step 2:** Run → FAIL. Implement. Run the full e2e suite → PASS (rank-0, rank-gate, rank-1-networking rely on these links and anchors).
- [ ] **Step 3: Quality bar** screenshots, review, fix. Commit `feat(learn-core): rank banners and mission log`.

---

### Task 8: Responsive/mobile compositions (build order G)

**Files:** the three pages + primitives touched as needed (no new components)
- Test: `tests/e2e/art-mobile.spec.ts`

- [ ] **Step 1: Failing tests** (chromium-mobile 375×812 and a 320 px width check): `/`, `/dashboard`, `/learn/core` have no horizontal page scroll at 320 and 375; ENTER heading stacked; dossier wall single column and unrotated (computed `transform` is `none`); course-map path vertical (node x positions equal ±1 px); no `pin-spacer` elements at ≤ 767 px; tap targets for Start/Begin/lesson links ≥ 44 px tall.
- [ ] **Step 2:** Run → FAIL where compositions fall short. Fix using the mobile zone arrangements. Run → PASS. Screenshots `docs/visual/after/*-375.png`; quality-bar review. Commit `feat(art): mobile compositions`.

---

### Task 9: Motion polish (build order H)

**Files:** `components/art/motion/*`, the three pages (scene tuning only)
- Test: `tests/e2e/art-motion.spec.ts`, extend `tests/unit/components/art/motion.test.tsx`

- [ ] **Step 1: Failing tests.** e2e with `reducedMotion: "reduce"`: no `pin-spacer`, every `Reveal` child has computed opacity 1 and no transform at load, Counter shows final values, MissionMarker has no running animation (`getAnimations().length === 0`). (Review Focus #1) load `/` with motion allowed, scroll into UNDERSTAND (pinned), click "Reduce motion": within one frame there is no `pin-spacer`, the diagram shows all four annotations, and `window.scrollY` content is not hidden (all section headings have opacity 1). Unit: `ScrollScene` kills its timeline when `useReducedMotion` flips to true.
- [ ] **Step 2:** Run → FAIL. Implement (gsap.matchMedia + `data-motion` observer → `ctx.revert()`). Tune hierarchy: hero/UNDERSTAND/course-map path strong; dossier stagger and Reveal ≤ 600 ms; UI hover ≤ 150 ms. Run → PASS. Commit `feat(art): motion hierarchy and live reduced-motion`.

---

### Task 10: Accessibility and performance pass (build order I) + final gate

**Files:** as needed; `docs/visual/report.md`
- Test: `tests/e2e/art-a11y.spec.ts`

- [ ] **Step 1: Failing tests.** Keyboard: Tab order on `/` reaches skip/nav, hero Start, every track dossier link (if links), footer Start in DOM order with visible focus ring (computed outline 2 px cyan); on `/dashboard` reaches the next-mission link before the course map. (Review Focus #5) high contrast on: every `.band-paper`/`.band-cyan` computes a dark background (luminance < 0.2) and every `TechnicalDiagram` stroke computes a light colour (luminance > 0.6). Decorative layers have `aria-hidden="true"`; each page has exactly one `h1`; every `img` has non-empty alt.
- [ ] **Step 2:** Run → FAIL where needed; fix. Run → PASS.
- [ ] **Step 3: Performance.** `npm run build`; record after-sizes next to the Task 1 baseline in `docs/visual/report.md`; verify lesson and lab routes +0 KB and art routes ≤ +80 KB gzip; verify GSAP chunks appear only in routes rendering ScrollScene/Parallax. Over budget → reduce (lazy islands, LazyMotion features) before continuing.
- [ ] **Step 4: Final gate.** `npm run lint && npm run typecheck && npm test && npm run check:content && npm run build && npm run test:e2e` → all exit 0. Verify in the browser pane: desktop and 375 px, reduced motion, high contrast, keyboard. Write `docs/visual/report.md`: primitives created, pages upgraded, how art differs per section, motion system, responsive strategy, performance before/after, a11y, tests run, before/after screenshot index. Commit `docs(visual): part 1 report`. Then final whole-branch review and local merge per the executing-plans skill.
