import { test, expect } from "@playwright/test";
import { BRAND } from "../../lib/brand";

test("home page responds and shows the brand", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByText(BRAND.name).first()).toBeVisible();
});
