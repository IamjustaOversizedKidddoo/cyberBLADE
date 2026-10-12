import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("--- KEYBOARD AUDIT: LANDING ---");
  await page.goto("http://localhost:3108/");
  await page.keyboard.press("Tab"); // Skip link
  let focused = await page.evaluate(() => document.activeElement?.outerHTML);
  console.log("Tab 1:", focused?.substring(0, 100));

  await page.keyboard.press("Tab"); // Home link or nav
  focused = await page.evaluate(() => document.activeElement?.outerHTML);
  console.log("Tab 2:", focused?.substring(0, 100));

  await browser.close();
}
main().catch(console.error);
