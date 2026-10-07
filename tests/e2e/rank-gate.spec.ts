import { test, expect } from "@playwright/test";

// Enabled in Task 8 once the Rank 1 content exists.
test.fixme("a Rank 0 learner cannot open Rank 1 lessons or labs", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Choose your operator handle").fill(`gate_${Date.now() % 1_000_000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/learn/core-r1-net-osi-01");
  await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
  await expect(page.getByRole("status").filter({ hasText: "Locked — pass the Rank 0 challenge to open this." })).toBeVisible();

  await page.goto("/labs/core-r1-net-ip-lab-01");
  await expect(page).toHaveURL(/\/learn\/core\?locked=1$/);
  await expect(page.locator(".xterm")).toHaveCount(0);

  // Rank 1 is listed but locked: titles shown without links.
  await expect(page.getByRole("heading", { name: /rank_1 · Operator/ })).toBeVisible();
  await expect(page.locator('a[href^="/learn/core-r1-"]')).toHaveCount(0);
});
