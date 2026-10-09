import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT } from "./tests/e2e/helpers/base";

// Tests run their own production server on a separate port (default 3100), so a `npm run dev` on
// :3000 — with your real .data — is never reused by accident.
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Browsers and the server share one machine; past 4 workers the WebGL/pinned-scene tests starve the
  // server and unrelated journeys time out waiting for it.
  workers: 4,
  use: { baseURL: E2E_BASE_URL },
  webServer: {
    command: `npm run build && npm run start -- -p ${E2E_PORT}`,
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEON_DATA_DIR: ".data-e2e", NEON_SHOW_DRAFTS: "true" },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
