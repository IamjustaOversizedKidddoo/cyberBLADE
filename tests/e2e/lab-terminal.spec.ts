import { test, expect } from "@playwright/test";
import { runCommand } from "./helpers/terminal";

test.use({ viewport: { width: 1280, height: 900 } });

test("the lab terminal runs commands and shows output", async ({ page }) => {
  await page.goto("/start?next=/labs/core-r0-terminal-lab-01");
  await page.getByLabel("Choose your operator handle").fill(`lab_${Date.now() % 1_000_000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/labs\/core-r0-terminal-lab-01$/);

  await expect(page.locator(".xterm-rows")).toContainText("This machine is a simulation");
  expect(await runCommand(page, "pwd")).toMatch(/^\/home\/[a-z]+$/);
  expect(await runCommand(page, "whoami")).toMatch(/^[a-z]+$/);
  expect(await runCommand(page, "frobnicate")).toBe("frobnicate: command not found");
  expect(await runCommand(page, "ls")).toContain("README.txt");
});
