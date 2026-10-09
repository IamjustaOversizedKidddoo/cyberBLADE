# NEON Visual Art System — Part 1 Design (art system + landing, dashboard, course map)

**Status:** Draft for owner review · 2026-10-08 · branch `visual-art-system`
**Parent spec:** `docs/specs/2026-10-06-platform-design.md` (theme rules in `CLAUDE.md` still apply)
**Owner brief:** "Premium Awwwards-level art direction & visual experience upgrade" (2026-10-08) + two reference screenshots (watchdogsfont.com) used as *art-direction references only*.

## 1. Intent

NEON should feel like "a cyberpunk editorial art experience that happens to be an advanced cybersecurity learning platform", not "a cybersecurity LMS with a dark theme". The user should feel they are entering a cyber training system: **ENTER → DISCOVER → UNDERSTAND → CHOOSE → TRAIN → OPERATE → CHALLENGE → RANK UP**.

**Owner decisions (2026-10-08):**
- Artwork is **code-native** (original SVG/CSS) now; figurative ink illustrations get designed **art slots** to be filled later by an illustrator or generator.
- Work is split into three parts, each with its own spec → plan → approval. **Part 1 (this spec):** the art system + landing + dashboard + course map (`/learn/core`). **Part 2:** lesson pages, labs, rank challenge. **Part 3:** track identities (when track pages exist).
- Motion uses **both GSAP (+ScrollTrigger) and Motion**, with strict separation (§3).

**Success criteria:**
1. Every major viewport on the three pages has a deliberate focal point built from the art system; no generic card grids remain on them.
2. All art is original; nothing from Ubisoft/Watch Dogs (logos, DedSec mark, characters, screenshots, names) appears anywhere.
3. Content is complete and in reading order with JavaScript off and with reduced motion; keyboard and screen-reader use are unchanged or better.
4. 375 px layouts are their own compositions with no horizontal page scroll.
5. Lesson and lab routes ship **zero** added JavaScript; art routes stay within the budget in §7.
6. The full existing test suite (unit, content gate, build, e2e) passes, plus the new tests in §9.

## 2. Constraints carried over

- Palette stays the existing tokens: `void #000`, `ink #fff`, `paper #f5fafc`, `muted`, `line`, `cyan #0FBEFF`, `purple #C83CFF`, `pink #FF1065`. Art uses these (via `currentColor`/CSS variables) so high-contrast mode re-colours it; no new colours.
- Fonts unchanged: Hacked (display, never body text), Pixel Operator (UI/labels), IBM Plex Sans (reading), JetBrains Mono (terminal/code). Hacked credit stays in footer and `/credits`.
- High contrast doubles as dark-room mode: paper bands become dark (existing `[data-contrast="high"]` rule) — every new band must honour it.
- Existing accessible names and selectors used by tests are preserved unless a test is deliberately updated in the same commit: "Start" button/links, `#rank-N` anchors, headings `rank_N · Name`, `Begin rank_N` / `Continue` links, the `role="status"` locked notice, `.neon-hero`, `.neon-scanlines`, `[data-typed]`.

## 3. Architecture — three layers, one owner each

| Layer | Owner | Responsibility |
|---|---|---|
| Art | Server components (SVG/CSS), **no JS** | textures, diagrams, posters, dossiers, annotations, art slots |
| Scroll storytelling | **GSAP + ScrollTrigger** via `@gsap/react` `useGSAP` | pinned sections, scroll-scrubbed timelines, sequenced composition reveals, parallax |
| Component motion | **Motion** (`motion/react`, `LazyMotion` + `domAnimation`) | single-element entrances, hover/press, layout changes, `AnimatePresence` enter/exit |

