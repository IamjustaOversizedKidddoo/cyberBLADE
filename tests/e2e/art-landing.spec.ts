import { expect, test } from "@playwright/test";

const SCENES = ["boot", "operator", "signal", "trace", "analyze", "defend", "enter"];
const STAGES = ["LEARN", "PRACTICE", "TRACE", "ANALYZE", "DEFEND", "MASTER"];
const TRACKS = ["Cybersecurity (Purple Team)", "SOC Analyst", "Penetration Tester / VAPT Analyst", "Cloud Security"];

test("the landing page is seven scenes in story order, with one h1 and two ways in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("CYBERBLADE");
  await expect(page.locator("h1")).toHaveCount(1);
  const order = await page.locator("section[data-scene-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-scene-id")));
  expect(order).toEqual(SCENES);
  const starts = page.getByRole("link", { name: "Start", exact: true });
  await expect(starts).toHaveCount(2);
  for (const link of await starts.all()) await expect(link).toHaveAttribute("href", "/start");
  for (const t of TRACKS) await expect(page.getByRole("heading", { name: t })).toBeAttached();
  for (const s of STAGES) await expect(page.locator("[data-stage]").filter({ hasText: s }).first()).toBeAttached();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("every scene heading, stage, track and Start link is visible", async ({ page }) => {
    await page.goto("/");
    for (const id of SCENES) await expect(page.locator(`#${id}-heading`)).toBeVisible();
    for (const t of TRACKS) await expect(page.getByRole("heading", { name: t })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start", exact: true })).toHaveCount(2);
  });
});

test("reduced motion: every scene is laid out in reading order, none on top of another", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const boxes = await page.locator("section[data-scene-id]").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; }));
  expect(boxes).toHaveLength(SCENES.length);
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
});

test("leaving the landing page mid-scene leaves nothing pinned behind", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "pinning only happens on wide screens");
  await page.goto("/start");
  const fresh = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.goto("/");
  await page.locator("#trace-heading").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600);
  await page.getByRole("link", { name: "Start", exact: true }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(fresh + 2);
});

test("on a phone the landing page fits the screen and never downloads three.js", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "phone layout");
  const scripts: string[] = [];
  page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
  await page.goto("/", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.waitForTimeout(3000);
  expect(scripts.filter((s) => /three/i.test(s))).toEqual([]);
});
