import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEON_DATA_DIR: ".data-e2e" },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
