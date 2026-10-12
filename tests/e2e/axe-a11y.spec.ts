import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";

test.describe("Automated axe-core Accessibility Audit (WCAG 2.2 AA)", () => {
  test("public routes have zero serious or critical axe violations", async ({ page }) => {
    const publicRoutes = ["/", "/start", "/accessibility", "/credits", "/legal/ethical-use"];

    for (const route of publicRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      expect(
        seriousOrCritical,
        `Route ${route} has serious/critical axe violations: ${JSON.stringify(
          seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
          null,
          2,
        )}`,
      ).toHaveLength(0);
    }
  });

  test("authenticated app routes have zero serious or critical axe violations", async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `axe_user_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    const appRoutes = ["/dashboard", "/learn/core", "/labs", "/exam"];

    for (const route of appRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      expect(
        seriousOrCritical,
        `Route ${route} has serious/critical axe violations: ${JSON.stringify(
          seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
          null,
          2,
        )}`,
      ).toHaveLength(0);
    }
  });
});
