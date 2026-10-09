import { expect, test } from "@playwright/test";
import { onboard } from "./helpers/rank0";

test.describe("mobile compositions (375px and 320px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("landing page (/): no horizontal scroll, ENTER heading stacked, dossier wall single column and unrotated, no pin-spacer, tap targets >= 44px", async ({ page }) => {
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/");
      const diff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(diff).toBeLessThanOrEqual(0);
    }

    // Reset to 375 for the composition tests
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // ENTER heading stacked
    const enterLines = page.locator("#enter-heading span.block");
    await expect(enterLines).toHaveCount(2);
    const box0 = await enterLines.nth(0).boundingBox();
    const box1 = await enterLines.nth(1).boundingBox();
    expect(box0 && box1 && box1.y >= box0.y + box0.height - 1).toBe(true);

    // Dossier wall single column and unrotated (computed transform is none)
    const dossierCards = page.locator("#tracks ~ div > div");
    const cardMetrics = await dossierCards.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { x: Math.round(r.x), transform: s.transform };
      })
    );
    expect(cardMetrics.length).toBeGreaterThan(1);
    const firstX = cardMetrics[0].x;
    for (const m of cardMetrics) {
      expect(Math.abs(m.x - firstX)).toBeLessThanOrEqual(2);
      expect(m.transform).toBe("none");
    }

    // No pin-spacer elements at <= 767px
    await expect(page.locator(".pin-spacer")).toHaveCount(0);

    // Tap targets for Start links >= 44px
    const startLinks = page.getByRole("link", { name: "Start", exact: true });
    await expect(startLinks).toHaveCount(3);
    for (const link of await startLinks.all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("dashboard (/dashboard): no horizontal scroll, course map path vertical, tap targets >= 44px", async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `mob_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/dashboard");
      const diff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(diff).toBeLessThanOrEqual(0);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    // Course-map path vertical: node x positions equal +- 1px
    const nodes = page.locator("ol[aria-label='Shared core ranks'] > li");
    await expect(nodes).toHaveCount(3);
    const nodeXs = await nodes.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
    expect(Math.abs(nodeXs[0] - nodeXs[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(nodeXs[1] - nodeXs[2])).toBeLessThanOrEqual(1);

    // Begin / Continue action button >= 44px
    const actionLinks = page.locator("ol[aria-label='Shared core ranks']").getByRole("link");
    for (const link of await actionLinks.all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("learn core (/learn/core): no horizontal scroll, lesson links >= 44px", async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `mob_core_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/learn/core");
      const diff = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(diff).toBeLessThanOrEqual(0);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/learn/core");

    const lessonLinks = page.locator("main ol a[href^='/learn/']");
    expect(await lessonLinks.count()).toBeGreaterThan(0);
    for (const link of await lessonLinks.all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