Rules:
- **One element, one library.** GSAP never animates an element Motion controls and vice versa; a GSAP scene may wrap Motion children but never targets them.
- GSAP is created only inside `components/art/motion/ScrollScene.tsx` and `Parallax.tsx` (client, `"use client"`), code-split with `next/dynamic` so routes without a scene don't load it. ScrollTrigger is registered once there; `useGSAP` handles cleanup on App Router navigation.
- Pages never import `gsap` or `motion` directly — only the primitives in §4.
- **Reduced motion — one switch for both:** the effective setting is `prefers-reduced-motion: reduce` OR NEON's "Reduce motion" toggle (`data-motion="reduce"` on `<html>`, already set by `DisplaySettings`). A `useReducedMotion()` hook in `components/art/motion/reduced.ts` reads both. GSAP scenes use `gsap.matchMedia()` and, when reduced, render the final state with no pinning; Motion uses `<MotionConfig reducedMotion="always">` when reduced. CSS animations already respect the same attribute.
- **Progressive enhancement:** server HTML is the final, readable composition. Motion only animates *from* an offset to that final state, starting after hydration; nothing is permanently hidden by JS.
- **Compatibility gate:** before installing, confirm the current `gsap`, `@gsap/react` and `motion` releases support React 19 + Next 16 (peer deps + a smoke build). If not, stop and report to the owner rather than working around it.

## 4. Art primitives (`components/art/`)

The complete set; pages compose only these (plus existing `TypingText`, `BlinkCursor`, `TerminalPanel`, `DisplaySettings`).

**Textures** — decorative, `aria-hidden`, server components
- `HalftoneField({ tone, density, angle, fade })` — dot-matrix/halftone gradient from an SVG `<pattern>`; `tone` is a token name.
- `NoiseLayer({ kind: "grain" | "photocopy" | "crt" })` — one small pre-rendered tile (data-URI PNG ≤ 4 KB) as a repeating background; `crt` adds the existing scanlines. Replaces `Scanlines` (which becomes a thin wrapper keeping `.neon-scanlines`).
- `InkEdge({ edge: "top" | "bottom", variant: 1–3, tone })` — torn/rough ink border as an SVG path, seeded variants.

**Type as art**
- `PosterHeading({ as, lines, bleed, vertical, glitch=false, size })` — evolution of `GlitchText`: huge Hacked type that can bleed off an edge, stack, run vertically, sit over art. One semantic heading; decorative copies stay `aria-hidden`.
- `SystemLabel({ children, tone })` — Pixel Operator micro-type for metadata (`SEC-04 // LOCKED`, `x:0412 y:0088`).
- `Annotation({ from, to, label, hand })` — leader line/arrow in a hand-drawn stroke plus a label; positions in % of the parent art box. Text is real text (readable), the line is decorative.

**Compositions**
- `PosterSection({ tone: "paper" | "void" | "cyan", zones, mobile })` — full-bleed band with named zones (`type`, `art`, `caption`, `labels`) placed on a CSS grid that may overlap; `mobile` supplies the 375 px arrangement. Replaces `HeroBand` (kept as a wrapper so `.neon-hero` remains).
- `DossierCard({ fileNo, stamp, title, children, redact })` — document panel: file number, rubber stamp, paper texture, optional redaction bars (redacted text is replaced, never hidden-but-present).
- `VisualDivider({ kind: "schematic" | "ascii" | "ink" })` — editorial break between sections.

**Art objects**
- `TechnicalDiagram({ nodes, links, labels, style: "schematic" | "hand", active })` — small data-driven SVG renderer. Layout is computed by pure functions in `lib/art/diagram.ts` (testable) from node coordinates in a 0–100 viewBox; renders nodes, links (straight/orthogonal/curved), labels and an `active` highlight. Used for the learning loop, track glyphs and the course-map path.
- `EditorialIllustration({ slot, alt, caption, crop, src? })` — the art slot. With `src`, renders a responsive `next/image` with per-breakpoint crop. Without, renders a composed placeholder for that `slot` (halftone silhouette built from simple shapes + annotations) that reads as intentional. Requires `alt` unless `decorative`.
- `RankNode({ rank, name, status: "cleared" | "current" | "locked", xp, lessons, mission })` — giant rank number (`00`, `01`…), status stamp, XP and lessons, mission label.

**Motion primitives** (client islands)
- GSAP: `ScrollScene({ pin, scrub, steps, children })`, `Parallax({ speed, children })`.
- Motion: `Reveal({ mode: "clip" | "mask" | "rise", delay })`, `Counter({ to })` (renders the final number in HTML; counts up only when motion is allowed), `Magnetic({ children })` (pointer-fine devices only).

