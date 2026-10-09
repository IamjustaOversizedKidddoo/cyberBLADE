import { expect, test } from "@playwright/test";

test.describe("smooth scrolling keeps the keyboard in charge", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium-desktop", "smooth scroll runs on desktop only"));

  test("End reaches the footer and Home returns to the top", async ({ page }) => {
    await page.goto("/");
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("End");
    await expect(page.locator("footer")).toBeInViewport({ timeout: 5000 });
    await page.keyboard.press("Home");
    // At the very top the wordmark is the camera's macro close-up, so check the scroll position itself.
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(5);
  });

  test("tabbing to a link far down the page brings it into view", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // The scenes add their pinned scroll distance when they're built; tab once the page is ready.
    await expect.poll(() => page.locator(".pin-spacer").count()).toBe(6);
    const last = page.getByRole("link", { name: "Start", exact: true }).last();
    await last.focus();
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport({ timeout: 5000 });
  });
});
