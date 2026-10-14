import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { onboard, promoteToRank } from "./helpers/rank0";

test.describe("BladeQL query drills page", () => {
  test("lists drills, checks a query on the server, passes axe and fits the viewport", async ({ page }) => {
    await promoteToRank(page, 1);
    await page.goto("/practice/drills");
    await expect(page.getByRole("link", { name: /Exact Equality Matching/ })).toBeVisible();
    await page.getByRole("link", { name: /Exact Equality Matching/ }).click();
    await expect(page).toHaveURL(/\/practice\/drills\/drill-02$/);

    const html = await page.content();
    expect(html).not.toContain("referenceQuery");
    expect(html).not.toContain('or `source=\\"auth\\" and outcome=\\"failure\\"`'); // the old answer-revealing hint

    const box = page.getByRole("textbox", { name: "Your query" });
    await box.focus();
    await page.keyboard.type('source="auth"');
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByRole("status")).toContainText("Not yet");
    await expect(page.getByRole("region", { name: /results of your query/i })).toBeVisible();

    await box.fill('source="auth" outcome="failure"');
    await page.getByRole("button", { name: "Run and check" }).press("Enter");
    await expect(page.getByRole("status")).toContainText("Correct");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".neon-glitch-copy").analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
  });

  test("rank 0 learners are redirected", async ({ page }) => {
    await onboard(page);
    await page.goto("/practice/drills/drill-01");
    await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
  });
});