**Not built (covered above):** `ImageReveal` (= `Reveal`), `HalftoneBackground` (= `HalftoneField`), `SectionArt` (= a `PosterSection` zone), `ParallaxArtwork` (= `Parallax`), `ScanlineLayer` (= `NoiseLayer kind="crt"`), `GlitchHeading` (= `PosterHeading glitch`), `MissionMarker` (= `RankNode`).

## 5. Page compositions

### 5.1 Landing `/` — the sequence ENTER → DISCOVER → UNDERSTAND → CHOOSE → START

1. **ENTER** (paper `PosterSection`, ~100 svh). `PosterHeading` "NEON_" bleeding off the left edge at viewport scale; an `EditorialIllustration slot="operator"` (placeholder: halftone operator silhouette wearing a visor, annotated "OPERATOR // UNASSIGNED", "VISOR: SIM-ONLY") overlapping the type on the right; `SystemLabel`s in the corners (`SYS.BOOT 00:00:01`, `NODE: PUBLIC`, coordinates); typed kicker "> BE READY TO LEARN"; tagline; `Magnetic` **Start** button. Bottom `InkEdge` tears into black. *GSAP:* scrubbed — type drifts left/scales, illustration parallaxes up, labels count. *Mobile:* type stacks "NEO / N_", illustration becomes a cropped band behind the tagline, no scrub.
2. **DISCOVER** (void band). Statement in huge type, revealed line by line (`Reveal mode="mask"`): "YOU'RE NOT WATCHING A COURSE_" / "YOU'RE ENTERING A TRAINING SYSTEM_", over a cyan `HalftoneField` fading from one corner.
3. **UNDERSTAND — "breaking into the system"** (void, pinned `ScrollScene` on ≥ 768 px). A `TechnicalDiagram` schematic of the learning loop: Briefing → Terminal Check → Lab → Debrief → (back to Briefing), with packet-like dots on the links. Scrolling advances `active` node by node; an `Annotation` per node shows its one-line explanation (existing `LOOP` copy). *Reduced motion / mobile:* no pin — the diagram is shown complete with all four annotations, as a vertical list on mobile.
4. **CHOOSE — the dossier wall** (paper band). The four launch tracks as `DossierCard`s placed asymmetrically, slightly rotated and overlapping, each with a `TechnicalDiagram` glyph: Purple Team = split attack/defend paths, SOC = signal/telemetry trace, Pentest = attack path through hosts, Cloud = topology of regions. Stamp "OPEN"; file numbers. *Motion:* cards `Reveal` with a stagger. *Mobile:* stacked, unrotated, full width.
5. **START** (cyan `PosterSection`). "START AT RANK_00" poster type, line "No experience needed…", **Start** button; footer below.

### 5.2 Dashboard `/dashboard` — "operator file"

- **Briefing band** (paper `PosterSection`): giant `RANK_0N` `PosterHeading`; beside it a `DossierCard` "OPERATOR FILE" with handle, rank name, XP (`Counter`), lessons done in current rank, and the **next mission** link (the existing `Begin rank_N` / `Continue` link, same name and href); `SystemLabel`s (`STATUS: ACTIVE`, `CLEARANCE: RANK_0N`). Welcome kicker kept (`[data-typed]`).
- **Campaign map** (void): the course map (§5.3 component) — shared core ranks then job tracks as locked sectors.
- **Coming soon** becomes a single `DossierCard` "CLASSIFIED — FUTURE OPERATIONS": the role groups as rows with redaction-bar styling on the descriptions (role names remain readable text).

### 5.3 Course map — `CourseMap` component + `/learn/core`

- `CourseMap` becomes a **campaign path**: a `TechnicalDiagram` path (zig-zag on desktop, straight vertical on mobile) connecting `RankNode`s 00 → 01 → 02, then a branch to the four track nodes. Current node: cyan, pulsing marker (Motion, not with reduced motion). Cleared: purple stamp "CLEARED". Locked: hatched `HalftoneField` + "SECTOR LOCKED" stamp. *GSAP:* the path draws in as you scroll (stroke-dashoffset scrub); without motion it's fully drawn. The current node keeps the `Begin rank_N`/`Continue` link and `rank_N · Name` heading text.
- `/learn/core`: each rank section opens with a `RankNode` banner (keeps `id="rank-N"` and the `rank_N · Name` heading). Lessons become a **mission log**: numbered rows (`01`, `02`…) with status glyph, title link (unchanged hrefs), minutes and XP — readable list semantics (`ol > li > a`), no card borders. Locked ranks: titles listed without links (as now) under a "SECTOR LOCKED" stamp. The `?locked=N` notice becomes a `DossierCard`-styled alert keeping `role="status"` and its exact text.

