import { expect, test } from "@playwright/test";

const SECTIONS = ["enter-heading", "discover-heading", "understand-heading", "choose-heading", "start-heading"];
const STEPS = ["Briefing", "Terminal Check", "Lab", "Debrief"];
const TRACKS = ["Cybersecurity (Purple Team)", "SOC Analyst", "Penetration Tester / VAPT Analyst", "Cloud Security"];

test("the landing page tells its story in five sections with one h1", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  for (const id of SECTIONS) await expect(page.locator(`section[aria-labelledby="${id}"]`)).toHaveCount(1);
  const starts = page.getByRole("link", { name: "Start", exact: true });
  await expect(starts).toHaveCount(2);
  for (const link of await starts.all()) await expect(link).toHaveAttribute("href", "/start");
  for (const t of TRACKS) await expect(page.getByRole("heading", { name: t })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("every section, step, track and Start link is there and visible", async ({ page }) => {
    await page.goto("/");
    for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
    for (const s of STEPS) await expect(page.locator("[data-step-item]").filter({ hasText: s }).first()).toBeVisible();
    for (const t of TRACKS) await expect(page.getByRole("heading", { name: t })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start", exact: true })).toHaveCount(2);
  });
});

test("leaving the landing page mid-scene leaves nothing pinned behind", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "pinning only happens on wide screens");
  await page.goto("/start");
  const fresh = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.goto("/");
  await page.locator("#understand-heading").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600);
  await page.getByRole("link", { name: "Start", exact: true }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(fresh + 2);
});

test("on a phone the landing page fits the screen", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "phone layout");
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
});
