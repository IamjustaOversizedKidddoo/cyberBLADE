import fs from "node:fs";
import { test } from "@playwright/test";
import { promoteToRank } from "../../tests/e2e/helpers/rank0";

const DIR = process.env.SHOT_DIR ?? "../CYBER-PLATFORM-evidence/soc-curriculum";
const WIDTHS = [390, 768, 1440] as const;
const LESSONS = [
  { slug: "triage-loop", id: "soc-l1-triage-loop-01", exercise: "mini-queue" },
  { slug: "email-headers", id: "soc-l1-email-headers-01", exercise: "header-check" },
] as const;

test.beforeAll(() => fs.mkdirSync(DIR, { recursive: true }));

for (const w of WIDTHS) {
  test(`SOC L1 pilots at ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: w < 768 ? 844 : 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await promoteToRank(page, 1);
    for (const l of LESSONS) {
      await page.goto(`/learn/${l.id}`);
      // The hero kicker types itself in; wait for the full text so frames show the final state.
      await page.waitForFunction(() => /\d+ min$/.test(document.querySelector("[data-typed]")?.textContent ?? ""));
      await page.screenshot({ path: `${DIR}/${l.slug}-${w}-top.png` });
      await page.screenshot({ path: `${DIR}/${l.slug}-${w}-full.png`, fullPage: true });
      const ex = page.locator(`[data-exercise="${l.exercise}"]`);
      await ex.scrollIntoViewIfNeeded();
      // Every exercise must fit the viewport (no clipped options at 390 px).
      const box = await ex.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > w + 0.5) throw new Error(`${l.slug} exercise overflows at ${w}px`);
      const overflow = await ex.evaluate((el) => [...el.querySelectorAll("legend, label, fieldset")].some((n) => n.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5));
      if (overflow) throw new Error(`${l.slug} exercise content is clipped at ${w}px`);
      await ex.screenshot({ path: `${DIR}/${l.slug}-${w}-exercise.png` });
      const table = page.locator("article table").first();
      if (await table.count()) {
        await table.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${DIR}/${l.slug}-${w}-table.png` });
      }
      const diagram = page.locator("[data-flow-diagram]").first();
      if (await diagram.count()) await diagram.screenshot({ path: `${DIR}/${l.slug}-${w}-diagram.png` });
    }
    // Track pages: landing, module with checkpoint, glossary, and an open first-use tooltip.
    for (const [name, url] of [["track", "/learn/soc-l1"], ["module", "/learn/soc-l1/triage"], ["glossary", "/learn/soc-l1/glossary"]] as const) {
      await page.goto(url);
      await page.waitForFunction(() => /\S$/.test(document.querySelector("[data-typed]")?.textContent ?? "x"));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${DIR}/${name}-${w}-top.png` });
      await page.screenshot({ path: `${DIR}/${name}-${w}-full.png`, fullPage: true });
    }
    await page.goto("/learn/soc-l1/triage");
    const cp = page.locator("#checkpoint-h").locator("xpath=..");
    await cp.scrollIntoViewIfNeeded();
    await cp.screenshot({ path: `${DIR}/checkpoint-${w}.png` });
    await page.goto("/learn/soc-l1-dns-http-tls-01");
    const tip = page.getByRole("button", { name: /\(glossary term\)/ }).first();
    await tip.scrollIntoViewIfNeeded();
    await tip.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const box = await tip.boundingBox();
    if (box) await page.screenshot({ path: `${DIR}/tooltip-${w}.png`, clip: { x: 0, y: Math.max(0, box.y - 120), width: w, height: 360 } });
    // Drill page: task, a run with results.
    await page.goto("/practice/drills/drill-07");
    await page.getByRole("textbox", { name: "Your query" }).fill('source="auth" | stats count by user');
    await page.getByRole("button", { name: "Run and check" }).click();
    await page.getByRole("status").filter({ hasText: /Correct|Not yet/ }).waitFor();
    await page.screenshot({ path: `${DIR}/drill-${w}-top.png`, fullPage: false });
    await page.screenshot({ path: `${DIR}/drill-${w}-full.png`, fullPage: true });
    // Interaction states on the header exercise: wrong answer + hint, then correct answer + explanation.
    await page.goto(`/learn/soc-l1-email-headers-01`);
    const ex = page.locator(`[data-exercise="header-check"]`);
    const q = ex.locator("[data-question]").first();
    await q.getByRole("textbox").fill("172.16.40.25");
    await q.getByRole("button", { name: /check/i }).click();
    await q.getByRole("status").filter({ hasText: "Not yet" }).waitFor();
    await q.getByRole("button", { name: /hint/i }).click();
    await q.screenshot({ path: `${DIR}/email-headers-${w}-wrong-hint.png` });
    await q.getByRole("textbox").fill("192.0.2[.]58");
    await q.getByRole("button", { name: /check/i }).click();
    await q.getByRole("status").filter({ hasText: "Correct." }).waitFor();
    await q.screenshot({ path: `${DIR}/email-headers-${w}-correct.png` });
  });
}
