import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { onboard } from "./helpers/rank0";

const EVIDENCE_DIR = path.resolve("docs/design/evidence/weekend");

test.describe("Weekend Design Evidence & Screenshot Capture", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  const routes = [
    { name: "pentest-track-overview", path: "/learn/pentest-l1" },
    { name: "pentest-module-detail", path: "/learn/pentest-l1/m01-methodology" },
    { name: "netrange-lab", path: "/labs/netrange-foothold-privesc-01" },
    { name: "pentest-exam-lobby", path: "/exam/pentest" },
    { name: "pentest-readiness-gate", path: "/exam/pentest/readiness" },
    { name: "certificates-registry", path: "/certificates" },
  ];

  for (const r of routes) {
    test(`capture ${r.name} at 1440px and 390px`, async ({ page }) => {
      await onboard(page);

      // 1. 1440px Desktop Viewport
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(r.path);
      await page.waitForLoadState("networkidle");

      // Verify no horizontal overflow
      const desktopOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(desktopOverflow, `desktop 1440px horizontal overflow on ${r.path}`).toBe(false);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${r.name}-1440.png`),
        fullPage: true,
      });

      // 2. 390px Mobile Viewport
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(r.path);
      await page.waitForLoadState("networkidle");

      // Verify no horizontal overflow at 390px
      const mobileOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(mobileOverflow, `mobile 390px horizontal overflow on ${r.path}`).toBe(false);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `${r.name}-390.png`),
        fullPage: true,
      });
    });
  }
});
