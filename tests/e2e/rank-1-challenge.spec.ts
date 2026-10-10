import { test, expect } from "@playwright/test";
import { promoteToRank, unlockRankChallenge } from "./helpers/rank0";
import { runCommand } from "./helpers/terminal";

test("Operator completes Rank 1 Capstone Challenge (Operation Iron Gate) and promotes to Rank 2", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Set operator to Rank 1 and unlock the challenge
  await promoteToRank(page, 1);
  await unlockRankChallenge(page, 1);

  // 2. Open Rank 1 challenge page
  await page.goto("/challenge/1");
  await expect(page.getByRole("button", { name: "Start the challenge" })).toBeVisible();
  await page.getByRole("button", { name: "Start the challenge" }).click();

  // 3. Verify timer and wait for terminal screen to mount
  await expect(page.getByRole("timer")).toBeVisible();
  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();

  // 4. Extract incident triage artifacts
  const reportOut = await runCommand(page, "cat ~/Triage/incident-report.txt");
  const dnsMatch = reportOut.match(/Standard query \S+ A (\S+)/);
  expect(dnsMatch).not.toBeNull();
  const beaconDomain = dnsMatch![1];

  const ipMatch = reportOut.match(/Standard response \S+ A (\S+)/);
  expect(ipMatch).not.toBeNull();
  const beaconIp = ipMatch![1];

  // 5. Query Registry Run keys
  const runKeyOut = await runCommand(page, "Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run");
  const lines = runKeyOut.split("\n");
  const rogueLine = lines.find((l) => l.includes(" : ") && !l.includes("SecurityHealth") && !l.includes("OneDriveSetup") && !l.includes("PSPath") && !l.includes("PSParentPath") && !l.includes("PSChildName") && !l.includes("PSDrive") && !l.includes("PSProvider"));
  expect(rogueLine).toBeDefined();
  const rogueRunName = rogueLine!.split(" : ")[0].trim();

  // 6. Query Security Event Log for compromised user from external IP
  const secLogOut = await runCommand(page, "Get-WinEvent -LogName Security -Id 4624");
  const extLine = secLogOut.split("\n").find((l) => l.includes(beaconIp) || l.includes("ATTACK"));
  expect(extLine).toBeDefined();
  const userMatch = extLine!.match(/TargetUserName:\s*(\S+),/);
  expect(userMatch).not.toBeNull();
  const compromisedUser = userMatch![1];

  // 7. Query containment flag
  const flagRaw = await runCommand(page, "Get-ItemProperty HKLM:\\SOFTWARE\\CyberBlade\\Verification -Name ContainmentFlag");
  const flagMatch = flagRaw.match(/CYBERBLADE\{[0-9a-f]{12}\}/);
  expect(flagMatch).not.toBeNull();
  const flag = flagMatch![0];

  // 8. Submit all five challenge objectives (final command unmounts terminal into rankup screen)
  await runCommand(page, `submit 1 ${beaconIp}`);
  await runCommand(page, `submit 2 ${beaconDomain}`);
  await runCommand(page, `submit 3 ${rogueRunName}`);
  await runCommand(page, `submit 4 ${compromisedUser}`);

  await page.locator(".xterm-screen").click();
  await page.keyboard.press("Control+l");
  await page.keyboard.type(`submit 5 ${flag}`);
  await page.keyboard.press("Enter");

  // 9. Verify rank-up celebration screen appears with Rank 2 unlock
  await expect(page.getByRole("heading", { level: 1, name: "rank_2_unlocked" })).toBeVisible({ timeout: 20_000 });

  // 10. Return to dashboard and verify Rank 2 elevation
  await page.goto("/dashboard");
  await expect(page.getByText("Rank 2 · Watcher · 400 XP")).toBeVisible();
});
