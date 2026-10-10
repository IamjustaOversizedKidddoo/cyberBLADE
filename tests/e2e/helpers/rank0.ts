import fs from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { OPERATOR_COOKIE } from "@/lib/identity/constants";
import { runCommand } from "./terminal";

export const FLAG = /CYBERBLADE\{[0-9a-f]{12}\}/;
export const flat = (s: string) => s.replace(/\n/g, "");

export async function onboard(page: Page, handle?: string) {
  await page.goto("/start");
  await page.getByLabel("Choose your operator handle").fill(handle ?? `op_${Date.now() % 1_000_000}`);
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

/** Drives promotion to targetRank. Sets rank in data store so both desktop and mobile can access higher ranks reliably. */
export async function promoteToRank(page: Page, targetRank: number): Promise<void> {
  if (targetRank <= 0) return;

  await onboard(page);
  const cookies = await page.context().cookies();
  const opCookie = cookies.find((c) => c.name === OPERATOR_COOKIE);
  if (!opCookie) throw new Error("no operator cookie found");

  const candidates = [
    path.resolve(process.env.CYBERBLADE_DATA_DIR ?? ".data-e2e", "operators.json"),
    path.resolve(".data-e2e", "operators.json"),
    path.resolve(".data", "operators.json"),
  ];

  for (const opFile of candidates) {
    try {
      const raw = await fs.readFile(opFile, "utf8");
      const data = JSON.parse(raw);
      if (data.operators && data.operators[opCookie.value]) {
        data.operators[opCookie.value].rank = targetRank;
        await fs.writeFile(opFile, JSON.stringify(data, null, 2), "utf8");
      }
    } catch {
      // file might not exist in that path
    }
  }
}

/** Marks all lessons of a given rank as completed in progress.json so its challenge unlocks. */
export async function unlockRankChallenge(page: Page, rank: number): Promise<void> {
  const cookies = await page.context().cookies();
  const opCookie = cookies.find((c) => c.name === OPERATOR_COOKIE);
  if (!opCookie) throw new Error("no operator cookie found");

  const candidates = [
    path.resolve(process.env.CYBERBLADE_DATA_DIR ?? ".data-e2e", "progress.json"),
    path.resolve(".data-e2e", "progress.json"),
    path.resolve(".data", "progress.json"),
  ];

  const contentDir = path.resolve("content/core", `rank-${rank}`);
  const files = await fs.readdir(contentDir);
  const lessonIds: string[] = [];
  for (const f of files) {
    if (f.endsWith(".mdx")) {
      const content = await fs.readFile(path.join(contentDir, f), "utf8");
      const match = content.match(/^id:\s*(\S+)/m);
      if (match) lessonIds.push(match[1]);
    }
  }

  const now = new Date().toISOString();
  for (const progFile of candidates) {
    try {
      let data: Record<string, Record<string, unknown>> = { lessons: {}, attempts: {}, xp: {}, challenges: {} };
      try {
        const raw = await fs.readFile(progFile, "utf8");
        data = JSON.parse(raw);
      } catch {
        // file will be created
      }
      data.lessons ||= {};
      for (const id of lessonIds) {
        data.lessons[`${opCookie.value}:${id}`] = {
          userId: opCookie.value,
          lessonId: id,
          status: "completed",
          checksPassed: ["q1", "q2", "q3", "q4"],
          completedAt: now,
        };
      }
      await fs.writeFile(progFile, JSON.stringify(data, null, 2), "utf8");
    } catch {
      // ignore
    }
  }
}
