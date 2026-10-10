import { test, expect } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { promoteToRank } from "./helpers/rank0";
import { runCommand } from "./helpers/terminal";

test("a promoted Operator completes the Rank 1 Windows Registry lab via PowerShell cmdlets", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Promote operator to Rank 1
  await promoteToRank(page, 1);

  // 2. Open lesson 17: Windows Architecture & The Windows Registry
  await page.goto("/learn/core-r1-win-arch-registry-01");
  await expect(page.getByRole("heading", { name: "Windows Architecture & The Windows Registry" })).toBeVisible();
  await answerAllChecks(page);

  // 3. Open the Registry lab
  const labLink = page.getByRole("link", { name: "Open the lab" });
  await expect(labLink).toBeVisible();
  await labLink.click();
  await expect(page).toHaveURL(/\/labs\/core-r1-win-registry-lab-01/);

  // Wait for terminal screen to paint
  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();

  // 4. Query registry Run key in the terminal
  const runKeyRaw = await runCommand(page, "Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run");
  const lines = runKeyRaw.split("\n");

  // Find non-default Run entry
  const rogueLine = lines.find((l) => l.includes(" : ") && !l.includes("SecurityHealth") && !l.includes("OneDriveSetup") && !l.includes("PSPath") && !l.includes("PSParentPath") && !l.includes("PSChildName") && !l.includes("PSDrive") && !l.includes("PSProvider"));
  expect(rogueLine).toBeDefined();

  const [propName, propVal] = rogueLine!.split(" : ").map((s) => s.trim());
  expect(propName).toBeDefined();
  expect(propVal).toBeDefined();

  // Query audit flag
  const flagRaw = await runCommand(page, "Get-ItemProperty HKLM:\\SOFTWARE\\CyberBlade\\Audit -Name Flag");
  const flagMatch = flagRaw.match(/CYBERBLADE\{[0-9a-f]{12}\}/);
  expect(flagMatch).not.toBeNull();
  const flag = flagMatch![0];

  // Inspect services in registry
  const svcRaw = await runCommand(page, "Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Services\\W32NetSvc");
  let svcImagePath = "";
  if (svcRaw.includes("ImagePath")) {
    const imgLine = svcRaw.split("\n").find((l) => l.includes("ImagePath"));
    svcImagePath = imgLine ? imgLine.split(" : ")[1].trim() : "";
  }
  if (!svcImagePath) {
    // Check alternative service names
    for (const s of ["SysTelemetryAgent", "RpcHealthProbe", "WinSecurityHelper"]) {
      const probe = await runCommand(page, `Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${s}`);
      if (probe.includes("ImagePath")) {
        const imgLine = probe.split("\n").find((l) => l.includes("ImagePath"));
        svcImagePath = imgLine ? imgLine.split(" : ")[1].trim() : "";
        break;
      }
    }
  }
  expect(svcImagePath).not.toBe("");

  // 5. Submit all four objectives using in-terminal submit command
  await runCommand(page, `submit 1 ${propName}`);
  await runCommand(page, `submit 2 ${propVal}`);
  await runCommand(page, `submit 3 ${svcImagePath}`);
  await runCommand(page, `submit 4 ${flag}`);

  // 6. Verify completion banner
  await expect(page.getByRole("status").filter({ hasText: "Lab complete" })).toBeVisible({ timeout: 15_000 });
});

test("mobile: lesson 17 has no horizontal page scroll", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "mobile journey");
  test.setTimeout(180_000);

  await promoteToRank(page, 1);
  await page.goto("/learn/core-r1-win-arch-registry-01");
  await expect(page.getByRole("heading", { level: 1, name: "Windows Architecture & The Windows Registry" })).toBeVisible({ timeout: 15_000 });

  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
