import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers/rank0";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axeClean(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS).exclude(".neon-glitch-copy");
  if (include) builder = builder.include(include);
  const r = await builder.analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Moves keyboard focus forward until `target` has it (keyboard only, no clicks). */
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("could not reach the element with Tab");
}

test.describe("SOC practice exams", () => {
  test.describe.configure({ timeout: 120_000 });

  test("knowledge exam end to end with the keyboard only: lobby, timer, answers, submit, results, readiness", async ({ page }) => {
    await onboard(page);
    await page.goto("/labs/soc/exams");
    await expect(page.getByRole("heading", { name: "How practice exams work" })).toBeVisible();
    await expect(page.getByText(/unproctored and are not equivalent to any real certification exam/)).toBeVisible();
    await axeClean(page);
    await noHorizontalScroll(page);

    await tabTo(page, page.getByRole("button", { name: "Start knowledge exam" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Not yet" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Start the clock" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/labs\/soc\/exams\/[0-9a-f-]{36}$/);

    // Timer HUD: server-synced, announce on demand only.
    const timer = page.getByRole("group", { name: "Exam timer" });
    await expect(timer).toContainText(/Time left/);
    await tabTo(page, page.getByRole("button", { name: "Announce time remaining" }));
    await page.keyboard.press("Enter");
    await expect(timer.getByRole("status")).toContainText(/minutes? .*left/);

    // No answer key or explanation is in the page before submission.
    const before = await page.content();
    expect(before).not.toMatch(/correctOptionIds|explanation|"answer":\[/);

    // Answer the first question with the keyboard.
    const firstRadio = page.getByRole("radio").first();
    await tabTo(page, firstRadio);
    await page.keyboard.press("Space");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await axeClean(page);
    await noHorizontalScroll(page);

    // Refresh does not reset the clock or lose the answer.
    await page.reload();
    await expect(page.getByRole("radio").first()).toBeChecked();

    await tabTo(page, page.getByRole("button", { name: "Submit exam" }).first());
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "What made up your score" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/not equivalent to, and does not predict, any real exam result/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Review · \d+ of 25 correct$/ })).toBeVisible();
    await axeClean(page);
    await noHorizontalScroll(page);

    await page.goto("/labs/soc/exams/readiness");
    await expect(page.getByRole("heading", { name: "Not ready yet" })).toBeVisible();
    await expect(page.getByText(/Not met yet/).first()).toBeVisible();
    await expect(page.getByText("Your recent practice meets our provisional readiness criteria.")).toHaveCount(0);
    await axeClean(page);
    await noHorizontalScroll(page);
  });

  test("scenario exam: workspace with timer and exam submit, no practice feedback, then results", async ({ page }) => {
    await onboard(page);
    await page.goto("/labs/soc/exams");
    await tabTo(page, page.getByRole("button", { name: "Start time-management drill" }));
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Start the clock" }).press("Enter");
    await expect(page.getByRole("group", { name: "Exam timer" })).toBeVisible();
    const submit = page.getByRole("button", { name: /^Submit exam \(\d+\/\d+ triaged\)$/ });
    await expect(submit).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Submit Shift/ })).toHaveCount(0);
    await axeClean(page, "[aria-label='Exam timer']");
    await submit.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Submit exam", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "Decision quality" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Review alerts, debriefs/ })).toBeVisible();
    await axeClean(page);
    await noHorizontalScroll(page);
  });
});