## 6. Responsive strategy

- Breakpoints: mobile (< 640), tablet (640–1023), desktop (≥ 1024). `PosterSection` takes explicit `mobile` zone arrangements — compositions are re-designed, not shrunk.
- Pinning/scrubbing only at ≥ 768 px and pointer: fine; below that, scenes render as static, complete compositions. `Magnetic` only on `(hover: hover) and (pointer: fine)`.
- Bleeding type and overlapping art are clipped by their band (`overflow: clip` on the band, never on `body`), so no horizontal page scroll at 375 px.
- Art slots carry per-breakpoint crop focal points.

## 7. Performance budget

- Lesson and lab routes: **+0 KB** JS (no art motion islands imported there in part 1).
- Landing/dashboard/course map: **≤ +80 KB gzip** JS over today's route size, measured from `next build` output before and after; GSAP code-split to routes with a `ScrollScene`.
- No raster art in part 1 except texture tiles (≤ 4 KB each); all SVG is inline and simple (no live `feTurbulence` filters, no blur on large areas).
- LCP element is the hero heading text (fonts already self-hosted and preloaded); no layout shift from art (fixed aspect boxes); animations use `transform`/`opacity`/`clip-path` only.

## 8. Accessibility

- Decorative layers `aria-hidden="true"`; meaningful art (diagrams, slots) has a text equivalent (diagram nodes are real text; slots require `alt`).
- One `h1` per page; visual reordering never changes DOM reading order.
- All interactive items reachable by keyboard with the existing cyan focus ring; `Magnetic` never moves focus targets under keyboard use.
- Contrast: body text on paper/void stays ≥ 4.5:1; micro-labels that fall below are decorative or duplicated in readable text.
- Reduced motion (system or toggle) and high contrast are first-class states, each tested (§9).

## 9. Testing

- **Unit (Vitest):** `lib/art/diagram.ts` layout functions (node positions, link paths, active state, mobile vertical layout); `RankNode` status mapping from (operator rank, rank); `useReducedMotion` combining media query + `data-motion`.
- **Component (Vitest + jsdom):** textures are `aria-hidden`; `EditorialIllustration` without `alt` and without `decorative` throws in dev; `Counter` renders the final number in markup; `PosterHeading` renders exactly one semantic heading.
- **E2E (Playwright):** the existing suite unchanged and green; new: landing at 375 px has no horizontal scroll and shows all four tracks; with reduced motion every landing section's text is visible without scrolling interactions and nothing is pinned; keyboard Tab reaches Start (hero), every dossier and Start (footer CTA) in order; dashboard shows `RANK_0N`, the operator file and the next-mission link; high-contrast turns every paper band dark.
- **Manual review artefacts:** desktop + 375 px screenshots of each page in normal, reduced-motion and high-contrast states, shared with the owner; `next build` route-size table before/after.

## 10. Risks

- **Library compatibility** with React 19 / Next 16 — gated in §3.
- **Two motion libraries** can drift into overlap — enforced by the "pages import primitives only" rule and a lint `no-restricted-imports` rule for `gsap`/`motion` outside `components/art/motion/`.
- **Placeholder art feeling unfinished** — placeholders are designed compositions (halftone + annotation), and each slot has a brief so an illustrator can replace it 1:1 later.
- **Trade dress:** the look stays inspired by the references (owner accepts this risk per CLAUDE.md); no copied artwork or marks.

## 11. Out of scope (part 1)

Lesson, lab and challenge pages (part 2); per-track visual identities and track pages (part 3); real figurative illustrations; sound; page-to-page transition animations across routes (revisit in part 2 once more pages use the system).
