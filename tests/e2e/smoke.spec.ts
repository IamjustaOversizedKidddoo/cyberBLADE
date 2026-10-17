import { test, expect } from "@playwright/test";
import { BRAND } from "../../lib/brand";

test("home page responds and shows the brand", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByText(BRAND.name).first()).toBeVisible();
});

test("full release smoke journey: sign-up -> lesson -> 4 lab engines -> L1 exam -> Handler -> sign-out", async ({ page }) => {
  // 1. Sign-up / onboarding
  await page.goto("/start");
  const handle = `smoke_${Date.now() % 1_000_000}`;
  await page.getByLabel("Choose your operator handle").fill(handle);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByText(`> welcome, ${handle}`).first()).toBeAttached();

  // 2. Lesson view
  await page.goto("/learn/core-r0-comp-hardware-01");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

  // 3. Handler message (Socratic tutor guidance during lesson)
  const handlerBtn = page.getByRole("button", { name: /THE HANDLER/i });
  await expect(handlerBtn).toBeVisible({ timeout: 10_000 });
  await handlerBtn.click();
  const drawer = page.locator("#handler-drawer");
  await expect(drawer).toBeVisible();
  const simplifyChip = drawer.getByRole("button", { name: "Simplify" });
  await expect(simplifyChip).toBeVisible();
  await simplifyChip.click();
  await expect(drawer.getByText(/In Plain English \(No Jargon\)/i)).toBeVisible({ timeout: 10_000 });

  // Close handler drawer
  await drawer.getByRole("button", { name: /Close Handler Panel/i }).click();

  // 4. One lab per engine
  // Engine A: Terminal simulation engine
  await page.goto("/labs/core-r0-terminal-lab-01");
  await expect(page.locator(".xterm-screen")).toBeVisible({ timeout: 15_000 });

  // Engine B: Files & VFS inspection engine
  await page.goto("/labs/core-r0-files-lab-01");
  await expect(page.locator(".xterm-screen")).toBeVisible({ timeout: 15_000 });

  // Engine C: Rank challenge engine
  await page.goto("/challenge/0");
  await expect(page.locator("#challenge-heading")).toBeVisible({ timeout: 15_000 });

  // Engine D: SOC investigation & alert triage engine
  await page.goto("/labs/soc/soc-l1-noisy-shift");
  await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });

  // 5. L1 practice exam
  await page.goto("/labs/soc/exams");
  await expect(page.getByRole("heading", { name: "How practice exams work" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start knowledge exam" }).click();
  await page.getByRole("button", { name: "Start the clock" }).click();
  await expect(page).toHaveURL(/\/labs\/soc\/exams\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole("group", { name: "Exam timer" })).toBeVisible();

  // 6. Sign-out
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Switch operator" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/start/);
});
