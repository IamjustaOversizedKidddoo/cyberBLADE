import { defineConfig } from "@playwright/test";

/**
 * Screenshots for visual review (not a test gate): `npm run build` first, then
 * `SHOT_DIR=docs/visual/after npx playwright test --config scripts/visual/playwright.visual.config.ts`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "shoot.spec.ts",
  use: { baseURL: "http://localhost:3200" },
  webServer: {
    command: "npm run start -- -p 3200",
    port: 3200,
    reuseExistingServer: false,
    env: { NEON_DATA_DIR: ".data-visual", NEON_SHOW_DRAFTS: "true" },
  },
});
