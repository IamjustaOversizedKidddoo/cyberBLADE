import { expect, test } from "@playwright/test";

test("a skip link is the first stop and lands on the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("theme colour and the blade favicon are declared", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#000000");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
});

test("nothing can push the page sideways, not even code or an anchor", async ({ page }) => {
  await page.goto("/#main");
  const shifted = await page.evaluate(() => {
    window.scrollTo(400, window.scrollY);
    return window.scrollX;
  });
  expect(shifted).toBe(0);
});

test.describe("page transition", () => {
  const scanAnimation = (page: import("@playwright/test").Page) =>
    page.locator("[data-route-scan]").evaluate((el) => getComputedStyle(el).animationName);

  test("moving to another page runs a scan line across the screen, without blocking clicks", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Start", exact: true }).click();
    await expect(page).toHaveURL(/\/start$/);
    const scan = page.locator("[data-route-scan]");
    await expect(scan).toHaveCount(1);
    await expect(scan).toHaveAttribute("aria-hidden", "true");
    await expect(scan).toHaveCSS("pointer-events", "none");
    expect(await scanAnimation(page)).toBe("route-scan");
  });

  test("reduced motion: no scan", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/start");
    expect(await scanAnimation(page)).toBe("none");
  });
});
