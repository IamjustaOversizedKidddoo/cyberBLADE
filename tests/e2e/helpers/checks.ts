import { expect, type Locator, type Page } from "@playwright/test";

async function tryOption(question: Locator, index: number): Promise<boolean> {
  const before = Number(await question.getAttribute("data-attempts"));
  await question.getByRole("radio").nth(index).check();
  await question.getByRole("button", { name: "Check answer" }).click();
  await expect(question).toHaveAttribute("data-attempts", String(before + 1));
  return (await question.getAttribute("data-result")) === "correct";
}

/** Answers every Terminal Check question through the UI, trying options in order (no answer keys). */
export async function answerAllChecks(page: Page): Promise<void> {
  // Root cause of the load-sensitive rank-2 failure: clicks landed on the server-rendered HTML
  // before React attached handlers, so data-attempts never moved. Wait for hydration first.
  await expect(page.locator('[data-hydrated="true"]').first()).toBeAttached({ timeout: 30_000 });
  const questions = page.locator("fieldset[data-attempts]");
  const count = await questions.count();
  expect(count).toBeGreaterThanOrEqual(3);
  for (let q = 0; q < count; q++) {
    const question = questions.nth(q);
    const options = await question.getByRole("radio").count();
    let solved = false;
    for (let i = 0; i < options && !solved; i++) solved = await tryOption(question, i);
    expect(solved, `question ${q + 1} has a correct option`).toBe(true);
  }
}
