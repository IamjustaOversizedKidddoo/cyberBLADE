import fs from "node:fs";
import { test, type Page } from "@playwright/test";

const DIR = process.env.SHOT_DIR ?? "docs/visual/after";
const SIZES = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "375", width: 375, height: 812 },
] as const;

async function onboard(page: Page) {
  await page.goto("/start");
  await page.getByLabel("Choose your operator handle").fill(`shot_${Date.now() % 100000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/dashboard$/);
}

for (const size of SIZES) {
  test(`pages at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ reducedMotion: "reduce" }); // stable, final-state frames
    await page.goto("/");
    await page.screenshot({ path: `${DIR}/landing-${size.name}.png`, fullPage: true });
    await onboard(page);
    await page.screenshot({ path: `${DIR}/dashboard-${size.name}.png`, fullPage: true });
    await page.goto("/learn/core");
    await page.screenshot({ path: `${DIR}/learn-core-${size.name}.png`, fullPage: true });
  });
}

/** Compressed JS transferred on a cold first load of each route (what a visitor downloads). */
test("first-load JS per route", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await onboard(page);
  const routes = ["/", "/dashboard", "/learn/core", "/learn/core-r0-comp-hardware-01", "/labs/core-r0-terminal-lab-01"];
  const rows: string[] = [];
  for (const route of routes) {
    const c = await browser.newContext({ storageState: await ctx.storageState() });
    const p = await c.newPage();
    let bytes = 0;
    const pending: Promise<void>[] = [];
    p.on("response", (r) => {
      if (r.request().resourceType() === "script") pending.push(r.request().sizes().then((s) => void (bytes += s.responseBodySize)));
    });
    await p.goto(route, { waitUntil: "networkidle" });
    await Promise.all(pending);
    rows.push(`| \`${route}\` | ${(bytes / 1024).toFixed(1)} |`);
    await c.close();
  }
  fs.writeFileSync(`${DIR}/js-sizes.md`, `| Route | First-load JS (KB, compressed) |\n|---|---|\n${rows.join("\n")}\n`);
});
