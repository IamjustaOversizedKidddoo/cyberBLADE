# Phase 0 — Foundation Implementation Plan (local-first)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The themed website runs locally (`npm run dev`): a visitor picks an operator handle, accepts the ethical-use agreement, and lands on a dashboard showing the course map.

**Architecture:** One Next.js App Router app at the repo root (no `src/`). **Local-first (owner decision 2026-10-06):** no Supabase, no login, no deployment yet. A local "operator" identity is a random id in an httpOnly cookie; operator records live in a JSON file under `.data/` written by a small atomic JSON store. All storage sits behind interfaces (`OperatorStore`, later `ProgressRepo`) so Supabase Auth + Postgres can replace them in the hosted phase without touching pages. Routing decisions are pure functions in `lib/identity/` so they are unit-tested. Theme = Tailwind v4 `@theme` tokens in `app/globals.css` + presentational components in `components/theme/`.

**Tech Stack:** Next.js (latest stable, App Router) · TypeScript strict · Tailwind CSS v4 · zod · Vitest + React Testing Library (jsdom) · Playwright · GitHub Actions · npm · Node 24.

**Spec:** `docs/specs/2026-10-06-platform-design.md` (§9 theme, §11 architecture, §13 legal, §14 Phase 0). Also `CLAUDE.md`.

## Global Constraints

- Phase 0 done when: running locally, a new visitor can create an operator, accept the agreement and see the themed dashboard. (Spec §14's "sign up" is deferred to the hosted phase.)
- Ethical-use agreement accepted before any learning screen (spec §4.3, §13).
- Theme (spec §9, CLAUDE.md): look of https://watchdogsfont.com — black `#000000` pages, white `#FFFFFF` text, near-white `#F5FAFC` hero bands with huge black Hacked headings, accents cyan `#0FBEFF`, purple `#C83CFF`, hot pink `#FF1065`; blinking `_` cursor; typewriter text; snake_case headings; terminal panels; subtle scanlines.
- Fonts: Hacked (display headings + wordmark only), Pixel Operator (subheadings, buttons, labels, nav), IBM Plex Sans (lesson prose, form labels/help/errors), JetBrains Mono (terminals, code). Hacked and Pixel Operator self-hosted from `public/fonts/` via `next/font/local`; credit "Hacked font by David Libeau — hackedfont.com" in the footer and on `/credits`.
- No Ubisoft logos, DedSec symbol, game artwork/screenshots, character names, or the "Watch Dogs" name anywhere.
- Effects never block reading; honour `prefers-reduced-motion`; reduced-motion and high-contrast toggles (spec §9). Usable at 375px width with no horizontal scroll.
- Local data lives in `NEON_DATA_DIR` (default `.data/`), git-ignored. Minimal data (DPDP spirit): handle, agreement timestamp, rank. No email, no real names.
- Brand placeholder in one constant `lib/brand.ts` → `export const BRAND = { name: "NEON", tagline: "Learn cybersecurity like a hacker game. Finish with skills you can prove." }`.
- Repo layout per spec §11.1. Tests in `tests/unit/**` (Vitest) and `tests/e2e/**` (Playwright).
- Commit messages end with the attribution line from the session's system reminder.

## Owner setup (before Task 2)

1. Fonts: Hacked from https://watchdogsfont.com (or https://hackedfont.com) and Pixel Operator (Jayvee Enaguas — check the licence in the download). Save as `public/fonts/Hacked.ttf`, `public/fonts/PixelOperator.ttf`, `public/fonts/PixelOperator-Bold.ttf`; licence texts in `public/fonts/LICENSES.md`. (Claude may download them only with the owner's explicit go-ahead at execution time.)

## Review Focus

1. `/start?next=https://evil.example` or `next=//evil.example` → after onboarding lands on `/dashboard`, never off-site. Test in Task 3.
2. Stale cookie (the `.data` folder was deleted, or a cookie from an old run) → visitor is sent to `/start`, no crash. Test in Task 3.
3. Corrupt or half-written `.data/operators.json` → app still starts; corrupt file kept as `operators.json.corrupt-<timestamp>`. Test in Task 3.
4. Double-clicking "Start" or two tabs writing at once → no lost write, file stays valid JSON. Test in Task 3.
5. Handle input like `"  Ghost_01 "` → saved as `ghost_01`; `<script>`, 2 chars, 21 chars rejected with a readable message. Test in Task 4.
6. Reduced motion → typing/glitch text shows full text instantly, cursor static, no scanlines; readable text (labels, errors, prose) never in Hacked/Pixel fonts. Tests in Task 2. Dashboard at Pixel 7 width has no horizontal scroll. Test in Task 5.

---

### Task 1: Repo scaffold, tooling, CI

**Files:**
- Create: Next.js scaffold, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.env.example`, `.github/workflows/ci.yml`, `lib/brand.ts`, `tests/unit/lib/brand.test.ts`, `tests/e2e/smoke.spec.ts`, `.nvmrc` (`24`)
- Modify: `.gitignore` (add `.env*.local`, `/.data*/`, `/test-results`, `/playwright-report`, `.remember/`), `package.json` scripts + `"engines": { "node": ">=24" }`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`); path alias `@/*` → repo root.

