# Visual art system — baseline (before part 1)

Captured 2026-10-08 on branch `visual-art-system` at 4f14d50 (= main + docs), production build (`next start`).

**Method:** Next 16's build output no longer prints route sizes, so we measure what a visitor downloads:
the compressed bytes of every script response on a cold first load of the route
(`scripts/visual/shoot.spec.ts` → "first-load JS per route"; run with
`npm run build && SHOT_DIR=docs/visual/<dir> npx playwright test --config scripts/visual/playwright.visual.config.ts`).

| Route | First-load JS (KB, compressed) | Part 1 budget |
|---|---|---|
| `/` | 135.0 | ≤ 215.0 |
| `/dashboard` | 135.5 | ≤ 215.5 |
| `/learn/core` | 135.5 | ≤ 215.5 |
| `/learn/core-r0-comp-hardware-01` (lesson) | 136.3 | +0 (≤ 137) |
| `/labs/core-r0-terminal-lab-01` (lab) | 235.2 | +0 (≤ 236) |

Before screenshots (reduced motion, full page): `docs/visual/before/{landing,dashboard,learn-core}-{desktop,375}.png`.
