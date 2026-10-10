import { test, expect } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { promoteToRank, submitObjective, unlockRankChallenge } from "./helpers/rank0";

test("a promoted Watcher explores Rank 2 web security lessons and completes SQL injection web lab", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Promote to Rank 2
  await promoteToRank(page, 2);

  // 2. Visit learning map and verify Rank 2 (Watcher) section & 12 lessons
  await page.goto("/learn/core");
  await expect(page.getByRole("heading", { name: /rank_2 · Watcher/ })).toBeVisible();

  const rank2LessonLinks = page.locator('#rank-2 ol a[href^="/learn/core-r2-"]');
  await expect(rank2LessonLinks).toHaveCount(12);

  // 3. Open lesson 24: SQL Injection
  await page.goto("/learn/core-r2-sqli-01");
  await expect(page.getByRole("heading", { name: "SQL Injection: Mechanisms, Exploitation & Defense" })).toBeVisible();
  await answerAllChecks(page);

  // 4. Open SQLi web lab
  const labLink = page.getByRole("link", { name: "Open the lab" });
  await expect(labLink).toBeVisible();
  await labLink.click();
  await expect(page).toHaveURL(/\/labs\/core-r2-sqli-lab-01/);

  // 5. Verify webapp lab UI components
  await expect(page.getByText("TARGET WEB APPLICATION:")).toBeVisible();
  await expect(page.getByText("Apex Vault Core")).toBeVisible();
  await expect(page.getByRole("button", { name: /HTTP INSPECTOR/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /COOKIE JAR/ })).toBeVisible();

  const addressInput = page.getByPlaceholder("http://target.internal/...");
  const frame = page.frameLocator('iframe[title="Sandboxed WebApp Target"]');

  // 6. Objective 2: UNION SQL Injection extraction
  await addressInput.fill("http://apex-vault.internal/search?q=' UNION SELECT 1,2,3,4--");
  await page.getByRole("button", { name: "GO" }).click();

  await expect(frame.getByText(/RECOVERED: CYBERBLADE\{sqli_union_[0-9a-f]{8}\}/)).toBeVisible();
  const unionText = await frame.locator("body").innerText();
  const flagUnionMatch = unionText.match(/CYBERBLADE\{sqli_union_[0-9a-f]{8}\}/);
  expect(flagUnionMatch).not.toBeNull();
  const flagUnion = flagUnionMatch![0];

  // 7. Objective 1: Auth Bypass SQL Injection
  await addressInput.fill("http://apex-vault.internal/login");
  await page.getByRole("button", { name: "GO" }).click();

  await frame.locator('input[name="username"]').fill("' OR '1'='1");
  await frame.locator('input[name="password"]').fill("anything");
  await frame.locator('button[type="submit"]').click();

  await expect(frame.getByText(/OBJ-1 FLAG: CYBERBLADE\{sqli_auth_[0-9a-f]{8}\}/)).toBeVisible();
  const authText = await frame.locator("body").innerText();
  const flagAuthMatch = authText.match(/CYBERBLADE\{sqli_auth_[0-9a-f]{8}\}/);
  expect(flagAuthMatch).not.toBeNull();
  const flagAuth = flagAuthMatch![0];

  // 8. Submit both lab objectives
  await submitObjective(page, 0, flagAuth);
  await submitObjective(page, 1, flagUnion);
});

test("Watcher completes Rank 2 Capstone Challenge (Operation Watchtower) and promotes to Rank 3 Hunter", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Set operator to Rank 2 and unlock Rank 2 challenge
  await promoteToRank(page, 2);
  await unlockRankChallenge(page, 2);

  // 2. Open Rank 2 challenge page
  await page.goto("/challenge/2");
  await expect(page.getByRole("button", { name: "Start the challenge" })).toBeVisible();
  await page.getByRole("button", { name: "Start the challenge" }).click();

  // 3. Verify timer and webapp lab mount
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Operation Watchtower Master System")).toBeVisible();

  const addressInput = page.getByPlaceholder("http://target.internal/...");
  const frame = page.frameLocator('iframe[title="Sandboxed WebApp Target"]');

  // 4. Objective 1: IDOR on /api/contracts?ref=CTR-7701
  await addressInput.fill("http://watchtower.cyberblade.lab/api/contracts?ref=CTR-7701");
  await page.getByRole("button", { name: "GO" }).click();
  await expect(frame.getByText(/CYBERBLADE\{watchtower_idor_[0-9a-f]{8}\}/)).toBeVisible();
  const idorText = await frame.locator("body").innerText();
  const flagIdorMatch = idorText.match(/CYBERBLADE\{watchtower_idor_[0-9a-f]{8}\}/);
  expect(flagIdorMatch).not.toBeNull();
  const flagIdor = flagIdorMatch![0];
  await submitObjective(page, 0, flagIdor);

  // 5. Objective 2: SQLi on /orders/lookup?code=ORD-01' OR '1'='1
  await addressInput.fill("http://watchtower.cyberblade.lab/orders/lookup?code=ORD-01' OR '1'='1");
  await page.getByRole("button", { name: "GO" }).click();
  await expect(frame.getByText(/CYBERBLADE\{watchtower_sqli_[0-9a-f]{8}\}/)).toBeVisible();
  const sqliText = await frame.locator("body").innerText();
  const flagSqliMatch = sqliText.match(/CYBERBLADE\{watchtower_sqli_[0-9a-f]{8}\}/);
  expect(flagSqliMatch).not.toBeNull();
  const flagSqli = flagSqliMatch![0];
  await submitObjective(page, 1, flagSqli);

  // 6. Objective 3: Cookie tampering to gain superadmin privileges on /admin/debug
  await addressInput.fill("http://watchtower.cyberblade.lab/admin/debug");
  await page.getByRole("button", { name: "GO" }).click();

  await page.getByRole("button", { name: /COOKIE JAR/ }).click();
  await page.getByPlaceholder("Cookie Name (e.g. watchtower_role)").fill("watchtower_role");
  await page.getByPlaceholder("Value (e.g. superadmin)").fill("superadmin");
  await page.getByRole("button", { name: "UPDATE COOKIE" }).click();

  await addressInput.fill("http://watchtower.cyberblade.lab/admin/debug");
  await page.getByRole("button", { name: "GO" }).click();
  await expect(frame.getByText(/CYBERBLADE\{watchtower_root_[0-9a-f]{8}\}/)).toBeVisible();
  const rootText = await frame.locator("body").innerText();
  const flagRootMatch = rootText.match(/CYBERBLADE\{watchtower_root_[0-9a-f]{8}\}/);
  expect(flagRootMatch).not.toBeNull();
  const flagRoot = flagRootMatch![0];

  // 7. Submit final objective (unmounts into rank-up screen)
  await submitObjective(page, 2, flagRoot, { last: true });

  // 8. Verify rank-up celebration screen appears with Rank 3 unlock
  await expect(page.getByRole("heading", { level: 1, name: "rank_3_unlocked" })).toBeVisible({ timeout: 20_000 });

  // 9. Return to dashboard and verify Rank 3 Hunter elevation
  await page.goto("/dashboard");
  await expect(page.getByText("Rank 3 · Hunter · 400 XP")).toBeVisible();
});
