import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard, promoteToRank } from "./helpers/rank0";

const PILOTS = [
  { id: "soc-l1-triage-loop-01", exercise: "mini-queue", title: /triage loop/i },
  { id: "soc-l1-email-headers-01", exercise: "header-check", title: /email headers/i },
] as const;

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude(".neon-glitch-copy")
    .analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("SOC L1 pilot lessons", () => {
  test.beforeEach(async ({ page }) => {
    await promoteToRank(page, 1);
  });

  for (const l of PILOTS) {
    test(`${l.id}: renders the template, passes axe and fits the viewport`, async ({ page }) => {
      await page.goto(`/learn/${l.id}`);
      await expect(page.getByRole("heading", { level: 1, name: l.title })).toBeVisible();
      for (const h of ["Why this matters on shift", "Worked example", "Try it", "Check your understanding", "Key terms", "Practice this"]) {
        await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
      }
      await expect(page.locator(`[data-exercise="${l.exercise}"]`)).toBeVisible();
      await expect(page.getByRole("link", { name: /scenario|shift|workbench|report section/i }).first()).toBeVisible();

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(scrollW, "page scrolls sideways").toBeLessThanOrEqual(1);
      const ex = await page.locator(`[data-exercise="${l.exercise}"]`).boundingBox();
      const vw = page.viewportSize()!.width;
      expect(ex!.x).toBeGreaterThanOrEqual(0);
      expect(ex!.x + ex!.width).toBeLessThanOrEqual(vw + 1);

      const violations = await seriousAxe(page);
      expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
    });
  }

  test("answer keys and explanations never reach the page before a correct answer", async ({ page }) => {
    await page.goto("/learn/soc-l1-email-headers-01");
    const html = await page.content();
    expect(html).not.toContain("is the address it actually saw");
    expect(html).not.toContain('"accept"');
  });

  test("header exercise works with the keyboard only: wrong, hint, then defanged correct answer", async ({ page }) => {
    await page.goto("/learn/soc-l1-email-headers-01");
    const q = page.locator('[data-exercise="header-check"] [data-question="delivering-ip"]');
    const input = q.getByRole("textbox");
    await input.focus();
    await page.keyboard.type("172.16.40.25");
    await page.keyboard.press("Enter");
    await expect(q.getByRole("status")).toContainText("Not yet");

    await page.keyboard.press("Tab"); // Check answer
    await page.keyboard.press("Tab"); // Show a hint
    await expect(q.getByRole("button", { name: /show a hint/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(q.getByText("Read the Received lines from the bottom up.")).toBeVisible();

    await input.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("192.0.2[.]58");
    await page.keyboard.press("Enter");
    await expect(q.getByRole("status")).toContainText("Correct.");
    await expect(q.getByText("is the address it actually saw")).toBeVisible();
  });

  test("choice question works with arrow keys", async ({ page }) => {
    await page.goto("/learn/soc-l1-email-headers-01");
    const q = page.locator('[data-exercise="header-check"] [data-question="spf-result"]');
    await q.getByRole("radio", { name: "pass", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(q.getByRole("radio", { name: "softfail" })).toBeChecked();
    await q.getByRole("button", { name: "Check answer" }).press("Enter");
    await expect(q.getByRole("status")).toContainText("Correct.");
  });
});

test("a rank 0 learner is redirected away from a SOC L1 lesson", async ({ page }) => {
  await onboard(page);
  await page.goto("/learn/soc-l1-triage-loop-01");
  await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
});

// Every SOC L1 lesson (not just the pilots): renders its template, fits the viewport, passes axe.
test.describe("all SOC L1 lessons", () => {
  const ids: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".mdx")) ids.push(/^id: (.+)$/m.exec(fs.readFileSync(p, "utf8"))![1].trim());
    }
  };
  walk("content/tracks/soc/l1");

  test(`all ${ids.length} lessons render, fit the viewport and pass axe`, async ({ page }) => {
    test.setTimeout(600_000);
    await promoteToRank(page, 1);
    for (const id of ids) {
      await page.goto(`/learn/${id}`);
      await expect(page.getByRole("heading", { level: 2, name: "Check your understanding" }), id).toBeVisible();
      await expect(page.locator("[data-exercise]").first(), id).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${id} scrolls sideways`).toBeLessThanOrEqual(1);
      const violations = await seriousAxe(page);
      expect(violations, `${id}: ${JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`).toEqual([]);
    }
  });
});
