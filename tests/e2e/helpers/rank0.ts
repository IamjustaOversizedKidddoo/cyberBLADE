import { expect, type Page } from "@playwright/test";
import { runCommand } from "./terminal";

export const FLAG = /CYBERBLADE\{[0-9a-f]{12}\}/;
export const flat = (s: string) => s.replace(/\n/g, "");

export async function onboard(page: Page, handle?: string) {
  await page.goto("/start");
  const uniqueHandle = handle ?? `op_${Math.floor(Math.random() * 89999 + 10000)}_${Date.now() % 10000}`;
  await page.getByLabel("Choose your operator handle").fill(uniqueHandle);
  await page.getByLabel("I have read and agree to the ethical use agreement").check();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

export async function submitObjective(page: Page, objective: number, answer: string, { last = false } = {}) {
  const item = page.locator("#objectives-heading ~ ol > li").nth(objective);
  await item.getByLabel(`Answer for objective ${objective + 1}`).fill(answer);
  await item.getByRole("button", { name: "Submit" }).click();
  if (!last) await expect(item.getByText("✓ Solved")).toBeVisible();
}

export const LAB_RECIPES: Record<string, (page: Page) => Promise<void>> = {
  "core-r0-files-lab-01": async (page) => {
    const listing = (await runCommand(page, "ls -l ~/shared")).split("\n").slice(1);
    const name = (prefix: string) => listing.find((l) => l.startsWith(prefix))!.split(/\s+/).pop()!;
    await submitObjective(page, 0, name("-rw-------"));
    const flag = flat(await runCommand(page, `cat ~/shared/${name("-rw-r--r--")}`)).match(FLAG)![0];
    await submitObjective(page, 1, flag);
  },
  "core-r0-terminal-lab-01": async (page) => {
    const hidden = (await runCommand(page, "ls -a ~")).split(/\s+/).filter((n) => n.startsWith(".") && n !== "." && n !== "..");
    let flag1 = "";
    for (const h of hidden) flag1 ||= flat(await runCommand(page, `cat ~/${h}`)).match(FLAG)?.[0] ?? "";
    await submitObjective(page, 0, flag1);
    await submitObjective(page, 1, flat(await runCommand(page, "tail -n 1 /var/log/backup.log")).match(FLAG)![0]);
    await submitObjective(page, 2, (await runCommand(page, "grep -c ERROR /var/log/app.log")).trim());
  },
};

export async function solveChallenge(page: Page) {
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
  await submitObjective(page, 0, top);
  const path = flat(await runCommand(page, "cat ~/notes.txt")).match(/\/srv\/drop\/[a-z]+-[0-9a-f]{4}\.txt/)![0];
  await submitObjective(page, 1, flat(await runCommand(page, `cat ${path}`)).match(FLAG)![0]);
  await submitObjective(page, 2, (await runCommand(page, 'grep -vc "^#" /etc/firewall/allowlist.txt')).trim(), { last: true });
}

/**
 * Fixture changes go through the server (app/api/e2e, test-only), never by editing its data files:
 * the server's own writes used to drop file edits made from the test process (lost updates under
 * load, the root cause of flaky rank-gated journeys), and the old helpers could touch `.data`.
 */
async function e2eFixture(page: Page, body: Record<string, unknown>): Promise<void> {
  const res = await page.request.post("/api/e2e", { data: body });
  if (!res.ok()) throw new Error(`e2e fixture ${JSON.stringify(body)} failed: ${res.status()}`);
}

/** Drives promotion to targetRank. Sets rank in data store so both desktop and mobile can access higher ranks reliably. */
export async function promoteToRank(page: Page, targetRank: number): Promise<void> {
  if (targetRank <= 0) return;

  await onboard(page);
  await e2eFixture(page, { action: "promote", rank: targetRank });

  // Ensure server session observes the updated rank on dashboard
  await page.goto("/dashboard");
  await expect(page.getByText(new RegExp(`Rank ${targetRank}`)).first()).toBeVisible({ timeout: 10_000 });
}

/** Marks all core lessons of a rank as completed (through the server) so its challenge unlocks. */
export async function unlockRankChallenge(page: Page, rank: number): Promise<void> {
  await e2eFixture(page, { action: "complete-rank-lessons", rank });
}
