import { expect, type Page } from "@playwright/test";

const PROMPT = /^\S+@\S+:.*\$$/;

async function lines(page: Page): Promise<string[]> {
  return (await page.locator(".xterm-rows > div").allInnerTexts()).map((r) => r.replace(/ /g, " ").trimEnd());
}

/**
 * Types a command into the lab terminal like a learner (click, type, Enter) and returns the output
 * printed after it, up to the next prompt. Output wraps at the terminal width.
 */
export async function runCommand(page: Page, cmd: string): Promise<string> {
  const before = (await lines(page)).filter((l) => PROMPT.test(l) || l.includes("$ ")).length;
  await page.locator(".xterm-screen").click();
  await page.keyboard.type(cmd);
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => {
      const now = await lines(page);
      const at = now.findLastIndex((l) => l.endsWith(`$ ${cmd}`));
      return at >= 0 && now.filter((l) => PROMPT.test(l) || l.includes("$ ")).length > before && now.slice(at + 1).some((l) => PROMPT.test(l));
    }, { timeout: 10_000 })
    .toBe(true);
  const now = await lines(page);
  const at = now.findLastIndex((l) => l.endsWith(`$ ${cmd}`));
  const out = now.slice(at + 1);
  return out.slice(0, out.findIndex((l) => PROMPT.test(l))).join("\n");
}
