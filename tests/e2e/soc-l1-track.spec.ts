import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard, promoteToRank } from "./helpers/rank0";

async function axeClean(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".neon-glitch-copy").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
}

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("SOC L1 track pages", () => {
  test.beforeEach(async ({ page }) => {
    await promoteToRank(page, 1);
  });

  test("core curriculum links to the track; landing, module and glossary pass axe and fit the viewport", async ({ page }) => {
    await page.goto("/learn/core");
    await page.getByRole("link", { name: /SOC Analyst L1/ }).click();
    await expect(page).toHaveURL(/\/learn\/soc-l1$/);
    await expect(page.getByRole("heading", { name: "Curriculum map" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Modules" }).getByRole("listitem")).toHaveCount(12);
    await expect(page.getByRole("heading", { name: "Practice paths" })).toBeVisible();
    await noSidewaysScroll(page);
    await axeClean(page);

    await page.getByRole("link", { name: /Alert triage/ }).first().click();
    await expect(page).toHaveURL(/\/learn\/soc-l1\/triage$/);
    await expect(page.getByRole("heading", { name: "Module checkpoint" })).toBeVisible();
    await noSidewaysScroll(page);
    await axeClean(page);

    await page.goto("/learn/soc-l1/glossary");
    await expect(page.getByRole("term").first()).toBeVisible();
    await noSidewaysScroll(page);
    await axeClean(page);
  });

  test("glossary tooltip opens with the keyboard, links to the glossary and closes with Escape", async ({ page }) => {
    await page.goto("/learn/soc-l1-dns-http-tls-01");
    const term = page.getByRole("button", { name: /\(glossary term\)/ }).first();
    await term.focus();
    await page.keyboard.press("Enter");
    await expect(term).toHaveAttribute("aria-expanded", "true");
    const link = page.getByRole("link", { name: "Open in glossary" });
    await expect(link).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(term).toHaveAttribute("aria-expanded", "false");
    await expect(link).toHaveCount(0);
    await axeClean(page);
  });

  test("a checkpoint question can be answered with the keyboard alone", async ({ page }) => {
    await page.goto("/learn/soc-l1/triage");
    const first = page.getByRole("group").first();
    const radio = first.getByRole("radio").first();
    await radio.focus();
    await page.keyboard.press("Space");
    const submit = first.getByRole("button").first();
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(first.getByText(/WHY THIS (IS CORRECT|DISTRACTOR IS INCORRECT)/).first()).toBeVisible();
  });

  test("lesson reader shows the module breadcrumb", async ({ page }) => {
    await page.goto("/learn/soc-l1-triage-loop-01");
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb.getByRole("link", { name: "Alert triage" })).toBeVisible();
    await expect(crumb).toContainText("Lesson 2 of 5");
  });
});

test("rank 0 learners are redirected from the track pages", async ({ page }) => {
  await onboard(page);
  await page.goto("/learn/soc-l1");
  await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
  await page.goto("/learn/soc-l1/glossary");
  await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
});
