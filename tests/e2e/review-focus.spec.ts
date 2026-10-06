import { test, expect, type Page } from "@playwright/test";

let counter = 0;
const uniqueHandle = () => `rf_${(Date.now() + counter++) % 1_000_000}`;

async function onboard(page: Page) {
  await page.getByLabel("Choose your operator handle").fill(uniqueHandle());
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
}

for (const next of ["//evil.example", "/%09/evil.example", "/%0A/evil.example", "/%5Cevil.example"]) {
  test(`next=${next} stays on site`, async ({ page }) => {
    await page.goto(`/start?next=${next}`);
    await onboard(page);
    await expect(page).toHaveURL(/^http:\/\/localhost:3000\//);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test("stale cookie is cleared and the visitor is sent to /start", async ({ page, context }) => {
  await context.addCookies([{ name: "neon_uid", value: "does-not-exist", url: "http://localhost:3000" }]);
  const response = await page.goto("/dashboard");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/start$/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "neon_uid")).toBeUndefined();
});

test("hero heading is announced once", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "NEON", exact: true })).toBeVisible();
});

test("reduced motion: no scanlines, static cursor, full kicker text", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".neon-scanlines")).toBeHidden();
  const cursorAnimation = await page.locator(".neon-cursor").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(cursorAnimation).toBe("none");
  await expect(page.locator("[data-typed]").first()).toHaveText("> BE READY TO LEARN");
});

test("readable text never uses the Hacked or Pixel fonts", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  const fonts = await page.evaluate(() =>
    [...document.querySelectorAll("label, [role=alert], p, li")].map((el) => getComputedStyle(el).fontFamily),
  );
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(f.toLowerCase()).not.toMatch(/hacked|pixel/);
});
