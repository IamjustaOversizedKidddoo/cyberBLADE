import { expect, test } from "@playwright/test";
import { onboard } from "./helpers/rank0";

test.describe("accessibility and keyboard pass (Task 10 / Build order I)", () => {
  test("single h1 and non-empty alt text across core pages", async ({ page }) => {
    for (const path of ["/", "/start"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      const images = page.locator("img");
      for (const img of await images.all()) {
        const alt = await img.getAttribute("alt");
        expect(alt).not.toBeNull();
        expect(alt!.trim().length).toBeGreaterThan(0);
      }
    }

    await page.goto("/start");
    await onboard(page, `a11y_${Date.now() % 1_000_000}`);
    for (const path of ["/dashboard", "/learn/core"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      const images = page.locator("img");
      for (const img of await images.all()) {
        const alt = await img.getAttribute("alt");
        expect(alt).not.toBeNull();
        expect(alt!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("keyboard tab order and focus ring on /", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "desktop keyboard journey");
    await page.goto("/");
    // First Tab reaches skip link
    await page.keyboard.press("Tab");
    const active = () => page.evaluate(() => document.activeElement?.getAttribute("href") ?? document.activeElement?.textContent ?? "");
    const outline = () =>
      page.evaluate(() => {
        const s = window.getComputedStyle(document.activeElement!);
        return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
      });

    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    expect(await outline()).toContain("2px");

    // Next tabs reach nav links
    await page.keyboard.press("Tab"); // Home link
    expect(await active()).toBe("/");
    expect(await outline()).toContain("2px");
  });

  test("on /dashboard, tab reaches next-mission link before course map", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "desktop keyboard journey");
    await page.goto("/start");
    await onboard(page, `a11y_dash_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    await page.locator("body").focus();
    const hrefs: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() => document.activeElement?.getAttribute("href"));
      if (href) hrefs.push(href);
      if (href && (href.startsWith("/learn/") || href.startsWith("/challenge/"))) break;
    }
    const nextMissionIdx = hrefs.findIndex((h) => /^\/(learn\/[a-z0-9-]+|challenge\/\d+)$/.test(h));
    expect(nextMissionIdx).toBeGreaterThanOrEqual(0);
    const courseMapIdx = hrefs.findIndex((h) => h.includes("/learn/core#rank-"));
    if (courseMapIdx !== -1) {
      expect(nextMissionIdx).toBeLessThan(courseMapIdx);
    }
  });

  test("high contrast: dark backgrounds (< 0.2 luminance) on bands and light strokes (> 0.6) on diagrams", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => (document.documentElement.dataset.contrast = "high"));

    const luminance = (rgbStr: string) => {
      const match = rgbStr.match(/\d+/g);
      if (!match || match.length < 3) return 0;
      const [r, g, b] = match.map(Number).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const bandPapers = page.locator(".band-paper");
    for (const band of await bandPapers.all()) {
      const bg = await band.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(luminance(bg)).toBeLessThan(0.2);
    }

    const bandCyans = page.locator(".band-cyan");
    for (const band of await bandCyans.all()) {
      const bg = await band.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(luminance(bg)).toBeLessThan(0.2);
    }

    const diagramLinks = page.locator(".diagram-link");
    if ((await diagramLinks.count()) > 0) {
      const stroke = await diagramLinks.first().evaluate((el) => getComputedStyle(el).stroke);
      expect(luminance(stroke)).toBeGreaterThan(0.6);
    }
  });

  test("decorative layers have aria-hidden=true", async ({ page }) => {
    await page.goto("/");
    const scanlines = page.locator(".neon-scanlines");
    if ((await scanlines.count()) > 0) {
      await expect(scanlines.first()).toHaveAttribute("aria-hidden", "true");
    }
    const noise = page.locator(".neon-noise");
    for (const n of await noise.all()) {
      await expect(n).toHaveAttribute("aria-hidden", "true");
    }
  });
});
