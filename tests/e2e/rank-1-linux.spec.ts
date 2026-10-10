import { test, expect } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { promoteToRank } from "./helpers/rank0";
import { runCommand } from "./helpers/terminal";

test("a promoted Operator completes the Rank 1 SUID lab via terminal commands", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Promote operator to Rank 1
  await promoteToRank(page, 1);

  // 2. Open lesson 13: SUID, SGID, the Sticky Bit and sudo Rules
  await page.goto("/learn/core-r1-linux-special-01");
  await expect(page.getByRole("heading", { name: "SUID, SGID, the Sticky Bit and sudo Rules" })).toBeVisible();
  await answerAllChecks(page);

  // 3. Open the SUID privilege audit lab
  const labLink = page.getByRole("link", { name: "Open the lab" });
  await expect(labLink).toBeVisible();
  await labLink.click();
  await expect(page).toHaveURL(/\/labs\/core-r1-linux-suid-lab-01/);

  // Wait for terminal screen to paint
  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();

  // 4. Run discovery commands in the terminal
  const suidRaw = await runCommand(page, "find / -perm -4000 2>/dev/null");
  const suidPaths = suidRaw.trim().split("\n").map((p) => p.trim()).filter(Boolean);
  const count = String(suidPaths.length);
  const nonStandard = suidPaths.find((p) => !p.startsWith("/usr/bin/"));
  expect(nonStandard).toBeDefined();

  const lsOut = (await runCommand(page, `ls -l ${nonStandard!}`)).trim().split(/\s+/);
  const owner = lsOut[2];

  const sudoOut = await runCommand(page, "sudo -l");
  const sudoMatch = sudoOut.match(/NOPASSWD:\s*(\S+)/);
  expect(sudoMatch).not.toBeNull();
  const sudoCmd = sudoMatch![1];

  // 5. Submit all four objectives using in-terminal submit command
  await runCommand(page, `submit 1 ${nonStandard!}`);
  await runCommand(page, `submit 2 ${count}`);
  await runCommand(page, `submit 3 ${owner}`);
  await runCommand(page, `submit 4 ${sudoCmd}`);

  // 6. Verify completion banner and continuation link
  await expect(page.getByRole("status").filter({ hasText: "Lab complete" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Continue to next lesson: Processes, Signals and /proc →" })).toBeVisible();
});

test("mobile: lesson 12 has no horizontal page scroll", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "mobile journey");
  test.setTimeout(180_000);

  // Promote operator to Rank 1
  await promoteToRank(page, 1);

  // Open lesson 12: Permissions
  await page.goto("/learn/core-r1-linux-perms-01");
  await expect(page.getByRole("heading", { name: "Permissions: Read, Write, Execute" })).toBeVisible();

  // Verify page document has no horizontal overflow
  const pageOverflows = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(pageOverflows).toBe(false);

  // Verify preformatted blocks are rendered
  const preCount = await page.locator("pre").count();
  expect(preCount).toBeGreaterThan(0);
});
