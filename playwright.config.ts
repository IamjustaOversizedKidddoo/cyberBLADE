import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT } from "./tests/e2e/helpers/base";

// Tests run their own production server on a separate port (default 3100), so a `npm run dev` on
// :3000 — with your real .data — is never reused by accident.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Browsers and the server share one machine; past 2 workers the WebGL/pinned-scene tests starve the
  // server and unrelated journeys time out waiting for it.
  workers: 2,
  use: { baseURL: process.env.BASE_URL || E2E_BASE_URL },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${E2E_PORT}`,
        port: E2E_PORT,
        reuseExistingServer: !process.env.CI,
    env: {
      NEON_DATA_DIR: ".data-e2e",
      NEON_SHOW_DRAFTS: "true",
      CYBERBLADE_ALLOW_LOCAL_E2E: "true",
      SOC_WORKSPACE_ENABLED: "true",
      SOC_ENRICHMENT_ENABLED: "true",
      SOC_QUERY_ENABLED: "true",
      SOC_EXAMS_ENABLED: "true",
      SOC_HANDLER_ENABLED: "true",
      SOC_L2_ENABLED: "true",
      SOC_RULES_ENABLED: "true",
      SOC_REPORTS_ENABLED: "true",
      // AI writing feedback in preview with a deterministic local mock (never a real provider).
      SOC_AI_GRADING_MODE: "preview",
      SOC_AI_PROVIDER: "mock-e2e",
    },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
