import { test, expect, type Page } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { runCommand } from "./helpers/terminal";

const FLAG = /NEON\{[0-9a-f]{12}\}/;
const flat = (s: string) => s.replace(/\n/g, "");

async function onboard(page: Page) {
  await page.goto("/start");
  await page.getByLabel("Choose your operator handle").fill(`r0_${Date.now() % 1_000_000}`);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function submit(page: Page, objective: number, answer: string, { last = false } = {}) {
  const item = page.locator("#objectives-heading ~ ol > li").nth(objective);
  await item.getByLabel(`Answer for objective ${objective + 1}`).fill(answer);
  await item.getByRole("button", { name: "Submit" }).click();
  // The final challenge answer refreshes straight into the promotion screen.
  if (!last) await expect(item.getByText("✓ Solved")).toBeVisible();
}

/** Same recipes as tests/labs/*, but typed into the real xterm. */
const LAB_RECIPES: Record<string, (page: Page) => Promise<void>> = {
  "core-r0-files-lab-01": async (page) => {
    const listing = (await runCommand(page, "ls -l ~/shared")).split("\n").slice(1);
    const name = (prefix: string) => listing.find((l) => l.startsWith(prefix))!.split(/\s+/).pop()!;
    await submit(page, 0, name("-rw-------"));
    const flag = flat(await runCommand(page, `cat ~/shared/${name("-rw-r--r--")}`)).match(FLAG)![0];
    await submit(page, 1, flag);
  },
  "core-r0-terminal-lab-01": async (page) => {
    const hidden = (await runCommand(page, "ls -a ~")).split(/\s+/).filter((n) => n.startsWith(".") && n !== "." && n !== "..");
    let flag1 = "";
    for (const h of hidden) flag1 ||= flat(await runCommand(page, `cat ~/${h}`)).match(FLAG)?.[0] ?? "";
    await submit(page, 0, flag1);
    await submit(page, 1, flat(await runCommand(page, "tail -n 1 /var/log/backup.log")).match(FLAG)![0]);
    await submit(page, 2, (await runCommand(page, "grep -c ERROR /var/log/app.log")).trim());
  },
};

async function solveChallenge(page: Page) {
  const me = (await runCommand(page, "whoami")).trim();
  const users = (await runCommand(page, "cat /etc/passwd"))
    .split("\n")
    .map((l) => l.split(":"))
    .filter((f) => Number(f[2]) >= 1000 && f[0] !== me)
    .map((f) => f[0]);
  let top = "";
  let best = -1;
  for (const u of users) {
    const n = Number((await runCommand(page, `grep -c "Failed password for.* ${u} from" /var/log/auth.log`)).trim());
    if (n > best) [top, best] = [u, n];
  }
  await submit(page, 0, top);
  const path = flat(await runCommand(page, "cat ~/notes.txt")).match(/\/srv\/drop\/[a-z]+-[0-9a-f]{4}\.txt/)![0];
  await submit(page, 1, flat(await runCommand(page, `cat ${path}`)).match(FLAG)![0]);
  await submit(page, 2, (await runCommand(page, 'grep -vc "^#" /etc/firewall/allowlist.txt')).trim(), { last: true });
}

test("a new user completes Rank 0 and is promoted to Operator", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "full journey runs on desktop");
  test.setTimeout(300_000);
  await onboard(page);

  await page.getByRole("link", { name: "Begin rank_0" }).click();
  await expect(page).toHaveURL(/\/learn\/core#rank-0$/);
  const lessonLinks = page.locator('main ol a[href^="/learn/core-r0-"]');
  await expect(lessonLinks).toHaveCount(6);
  const hrefs = await lessonLinks.evaluateAll((as) => as.map((a) => a.getAttribute("href")!));

  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.getByRole("note")).toHaveText(/DRAFT/);
    await answerAllChecks(page);
    const lab = page.getByRole("link", { name: "Open the lab" });
    if (await lab.count()) {
      const labId = (await lab.getAttribute("href"))!.split("?")[0].split("/").pop()!;
      await lab.click();
      // xterm pauses painting while off-screen; look at it like a learner would.
      await page.locator(".xterm-screen").scrollIntoViewIfNeeded();
      await expect(page.locator(".xterm-rows")).toContainText("simulation");
      await LAB_RECIPES[labId](page);
      await expect(page.getByRole("status").filter({ hasText: "Lab complete" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Continue to next lesson: / })).toBeVisible();
    }
  }

  await page.goto("/learn/core");
  await expect(page.locator("main ol a").filter({ hasText: "✓ Completed" })).toHaveCount(6);
  await page.getByRole("link", { name: "Open the challenge" }).click();
  await page.getByRole("button", { name: "Start the challenge" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.locator(".xterm-screen").scrollIntoViewIfNeeded();
  await expect(page.locator(".xterm-rows")).toContainText("simulation");
  await solveChallenge(page);
  await expect(page.getByRole("heading", { level: 1, name: "rank_1_unlocked" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/dashboard");
  await expect(page.getByText("Rank 1 · Operator · 1150 XP")).toBeVisible();
});

test("lesson 1 reads well on a phone", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "mobile layout check");
  await onboard(page);
  await page.goto("/learn/core-r0-comp-hardware-01");
  await expect(page.getByRole("heading", { level: 1, name: "What a Computer Really Is" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Briefing" })).toBeVisible();
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
