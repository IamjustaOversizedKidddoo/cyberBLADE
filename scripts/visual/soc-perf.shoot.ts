import fs from "node:fs";
import { test } from "@playwright/test";
import { promoteToRank } from "../../tests/e2e/helpers/rank0";

/**
 * Performance evidence for SOC L1 pages, using the repo's baseline method (docs/visual/baseline.md:
 * compressed first-load JS per route) plus LCP and CLS from the browser's PerformanceObserver.
 * Lighthouse itself is not installed in this repo; this is the closest local equivalent.
 */
const DIR = process.env.SHOT_DIR ?? "../CYBER-PLATFORM-evidence/soc-curriculum";
const ROUTES = [
  "/learn/core-r0-comp-hardware-01",
  "/learn/soc-l1-triage-loop-01",
  "/learn/soc-l1-thinking-in-queries-01",
  "/learn/soc-l1",
  "/learn/soc-l1/triage",
  "/learn/soc-l1/glossary",
  "/practice/drills/drill-07",
];

test("SOC L1 performance vs baseline", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await promoteToRank(page, 1);
  const rows: string[] = [];
  for (const route of ROUTES) {
    const c = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width: 390, height: 844 } });
    const p = await c.newPage();
    let bytes = 0;
    const pending: Promise<void>[] = [];
    p.on("response", (r) => {
      if (r.request().resourceType() === "script") pending.push(r.request().sizes().then((s) => void (bytes += s.responseBodySize)));
    });
    await p.addInitScript(() => {
      const w = window as unknown as { __lcp: number; __cls: number };
      w.__lcp = 0;
      w.__cls = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
          const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!s.hadRecentInput) w.__cls += s.value;
        }),
      ).observe({ type: "layout-shift", buffered: true });
    });
    await p.goto(route, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    await Promise.all(pending);
    const m = await p.evaluate(() => {
      const w = window as unknown as { __lcp: number; __cls: number };
      return { lcp: Math.round(w.__lcp), cls: Math.round(w.__cls * 1000) / 1000 };
    });
    rows.push(`| \`${route}\` | ${(bytes / 1024).toFixed(1)} | ${m.lcp} | ${m.cls} |`);
    await c.close();
  }
  fs.mkdirSync(DIR, { recursive: true });
  const md = `| Route (390 px, cold load) | First-load JS (KB, compressed) | LCP (ms) | CLS |\n|---|---|---|---|\n${rows.join("\n")}\n`;
  fs.writeFileSync(`${DIR}/perf.md`, md);
  console.log(md);
});
