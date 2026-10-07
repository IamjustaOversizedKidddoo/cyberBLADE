import { expect, type Page } from "@playwright/test";

const PROMPT = /^\S+@\S+:.*\$$/;

async function lines(page: Page): Promise<string[]> {
  return (await page.locator(".xterm-rows > div").allInnerTexts()).map((r) => r.replace(/ /g, " ").trimEnd());
}

function outputAfter(rows: string[], cmd: string): string | null {
  const at = rows.findLastIndex((l) => l.endsWith(`$ ${cmd}`));
  if (at < 0) return null;
  const rest = rows.slice(at + 1);
  const end = rest.findIndex((l) => PROMPT.test(l));
  return end < 0 ? null : rest.slice(0, end).join("\n");
}

/**
 * Types a command into the lab terminal like a learner (click, Ctrl+L to clear, type, Enter) and
 * returns what it printed, up to the next prompt. xterm only renders the visible screen, so the
 * screen is cleared first; output longer than one screen would be cut off. Long lines wrap.
 */
export async function runCommand(page: Page, cmd: string): Promise<string> {
  await page.locator(".xterm-screen").click();
  await page.keyboard.press("Control+l");
  await expect.poll(async () => (await lines(page)).filter(Boolean).length, { timeout: 5_000 }).toBe(1);
  await page.keyboard.type(cmd);
  await page.keyboard.press("Enter");
  await expect.poll(async () => outputAfter(await lines(page), cmd), { timeout: 10_000 }).not.toBeNull();
  return outputAfter(await lines(page), cmd)!;
}
