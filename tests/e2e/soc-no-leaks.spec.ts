import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { onboard } from "./helpers/rank0";
import { LEAK_RULES } from "../../lib/security/bundle-scan";

// Live check of what the browser actually receives on a question page: HTML, RSC/hydration
// payloads, JS and server-action responses must contain no truths, prompts or the attempt seed.
test("SOC question workspace responses carry no answers, seeds or truth keys", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "one network capture is enough");
  const bodies: Array<{ url: string; body: string }> = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (!/text|json|javascript|x-component|octet-stream/.test(type)) return;
    try {
      bodies.push({ url: res.url(), body: await res.text() });
    } catch {
      // redirects and aborted requests have no body
    }
  });

  await page.goto("/start");
  await onboard(page, `soc_leak_${Date.now() % 100000}`);
  await page.goto("/labs/soc/soc-f-phishing-cred-01");
  await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Log Search/i }).click();
  await expect(page.getByText("INVESTIGATION OBJECTIVES")).toBeVisible({ timeout: 15_000 });
  const firstAnswer = page.getByRole("textbox").filter({ hasNot: page.getByLabel("BladeQL Investigation Query Monospace Editor") }).last();
  if (await firstAnswer.isVisible()) {
    await firstAnswer.fill("203.0.113.250");
    await page.getByRole("button", { name: /Submit Answer/i }).first().click();
  }
  await page.waitForTimeout(1500);

  // The attempt-pinned seed for this session, read from the e2e server's local store.
  const store = JSON.parse(fs.readFileSync(path.resolve(".data-e2e", "progress.json"), "utf8")) as {
    socAttempts?: Record<string, { scenarioId: string; seed: string; startedAt: string }>;
  };
  const attempt = Object.values(store.socAttempts ?? {})
    .filter((a) => a.scenarioId === "soc-f-phishing-cred-01")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  expect(attempt?.seed).toBeTruthy();

  expect(bodies.length).toBeGreaterThan(5);
  const hits: string[] = [];
  for (const { url, body } of bodies) {
    if (body.includes(attempt.seed)) hits.push(`seed in ${url}`);
    for (const rule of LEAK_RULES) if (rule.re.test(body)) hits.push(`${rule.id} in ${url}`);
  }
  expect(hits).toEqual([]);
});
