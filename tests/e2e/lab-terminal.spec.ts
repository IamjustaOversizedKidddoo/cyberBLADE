import { test, expect } from "@playwright/test";
import { runCommand } from "./helpers/terminal";

test.use({ viewport: { width: 1280, height: 900 } });

test("the lab terminal runs commands and shows output", async ({ page }) => {
  await page.goto("/start?next=/labs/core-r0-terminal-lab-01");
  await page.getByLabel("Choose your operator handle").fill(`lab_${Date.now() % 1_000_000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/labs\/core-r0-terminal-lab-01$/);

  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();
  await expect(page.locator(".xterm-rows")).toContainText("This machine is a simulation");
  expect(await runCommand(page, "pwd")).toMatch(/^\/home\/[a-z]+$/);
  expect(await runCommand(page, "whoami")).toMatch(/^[a-z]+$/);
  expect(await runCommand(page, "frobnicate")).toBe("frobnicate: command not found");
  expect(await runCommand(page, "ls")).toContain("README.txt");
});

test("answers can be submitted from inside the terminal", async ({ page }) => {
  await page.goto("/start?next=/labs/core-r0-terminal-lab-01");
  await page.getByLabel("Choose your operator handle").fill(`sub_${Date.now() % 1_000_000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/labs\/core-r0-terminal-lab-01$/);
  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();
  await expect(page.locator(".xterm-rows")).toContainText("submit");

  const count = (await runCommand(page, "grep -c ERROR /var/log/app.log")).trim();
  expect(await runCommand(page, "submit 3 999")).toContain("Not quite");
  expect(await runCommand(page, `submit 3 ${count}`)).toContain("✓ Correct — objective 3 solved.");
  expect(await runCommand(page, "submit 9 x")).toContain("there is no objective 9");
  await expect(page.locator("#objectives-heading ~ ol > li").nth(2).getByText("✓ Solved")).toBeVisible();
});