- [ ] **Step 1:** `git init -b main` in `D:\CYBER-PLATFORM`. Scaffold into a temp dir with `npx create-next-app@latest neon-tmp --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm` and move its contents to the repo root (root already holds `CLAUDE.md`, `docs/`). Do not overwrite `CLAUDE.md`.
- [ ] **Step 2:** Dev deps: `vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`; `npx playwright install chromium`. Runtime deps: `zod server-only`.
- [ ] **Step 3:** `vitest.config.ts`: plugins react + tsconfigPaths, `test.include: ["tests/unit/**/*.test.{ts,tsx}"]`, env `node`, `setupFiles: ["vitest.setup.ts"]` (imports `@testing-library/jest-dom/vitest`). Component tests start with `// @vitest-environment jsdom`.
- [ ] **Step 4: Failing test** `tests/unit/lib/brand.test.ts`:
```ts
import { BRAND } from "@/lib/brand";
test("brand name is a single constant", () => {
  expect(BRAND.name).toBe("NEON");
  expect(BRAND.tagline).toMatch(/hacker game/);
});
```
Run `npm test` → FAIL. Create `lib/brand.ts`. Run → PASS.
- [ ] **Step 5:** `playwright.config.ts`: `testDir: "tests/e2e"`, `webServer: { command: "npm run build && npm run start", port: 3000, reuseExistingServer: !process.env.CI, env: { NEON_DATA_DIR: ".data-e2e" } }`, `globalSetup` deletes `.data-e2e/`; projects `chromium-desktop` and `chromium-mobile` (`devices["Pixel 7"]`). `smoke.spec.ts`: `/` responds 200 and contains `BRAND.name`.
- [ ] **Step 6:** `.env.example`: `NEON_DATA_DIR=.data` and `NEON_SHOW_DRAFTS=true` (used in Phase 1).
- [ ] **Step 7:** `.github/workflows/ci.yml` on push/PR: Node 24, `npm ci`, `lint`, `typecheck`, `test`, `build`, then `npx playwright install --with-deps chromium` and `test:e2e` (no secrets needed while local-first). Harmless until a GitHub remote exists.
- [ ] **Step 8:** Verify `npm run lint && npm run typecheck && npm test && npm run build` exit 0.
- [ ] **Step 9:** Commit `chore: scaffold Next.js app with Vitest, Playwright and CI`.

---

