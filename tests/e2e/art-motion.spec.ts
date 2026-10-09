import { expect, test, type Page } from "@playwright/test";

const PINNED = 6; // BOOT, OPERATOR, SIGNAL, TRACE, ANALYZE, DEFEND

test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium-desktop", "pinned scenes run on desktop only"));

/** What every animated element looks like right now: computed transform and opacity, in DOM order. */
const look = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-camera], [data-from], [data-char]")].map((el) => {
      const s = getComputedStyle(el);
      return `${s.transform}|${s.opacity}`;
    }),
  );

test("reduced motion switched ON mid-scene: pins drop and every element snaps to its final state, live", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect.poll(() => page.locator(".pin-spacer").count()).toBe(PINNED);
  await page.locator("#trace-heading").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(800);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.locator(".pin-spacer").count()).toBe(0);
  await expect(page.locator("[data-scene][data-step]")).toHaveCount(0);
  const switchedLive = await look(page);
  // the same page loaded with reduced motion from the start is the definition of "final state"
  await page.reload({ waitUntil: "networkidle" });
  expect(switchedLive).toEqual(await look(page));
});

test("reduced motion switched back OFF: the scenes re-arm", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.locator(".pin-spacer").count()).toBe(PINNED);
});

test("the flick test: no pinned scene can be skipped in one 360px wheel step", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect.poll(() => page.locator(".pin-spacer").count()).toBe(PINNED);
  const extra = await page.locator(".pin-spacer").evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height - (el.firstElementChild as HTMLElement).getBoundingClientRect().height),
  );
  // each scene plays over its pinned distance; at least five 360px flicks per scene keeps every beat readable
  for (const distance of extra) expect(distance).toBeGreaterThanOrEqual(5 * 360);
});
