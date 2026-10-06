import { test, expect, type Page } from "@playwright/test";

async function onboard(page: Page, handle: string) {
  await page.getByLabel("Choose your operator handle").fill(handle);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
}

test("new visitor onboards and lands on the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/start\?next=%2Fdashboard$/);

  const handle = `e2e_${Date.now() % 1_000_000}`;
  await onboard(page, handle);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`> welcome, ${handle}`)).toBeAttached();
  await expect(page.getByText("Rank 0 · Initiate").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "job_tracks" })).toBeVisible();
});

test("an off-site next link never leaves the site", async ({ page }) => {
  await page.goto("/start?next=https://evil.example");
  await onboard(page, `e2e_${(Date.now() + 1) % 1_000_000}`);
  await expect(page).toHaveURL(/localhost:3000\/dashboard$/);
});

test("form errors are shown and the visitor stays on /start", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Use 3–20 letters" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "accept the agreement" })).toBeVisible();
  await expect(page).toHaveURL(/\/start/);
});

test("switch operator returns to the landing page and re-gates", async ({ page }) => {
  await page.goto("/start");
  await onboard(page, `e2e_${(Date.now() + 2) % 1_000_000}`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Switch operator" }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/start/);
});

test("dashboard has no horizontal scroll", async ({ page }) => {
  await page.goto("/start");
  await onboard(page, `e2e_${(Date.now() + 3) % 1_000_000}`);
  await expect(page).toHaveURL(/\/dashboard$/);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
