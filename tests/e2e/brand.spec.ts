import { expect, test } from "@playwright/test";
import { onboard } from "./helpers/rank0";

const PAGES = ["/", "/start", "/credits", "/legal/ethical-use"];

test("no visible NEON product name anywhere a visitor or operator looks", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page).toHaveTitle(/CYBERBLADE/);
    expect(await page.locator("body").innerText(), path).not.toMatch(/\bNEON\b/);
  }
  await page.goto("/start");
  await onboard(page);
  for (const path of ["/dashboard", "/learn/core"]) {
    await page.goto(path);
    await expect(page).toHaveTitle(/CYBERBLADE$/);
    expect(await page.locator("body").innerText(), path).not.toMatch(/\bNEON\b/);
  }
});
