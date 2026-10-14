import { defineConfig } from "@playwright/test";

/**
 * Design evidence for SOC L1 lessons (not a test gate). `npm run build` first, then
 * `NEON_DATA_DIR=.data-visual SHOT_DIR=<dir outside the repo> npx playwright test --config scripts/visual/playwright.soc-lessons.config.ts`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: process.env.SHOT_MATCH ?? "soc-lessons.shoot.ts",
  timeout: 120_000,
  use: { baseURL: "http://localhost:3200" },
  webServer: {
    command: "npm run start -- -p 3200",
    port: 3200,
    reuseExistingServer: false,
    env: { SOC_QUERY_ENABLED: "true", NEON_DATA_DIR: ".data-visual", NEON_SHOW_DRAFTS: "true", CYBERBLADE_ALLOW_LOCAL_E2E: "true" },
  },
});
