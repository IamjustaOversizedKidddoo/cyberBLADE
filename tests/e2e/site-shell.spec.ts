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
