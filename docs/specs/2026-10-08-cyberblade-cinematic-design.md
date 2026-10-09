# CYBERBLADE — Brand + Cinematic Experience Design

**Status:** Draft, written on the owner's instruction "start by updating the specification and plan, then implement incrementally" (2026-10-08). Supersedes the *page compositions* (§5) and motion details of `docs/specs/2026-10-08-visual-art-system-design.md`; everything else in that spec (layers, primitives, tokens, accessibility, budgets unless changed below) still applies.
**Branch:** `visual-art-system` (continues; Tasks 1–4 of the art-system plan are done and are the foundation).
**Owner brief:** "CYBERBLADE — Brand + Awwwards Cinematic Experience Directive" (2026-10-08).

## 1. Intent

The site should feel like an interactive cyber-intelligence film: **scroll is a camera** moving through the CYBERBLADE world. Each major section is a *scene* with a beginning, middle and end; type, art, diagrams and (sparingly) 3D transform continuously between scenes instead of the page simply stacking sections. Strongest treatment: landing, dashboard entry, course map, rank transitions, challenge entry. Lessons prioritise reading; labs prioritise interaction.

**Success criteria** (in addition to the art-system spec's six):
1. The landing page is six pinned/connected scenes (§4) on desktop; each has a visible camera move and typography that participates.
2. With reduced motion (OS or toggle) the user immediately sees every scene's final composition — no camera moves, no pinning, no 3D animation, no kinetic type.
3. Phones get a simplified cinematic version (§7) with no horizontal overflow at 375 px and no WebGL download.
4. No visible "NEON" product name remains (§2).

## 2. Brand

```ts
export const BRAND = {
  name: "CYBERBLADE",
  fullName: "Breach-Level Analysis of Digital Exploitation",
  tagline: "Learn. Breach. Analyze. Defend.",
} as const;
```

- Presentation: `CYBERBLADE_` (underscore = terminal cursor, rendered by `BlinkCursor`, not part of accessible names), `CYBERBLADE // SYSTEM ONLINE` as a system label, the full name as the subtitle. The acronym echoes the B.L.A.D.E curriculum.
- Applies to every visible surface: metadata/title template, header wordmark, footer, landing, dashboard, start/onboarding, lessons, course map, challenge, legal/credits, README and CLAUDE.md product name, test expectations.
- **Lab flags** become `CYBERBLADE{<12 hex>}` (`FLAG_PREFIX`). Answers are regenerated from each attempt's seed, so open attempts stay consistent.
- **Not renamed** (internal, no visible effect, renaming adds risk): CSS classes `neon-*`, the `neon_uid` cookie, `NEON_DATA_DIR` / `NEON_SHOW_DRAFTS` env vars, `.data` store names, past docs/plans/commit history.
- Risk note for the owner: check "CYBERBLADE" for trademark conflicts before public launch (not blocking local work).

## 3. Cinematic architecture

### 3.1 Scene engine (extends `ScrollScene`, no new animation components)

A scene is one `ScrollScene` = one pinned section = **one GSAP timeline** scrubbed by scroll (desktop). Everything inside is server-rendered in its **final state**; the scene animates *from* declared offsets *to* that state, so no-JS / reduced motion / phones show the finished composition.

Declarative scene language (data attributes on any element inside a scene; JSON values):

| Attribute | Meaning |
|---|---|
| `data-camera` | The scene's stage. Its from-state is the camera's start (e.g. `{"scale":5,"rotate":-4}` = extreme close-up → dolly back to 1). The scene root sets `perspective`, so `z`/`rotateX`/`rotateY` give depth, orbit and tilt. |
| `data-from='{...}'` | Start values for this element (opacity, x/y/xPercent/yPercent, scale, rotate, rotateX/Y, z, clipPath, filter: none of the expensive ones). |
| `data-at="0.35"` | When it starts, as a fraction of the scene (0–1). |
| `data-dur="0.2"` | How long it takes, as a fraction of the scene. |
| `data-chars='{...}'` | On a split heading: per-character from-values + `stagger` (kinetic typography). |
| `data-morph='[{x,y}…]'` | On a `TechnicalDiagram` node: earlier positions (%), interpolated to its final x/y across the scene — the dot-field → network → interface → attack-path → defence morphs. Links follow because they are recomputed from node positions each frame (GSAP `onUpdate` on the diagram only). |
| `data-step` / `--scene-progress` | Published by the scene as today (diagram node highlighting, path drawing). |

`ScrollScene` props: `pin`, `scrub`, `length` (scroll distance in viewport heights, default 2), `steps`, `minWidth` (768), `mobile: "static" | "play"` (`play` = on phones the same timeline plays once, 40% duration, when the scene enters — no pin). It builds the timeline once from the attributes, kills it on unmount/route change and when reduced motion turns on (`ctx.revert()` restores server styles).

**Continuity between scenes:** each scene's opening state is composed to match the previous scene's closing state (same element positions/colours, e.g. Scene 01 ends with the wordmark scattered where Scene 02's characters start), and scenes overlap by a short cross-fade (`data-from` opacity) so there are no hard cuts unless intended.

### 3.2 Smooth scrolling

`lenis` (~3 KB) on cinematic routes only (landing, dashboard, course map), synced to ScrollTrigger (`lenis.on("scroll", ScrollTrigger.update)`, GSAP ticker drives `lenis.raf`). Off with reduced motion, on touch devices, and on lessons/labs (native scroll for reading and terminals). Keyboard scrolling, anchor links (`#rank-N`) and focus scrolling keep working (Lenis `anchors: true`; focus changes call `lenis.scrollTo`).

### 3.3 3D

- **CSS 3D first:** camera moves, layered type (ANALYZE layers), card orbits use `perspective` + transforms in the scene engine.
- **One WebGL object:** `BladeObject` — an abstract faceted/wireframe blade with orbiting nodes, the brand's 3D signature, used in Scene 01 (behind the wordmark) and Scene 05 (stabilising). Built with plain `three` (no React Three Fiber: one object doesn't justify a second React renderer). Its rotation follows `--scene-progress` plus a slow idle spin.
- Loaded with `import()` only when: desktop width ≥ 1024, `(pointer: fine)`, WebGL2 available, motion allowed — after the page is interactive (`requestIdleCallback`). Paused when off-screen (IntersectionObserver), on `visibilitychange`, and disposed on unmount. Device pixel ratio capped at 1.5.
- Fallback everywhere else: `BladeMark` — the same blade as an SVG/CSS ink drawing (also the reusable brand mark for header/footer/certificates).

### 3.4 New primitives (justified; all reusable)

- `BladeMark` (server, SVG): the brand mark/fallback blade. Reused in header, footer, landing, future certificates.
- `BladeObject` (client, WebGL, lazy): the 3D blade (§3.3). Reused in landing scenes and later rank-up/challenge moments.
- Extensions, not new components: `PosterHeading split="chars"` (character spans for kinetic type); `TechnicalDiagram` nodes accept `morph` (earlier positions); `ScrollScene` gains the scene language above.

## 4. Landing page — six scenes

Each scene = one `ScrollScene pin` (desktop). Copy below is final unless marked.

1. **BOOT** (void). Tiny labels (`CYBERBLADE // SYSTEM ONLINE`, `SEQ 01/06`, coordinates), typed `> INITIALIZING CYBERBLADE_`, faint noise. Camera starts extremely close on the wordmark (`data-camera` scale ≈ 6, slight rotate) and dollies back; the characters of `CYBERBLADE` (the page `h1`, kinetic) track apart then settle; `BladeObject` (or `BladeMark`) rotates behind; at the end the full name, the tagline and **Start** are visible. Ends: wordmark characters drift outward (hand-off to 02).
2. **BREACH** (void → hairline cyan). The wordmark's fracture becomes `BREACH.`; a network `TechnicalDiagram` forms behind (links draw, nodes activate by `data-step`); camera tracks laterally through the network; labels appear (`PORT 22/tcp OPEN`, `AUTH FAIL ×14`, `NODE 10.0.2.15`). Copy: "Every attack starts with a way in. You'll learn how attackers find one — on systems you're allowed to test."
3. **ANALYZE** (void with paper insets). The network nodes morph into an intelligence interface (grid of readings); the `signal` illustration enters; `ANALYZE_` breaks into three stacked layers in depth and the camera moves through them. Copy: "Logs, packets, processes: evidence tells you what happened. You'll learn to read it."
4. **EXPLOIT** (void, pink dominant). Attack path (internet → web → internal → target) draws; camera tracks along it; terminal fragments (`TerminalPanel`, real-looking commands from the course labs) and pink warning labels; `EXPLOIT_` with the rare glitch. Copy: "Understand the attack well enough to stop it. Practised only in simulated labs, never on real targets."
5. **DEFEND** (void → cyan dominant). The attack-path nodes reorganise into layered defensive architecture (segmented zones, a firewall line); colours shift pink → cyan; the blade stabilises; `DEFEND_`. Copy: "Detect, contain, harden. The same knowledge, turned into protection."
6. **ENTER THE SYSTEM** (paper). The world resolves into the learning system: `LEARN → PRACTICE → BREACH → ANALYZE → DEFEND → MASTER` as a numbered path (lessons → terminal checks & labs → offensive labs → evidence labs → detection & hardening → rank challenges & exams); then the four launch-track dossiers; then the cyan **START AT RANK_00** band with the second **Start**.

Kept from the art-system build: `h1` (now "CYBERBLADE"), two Start links to `/start`, the four track titles as headings, the learning-loop content, `.neon-hero` on the first band, `[data-typed]` kicker, scanlines.

## 5. Platform transitions (Phases E–F)

- **Dashboard entry:** a one-time intro timeline on load (not scroll): camera pulls back from the giant `RANK_0N` onto the operator file and campaign map (reduced motion: final state).
- **Course map:** a scrubbed scene — the camera travels down the rank path, the path draws, each `RankNode` activates as it passes; `MissionMarker` on the current rank.
- **/learn/core:** rank banners use `RankNode`; mission-log lessons (art-system plan Task 7) — readable, minimal motion.
- **Challenge entry** (`/challenge/[rank]`): "MISSION DEPLOYED" intro — giant challenge id, countdown emphasis, objective markers; the timer and objectives stay fully usable.
- **Rank-up:** after passing a challenge, a short `ACCESS_GRANTED_` / `RANK_0N` sequence with the blade (WebGL where allowed).
- Lessons and labs: no cinematic motion beyond `Reveal` on art; the terminal is never animated.

## 6. Performance budget (replaces art-system §7)

- Lessons and labs: **+0 KB** first-load JS (unchanged rule).
- Landing / dashboard / course map / challenge: first-load JS **≤ +110 KB** compressed over the Task 1 baseline (GSAP + ScrollTrigger + Lenis + scene engine + Motion primitives).
- `three` + `BladeObject`: a separate lazy chunk **≤ 160 KB** compressed, requested only on capable desktops after interactive; never on phones or with reduced motion; must not delay LCP (the LCP element stays the wordmark text).
- No continuous animation off-screen (WebGL paused, Motion loops stopped by IntersectionObserver); transform/opacity/clip-path only; no layout reads inside scroll handlers.

## 7. Mobile (< 768 px)

Same six scenes, same copy and art, recomposed vertically: no pinning, no smooth scroll, no WebGL (BladeMark), scenes use `mobile="play"` (a short entrance when the scene arrives) or `static`; diagrams use their vertical layouts; kinetic type reduced to a single short reveal per heading. 375 px: no horizontal overflow, tap targets ≥ 44 px.

## 8. Accessibility

As the art-system spec, plus: reduced motion disables camera moves, pinning, Lenis, kinetic type, morphs and 3D, and shows final states immediately; split headings keep their accessible name (characters are spans inside one heading, no spaces lost); the BOOT scene's text is in the DOM from the start (no "loading" gate); WebGL canvas is `aria-hidden` with the blade described once in text nearby only if it carries meaning (it doesn't — decorative).

## 9. Testing

Existing suites stay green with updated brand expectations. New/changed:
- Unit: scene-language parser (valid/invalid JSON, fraction clamping), morph interpolation, `BRAND` values, flag prefix `CYBERBLADE{`.
- Component: split heading accessible name = the word; `ScrollScene` builds exactly one timeline per scene and none with reduced motion; `BladeObject` loader is never called on phones / reduced motion / without WebGL2.
- E2E: landing has six scene sections in order with one `h1` "CYBERBLADE"; no visible "NEON" text on landing/start/dashboard/learn-core; no-JS and reduced-motion show all scene copy; leaving mid-scene leaves no pin spacer; phone: no overflow, no `three` chunk requested; desktop: the `three` chunk loads only after interaction-ready and the canvas pauses when scrolled away.
- Manual: desktop and 375 px browser walkthrough of every scene, reduced motion, high contrast, keyboard (owner's definition of done).