### Task 2: Theme (watchdogsfont.com look) tokens, fonts and base components

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`
- Create: `lib/theme/fonts.ts`, `lib/theme/display-prefs.ts`, `components/theme/TerminalPanel.tsx`, `components/theme/TypingText.tsx`, `components/theme/GlitchText.tsx`, `components/theme/BlinkCursor.tsx`, `components/theme/HeroBand.tsx`, `components/theme/Scanlines.tsx`, `components/theme/DisplaySettings.tsx`, `components/theme/SiteFooter.tsx`, `app/credits/page.tsx`
- Uses: `public/fonts/*` (owner setup)
- Test: `tests/unit/lib/theme/display-prefs.test.ts`, `tests/unit/components/theme/TypingText.test.tsx`, `tests/unit/components/theme/DisplaySettings.test.tsx`, `tests/unit/components/theme/SiteFooter.test.tsx`

**Interfaces:**
- Produces:
  - `type DisplayPrefs = { motion: "full" | "reduce"; contrast: "normal" | "high" }`
  - `readPrefs(storage: Pick<Storage,"getItem">, osReducedMotion: boolean): DisplayPrefs` — key `neon.display`; stored value wins, else `motion` follows OS.
  - `applyPrefs(root: HTMLElement, p: DisplayPrefs): void` — sets `data-motion`, `data-contrast` on `<html>`.
  - `lib/theme/fonts.ts`: `hacked`, `pixel` (`next/font/local`, regular + bold), `plexSans`, `jetbrainsMono` (`next/font/google`); CSS variables `--font-hacked`, `--font-pixel`, `--font-plex`, `--font-jbmono`.
  - `<TerminalPanel title?: string; children>` — black panel, 1px white/20% border, Pixel Operator title bar with a `_` cursor.
  - `<TypingText text: string; speedMs?: number = 18>` — typewriter in Pixel Operator + `<BlinkCursor/>`; full `text` immediately when `<html data-motion="reduce">`; `aria-label` always the full text.
  - `<BlinkCursor />` — `_` blinking in 1s steps; static under reduce.
  - `<HeroBand title: string; kicker?: string>` — full-width `#F5FAFC` band, `title` in Hacked, black, `clamp(2.5rem, 9vw, 7rem)`, wraps on mobile; `kicker` above it as `TypingText` (dark text on the light band).
  - `<GlitchText as?: "h1"|"h2"|"span"; children: string>` — Hacked heading with CSS-only RGB-split glitch (cyan/hot-pink offset copies via `::before/::after`, `aria-hidden`) on first paint and hover; none under reduce or high contrast.
  - `<Scanlines />` — fixed, `pointer-events-none`, opacity ≤ 0.06, hidden under reduce or high contrast.
  - `<DisplaySettings />` — toggle buttons (`aria-pressed`) "Reduce motion", "High contrast"; persists to `localStorage` `neon.display`.
  - `<SiteFooter />` — exact text `Hacked font by David Libeau` linking to `https://hackedfont.com`, plus a link to `/credits`.

- [ ] **Step 1: Failing tests.**
`display-prefs.test.ts`:
```ts
const store = (v: string | null) => ({ getItem: () => v });
test("OS reduced motion applies when nothing stored", () =>
  expect(readPrefs(store(null), true)).toEqual({ motion: "reduce", contrast: "normal" }));
test("stored choice beats OS", () =>
  expect(readPrefs(store('{"motion":"full","contrast":"high"}'), true)).toEqual({ motion: "full", contrast: "high" }));
test("corrupt storage falls back to defaults", () =>
  expect(readPrefs(store("{oops"), false)).toEqual({ motion: "full", contrast: "normal" }));
```
`TypingText.test.tsx`: with `document.documentElement.dataset.motion = "reduce"`, `render(<TypingText text="ACCESS GRANTED" />)` → text present synchronously; without reduce, after `vi.advanceTimersByTime(18*14)` full text present; `aria-label` equals full text from first render.
`DisplaySettings.test.tsx`: clicking "High contrast" → `document.documentElement.dataset.contrast === "high"`, `aria-pressed="true"`, `localStorage.getItem("neon.display")` contains `"high"`.
`SiteFooter.test.tsx`: `getByRole("link", { name: /Hacked font by David Libeau/ })` has `href="https://hackedfont.com"`.
Run `npm test` → FAIL.
- [ ] **Step 2: Tokens** in `app/globals.css` under `@theme`:
`--color-void:#000000; --color-ink:#ffffff; --color-paper:#f5fafc; --color-muted:#ccd6dd; --color-line:rgb(255 255 255 / 0.2); --color-cyan:#0fbeff; --color-purple:#c83cff; --color-pink:#ff1065;`
Roles: cyan = primary actions, links, success; purple = XP/rank/secondary; pink = errors, warnings, attacker-side content. Fonts: `--font-display: var(--font-hacked)`, `--font-ui: var(--font-pixel)`, `--font-sans: var(--font-plex)`, `--font-mono: var(--font-jbmono)`. Defaults: `h1, h2` → display; `h3, h4, nav, button, .chip, .badge` → ui; body, `p`, `li`, form labels/help/errors → sans; `code, pre, .xterm` → mono. Body `bg-void text-ink font-sans`, 17px, line-height 1.65. `[data-contrast="high"]`: `--color-muted:#ffffff`, no glitch, no scanlines. `@media (prefers-reduced-motion: reduce)` and `[data-motion="reduce"]` both set `animation: none; transition: none` on `*`.
- [ ] **Step 3:** Implement fonts, prefs and components. `SiteFooter` in `app/layout.tsx`; `/credits` lists Hacked (David Libeau, CC-BY, link) and Pixel Operator (author + licence from `LICENSES.md`). Inline `<script>` in `<head>` applies prefs before paint; `suppressHydrationWarning` on `<html>`. Wordmark = `BRAND.name` + `_` in Hacked, as text. No Ubisoft logos, DedSec symbol, masks or game artwork.
- [ ] **Step 4:** `npm test` → PASS. Manually view `/` at 375px (hero wraps, no horizontal scroll) and with reduced motion.
- [ ] **Step 5:** Commit `feat(theme): hacked/pixel fonts, black-white-cyan theme, hero band, glitch + typewriter, display settings`.

---

### Task 3: Local JSON store, operator identity, route gating

**Files:**
- Create: `lib/storage/json-store.ts`, `lib/identity/types.ts`, `lib/identity/operator-store.ts`, `lib/identity/file-operator-store.ts`, `lib/identity/routes.ts`, `lib/identity/session.ts`, `proxy.ts` (Next ≥16; `middleware.ts` on 15)
- Test: `tests/unit/lib/storage/json-store.test.ts`, `tests/unit/lib/identity/file-operator-store.test.ts`, `tests/unit/lib/identity/routes.test.ts`

**Interfaces:**
- Produces:
  - `createJsonStore<T>(filePath: string, defaults: () => T): { read(): Promise<T>; update(fn: (draft: T) => void): Promise<T> }` — `update` calls are serialized (promise-chain mutex per file path); writes go to `<file>.tmp` then `rename`; missing file → `defaults()`; unparseable file → renamed to `<file>.corrupt-<Date.now()>` and `defaults()` used. Creates the directory if missing. Phase 1 reuses this for progress.
  - `dataPath(name: string): string` — `path.join(process.env.NEON_DATA_DIR ?? ".data", name)`.
  - `type Operator = { id: string; handle: string; rank: number; ethicsAcceptedAt: string | null; createdAt: string }`
  - `interface OperatorStore { get(id: string): Promise<Operator | null>; create(input: { handle: string; ethicsAcceptedAt: string }): Promise<Operator>; setRank(id: string, rank: number): Promise<void> }` — `create` assigns `id = crypto.randomUUID()`, `rank = 0`.
  - `class FileOperatorStore implements OperatorStore` — `constructor(filePath = dataPath("operators.json"))`, file shape `{ operators: Record<string, Operator> }`.
  - `getOperatorStore(): OperatorStore` — single swap point for the hosted phase.
  - `safeNextPath(next: string | null | undefined): string` — `next` only if it starts with `/`, not `//` or `/\`, no scheme; else `"/dashboard"`.
  - `PUBLIC_PATHS` and `resolveRoute(input: { pathname: string; hasOperatorCookie: boolean }): { redirect: string } | null` — public: `/`, `/start`, `/credits`, `/legal/*`, `/verify/*`; no cookie + non-public → `/start?next=<encoded pathname>`; cookie + `/start` → `/dashboard`.
  - `session.ts` (`import "server-only"`): cookie `neon_uid` (httpOnly, `sameSite: "lax"`, path `/`, maxAge 1 year); `getCurrentOperator(): Promise<Operator | null>`; `requireOperator(): Promise<Operator>` — redirects to `/start` (and clears the cookie) when the cookie's id isn't in the store; `setOperatorCookie(id)`, `clearOperatorCookie()`.
  - `proxy.ts`: checks cookie presence only, calls `resolveRoute`; pages call `requireOperator()` for the real lookup.

- [ ] **Step 1: Failing tests:**
```ts
// json-store.test.ts — each test uses a fresh temp dir (fs.mkdtemp in os.tmpdir())
test("missing file returns defaults", async () => expect(await store.read()).toEqual({ n: 0 }));
test("concurrent updates are not lost", async () => {
  await Promise.all(Array.from({ length: 20 }, () => store.update(d => { d.n++; })));
  expect(await store.read()).toEqual({ n: 20 });
  expect(() => JSON.parse(fs.readFileSync(file, "utf8"))).not.toThrow();
});
test("corrupt file is backed up and defaults used", async () => {
  fs.writeFileSync(file, "{half");
  expect(await store.read()).toEqual({ n: 0 });
  expect(fs.readdirSync(dir).some(f => f.startsWith("db.json.corrupt-"))).toBe(true);
});
// file-operator-store.test.ts
test("create then get round-trips with rank 0", ...);
test("get unknown id returns null", ...);
// routes.test.ts
test.each([["https://evil.example", "/dashboard"], ["//evil.example", "/dashboard"], ["/\\evil", "/dashboard"],
  [null, "/dashboard"], ["/learn/core", "/learn/core"]])("safeNextPath(%s)", (i, o) => expect(safeNextPath(i)).toBe(o));
test("no cookie → start with next", () =>
  expect(resolveRoute({ pathname: "/dashboard", hasOperatorCookie: false })).toEqual({ redirect: "/start?next=%2Fdashboard" }));
test("operator skips start", () =>
  expect(resolveRoute({ pathname: "/start", hasOperatorCookie: true })).toEqual({ redirect: "/dashboard" }));
test("public pages pass", () => expect(resolveRoute({ pathname: "/credits", hasOperatorCookie: false })).toBeNull());
```
Run → FAIL.
- [ ] **Step 2:** Implement in the order store → operator store → routes → session → proxy. Run → PASS.
- [ ] **Step 3:** Commit `feat(identity): local JSON store, operator identity, route gating`.

---

### Task 4: Onboarding — handle + ethical-use agreement

**Files:**
- Create: `app/start/page.tsx`, `app/start/actions.ts`, `app/session/end/route.ts`, `lib/identity/validation.ts`, `content/legal/ethical-use.md`, `app/legal/ethical-use/page.tsx`
- Test: `tests/unit/lib/identity/validation.test.ts`

**Interfaces:**
- Consumes: `getOperatorStore`, `setOperatorCookie`, `clearOperatorCookie`, `safeNextPath` (Task 3); `HeroBand`, `TerminalPanel`, `TypingText` (Task 2).
- Produces:
  - `handleSchema` (zod): trims, lowercases, then `/^[a-z0-9_]{3,20}$/`; error copy "Use 3–20 letters, numbers or _".
  - `startOperator(formData)` server action — validates `handle` and `agree === "on"` (else error "You must accept the agreement to continue"); `create({ handle, ethicsAcceptedAt: new Date().toISOString() })`; sets cookie; `redirect(safeNextPath(formData.get("next")))`.
  - `POST /session/end` → clears cookie, redirect `/` (data stays on disk; labelled "Switch operator").

- [ ] **Step 1: Failing tests:** `handleSchema.parse("  Ghost_01 ") === "ghost_01"`; `"<script>"`, `"ab"`, `"a".repeat(21)` fail with the copy above.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** `content/legal/ethical-use.md` (original, plain language): practise only on platform labs or systems you own or have written permission to test; unauthorised access is an offence under India's IT Act 2000 (e.g. ss. 43, 66); never use platform techniques against real third parties; breach = losing access. `/start`: `HeroBand` title `initiate_` with kicker `> new operator detected`, then a `TerminalPanel` form: handle field (visible label, sans font), the agreement text (scrollable, sans), required checkbox "I have read and agree", button "Start" (Pixel Operator); errors in `role="alert"`; hidden `next` field.
- [ ] **Step 4:** Manual: fresh browser → `/dashboard` redirects to `/start` → submit → dashboard.
- [ ] **Step 5:** Commit `feat(onboarding): operator handle and ethical-use agreement`.

---

### Task 5: App shell, dashboard and course map

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `components/shell/AppShell.tsx`, `components/shell/RankBadge.tsx`, `components/dashboard/CourseMap.tsx`, `lib/catalog/tracks.ts`, `lib/progress/ranks.ts`
- Modify: `app/page.tsx` (landing)
- Test: `tests/unit/lib/catalog/tracks.test.ts`, `tests/unit/lib/progress/ranks.test.ts`, `tests/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `requireOperator` (Task 3).
- Produces:
  - `RANKS: readonly { rank: 0|1|2; name: "Initiate"|"Operator"|"Watcher" }[]`; `rankName(rank: number): string` (unknown → `"Initiate"`).
  - `type TrackStatus = "open" | "coming_soon"`; `CORE = { id: "core", title: "Shared Core", ranks: RANKS }`; `TRACKS: { id: string; title: string; group: "Defend"|"Attack"|"Build"|"Emerging"|"Governance"|"Leadership"; status: TrackStatus }[]` — `soc`, `pentest`, `cloud` `"open"`; all other spec §3.1 tracks `"coming_soon"`.
  - `<AppShell operator>` (layout calls `requireOperator()`): top bar (wordmark, `RankBadge`, `DisplaySettings`, "Switch operator" form → `/session/end`), `<Scanlines/>`.

- [ ] **Step 1: Failing tests:** open track ids equal `["soc","pentest","cloud"]`; 22 tracks total; ids unique; `rankName(1) === "Operator"`, `rankName(9) === "Initiate"`. Run → FAIL; implement; → PASS.
- [ ] **Step 2:** Landing `/`: `HeroBand` kicker `> BE READY TO LEARN_`, title `BRAND.name`, tagline; black sections with snake_case Hacked headings (`how_it_works`, `tracks`, `get_started`); "Start" → `/start`. Dashboard: `HeroBand` title `rank_0` (from operator rank) with kicker `> welcome, <handle>`, purple rank card, `CourseMap`: core ranks 0–2 as a vertical path (Rank 0 "Start here"), the three launch tracks "Unlocks after the core", grouped "Coming soon" tiles (plain padlock glyph).
- [ ] **Step 3: E2E** `onboarding.spec.ts` (both projects): `/dashboard` → redirected to `/start` → fill handle `e2e_${Date.now() % 1e6}`, tick agreement, Start → `/dashboard` shows "Rank 0" and "Initiate"; fresh context visiting `/start?next=https://evil.example` → after submit URL ends with `/dashboard`. Mobile project: `document.documentElement.scrollWidth <= 412`.
- [ ] **Step 4:** `npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat(app): app shell, themed dashboard, course map`.

---

### Task 6: Close Phase 0

**Files:**
- Create: `README.md` (Node 24, `copy .env.example .env.local`, `npm install`, `npm run dev` → http://localhost:3000, where local data lives and how to reset it by deleting `.data/`, test commands, font credits)

- [ ] **Step 1:** Verify `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` all pass; `npm run dev` and click through landing → start → dashboard on desktop and at 375px.
- [ ] **Step 2:** Commit `docs: README for local development`.

---

## Later: hosted phase (not in this plan)

Before closed beta (spec Phase 2): Supabase Auth (email + Google) replaces the cookie identity; `SupabaseOperatorStore` / `SupabaseProgressRepo` implement the same interfaces with read-only RLS for users; deploy to Vercel. Planned separately when the owner is ready.
