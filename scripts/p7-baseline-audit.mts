import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium, type Browser, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const PORT = 3108;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.join(os.tmpdir(), "cyberblade-p7", "baseline");

const OPERATORS = {
  r0_fresh: "fresh-operator-r0",
  r1_active: "e5b6989b-df1f-4af8-992e-32ec5827daeb",
  r2_watcher: "08e7cb50-4878-4b41-9a5a-f47c3ab5e324",
  r3_hunter: "hunter-operator-r3",
};

async function waitForServer(url: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = {}) {
  const filePath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: options.fullPage ?? false });
  console.log(`Saved screenshot: ${filename}`);
}

async function setOperator(page: Page, operatorId: string) {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "neon_uid",
      value: operatorId,
      url: BASE_URL,
    },
  ]);
}

interface PerfMetrics {
  url: string;
  device: "mobile" | "desktop";
  lcpMs: number;
  fcpMs: number;
  cls: number;
  tbtMs: number;
  totalJsBytes: number;
  totalTransferBytes: number;
  requestCount: number;
}

async function measurePerf(browser: Browser, url: string, device: "mobile" | "desktop", operatorId?: string | null): Promise<PerfMetrics> {
  const isMobile = device === "mobile";
  const context = await browser.newContext({
    viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent: isMobile
      ? "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
      : undefined,
  });

  if (operatorId) {
    await context.addCookies([
      { name: "neon_uid", value: operatorId, url: BASE_URL },
    ]);
  }

  const page = await context.newPage();

  if (isMobile) {
    const client = await context.newCDPSession(page);
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150, // 150ms slow 4G RTT
      downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
      uploadThroughput: (750 * 1024) / 8,
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // 4x slowdown
  }

  let totalJsBytes = 0;
  let totalTransferBytes = 0;
  let requestCount = 0;

  page.on("request", () => {
    requestCount++;
  });
  page.on("response", async (res) => {
    try {
      const headers = res.headers();
      const len = parseInt(headers["content-length"] || "0", 10);
      const urlStr = res.url();
      totalTransferBytes += len;
      if (urlStr.endsWith(".js") || headers["content-type"]?.includes("javascript")) {
        totalJsBytes += len;
      }
    } catch {
      // ignore
    }
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    let lcp = 0;
    let fcp = 0;
    let cls = 0;
    let tbt = 0;

    const paintEntries = performance.getEntriesByType("paint");
    for (const entry of paintEntries) {
      if (entry.name === "first-contentful-paint") fcp = entry.startTime;
    }

    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }

    const layoutShiftEntries = performance.getEntriesByType("layout-shift") as any[];
    for (const entry of layoutShiftEntries) {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    }

    const longTaskEntries = performance.getEntriesByType("longtask");
    for (const entry of longTaskEntries) {
      tbt += Math.max(0, entry.duration - 50);
    }

    return { lcp, fcp, cls, tbt };
  });

  await context.close();

  return {
    url,
    device,
    lcpMs: Math.round(metrics.lcp),
    fcpMs: Math.round(metrics.fcp),
    cls: parseFloat(metrics.cls.toFixed(4)),
    tbtMs: Math.round(metrics.tbt),
    totalJsBytes,
    totalTransferBytes,
    requestCount,
  };
}

interface AxeReport {
  url: string;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  violations: Array<{ id: string; impact: string; description: string; nodes: number }>;
}

async function runAxe(page: Page, urlName: string): Promise<AxeReport> {
  const report: AxeReport = {
    url: urlName,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    violations: [],
  };

  try {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    for (const v of results.violations) {
      if (v.impact === "critical") report.critical++;
      else if (v.impact === "serious") report.serious++;
      else if (v.impact === "moderate") report.moderate++;
      else if (v.impact === "minor") report.minor++;

      report.violations.push({
        id: v.id,
        impact: v.impact || "unknown",
        description: v.description,
        nodes: v.nodes.length,
      });
    }
  } catch (err) {
    console.warn(`Axe failed on ${urlName}:`, err);
  }

  return report;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`P7 Baseline Output directory: ${OUT_DIR}`);

  console.log("Starting Next.js server on port", PORT);
  const server: ChildProcess = spawn(
    "npx",
    ["next", "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CYBERBLADE_ALLOW_LOCAL_E2E: "true",
        NEON_DATA_DIR: ".data",
        NEON_SHOW_DRAFTS: "true",
      },
      shell: true,
      stdio: "pipe",
    }
  );

  const serverReady = await waitForServer(`${BASE_URL}/start`);
  if (!serverReady) {
    console.error("Server failed to respond within timeout.");
    server.kill();
    process.exit(1);
  }
  console.log("Server is ready at", BASE_URL);

  const browser: Browser = await chromium.launch();
  const axeReports: AxeReport[] = [];
  const perfReports: PerfMetrics[] = [];

  try {
    // -------------------------------------------------------------
    // 1. LANDING PAGE at 390px, 768px, 1440px (top, mid, bottom)
    // -------------------------------------------------------------
    const landingWidths = [
      { name: "390", width: 390, height: 844 },
      { name: "768", width: 768, height: 1024 },
      { name: "1440", width: 1440, height: 900 },
    ];

    for (const w of landingWidths) {
      const context = await browser.newContext({ viewport: { width: w.width, height: w.height } });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // Top
      await capture(page, `landing-${w.name}-top.png`, { fullPage: false });

      // Mid
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(500);
      await capture(page, `landing-${w.name}-mid.png`, { fullPage: false });

      // Bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await capture(page, `landing-${w.name}-bottom.png`, { fullPage: false });

      // Entire page
      await capture(page, `landing-${w.name}-full.png`, { fullPage: true });

      if (w.name === "1440") {
        const axe = await runAxe(page, "Landing Page (/)");
        axeReports.push(axe);
      }
      await context.close();
    }

    // -------------------------------------------------------------
    // 2. /start STATES (fresh, invalid, hosted-auth, loading, error)
    // -------------------------------------------------------------
    const startContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const startPage = await startContext.newPage();
    await startPage.goto(`${BASE_URL}/start`, { waitUntil: "networkidle" });
    await capture(startPage, "start-fresh-1440.png");
    const axeStart = await runAxe(startPage, "Onboarding (/start fresh)");
    axeReports.push(axeStart);

    // Invalid handle submit
    await startPage.getByRole("button", { name: "Start" }).click();
    await startPage.waitForTimeout(500);
    await capture(startPage, "start-error-invalid-1440.png");

    // Start on mobile 390
    await startPage.setViewportSize({ width: 390, height: 844 });
    await capture(startPage, "start-mobile-390.png");
    await startContext.close();

    // -------------------------------------------------------------
    // 3. LEGAL, CREDITS, 404, SESSION EXPIRED
    // -------------------------------------------------------------
    for (const [route, label] of [
      ["/legal/ethical-use", "legal-ethical-use"],
      ["/credits", "credits"],
      ["/not-found-nonexistent-page", "404-not-found"],
      ["/session/stale", "session-stale"],
    ] as const) {
      for (const w of [390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width: w, height: 900 } });
        const p = await context.newPage();
        await p.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
        await capture(p, `${label}-${w}.png`, { fullPage: true });
        if (w === 1440) {
          const axe = await runAxe(p, `${route}`);
          axeReports.push(axe);
        }
        await context.close();
      }
    }

    // -------------------------------------------------------------
    // 4. CORE APP ROUTES AT 390px and 768px
    // -------------------------------------------------------------
    const appRoutes = [
      { path: "/dashboard", op: OPERATORS.r1_active, name: "dashboard" },
      { path: "/learn/core", op: OPERATORS.r1_active, name: "learn-core" },
      { path: "/learn/core-r0-ls-01", op: OPERATORS.r1_active, name: "lesson-r0" },
      { path: "/labs", op: OPERATORS.r1_active, name: "labs-catalog" },
      { path: "/labs/core-r0-ls-lab-01", op: OPERATORS.r1_active, name: "lab-terminal-linux" },
      { path: "/labs/core-r1-win-eventlog-lab-01", op: OPERATORS.r1_active, name: "lab-terminal-powershell" },
      { path: "/labs/core-r1-pkt-http-lab-01", op: OPERATORS.r1_active, name: "lab-packet" },
      { path: "/labs/core-r2-web-sqli-lab-01", op: OPERATORS.r2_watcher, name: "lab-webapp" },
      { path: "/labs/core-r1-siem-investigation-01", op: OPERATORS.r1_active, name: "lab-siem" },
      { path: "/exam", op: OPERATORS.r1_active, name: "exam-hub" },
      { path: "/challenge/0", op: OPERATORS.r0_fresh, name: "challenge-r0" },
    ];

    for (const r of appRoutes) {
      for (const width of [390, 768]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage();
        await setOperator(page, r.op);
        await page.goto(`${BASE_URL}${r.path}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000);
        await capture(page, `${r.name}-${width}.png`, { fullPage: true });

        if (width === 390) {
          const axe = await runAxe(page, `${r.path} (${r.name}) mobile 390`);
          axeReports.push(axe);
        }
        await context.close();
      }
    }

    // -------------------------------------------------------------
    // 5. LIGHTHOUSE / PERF METRICS (MOBILE THROTTLED & DESKTOP)
    // -------------------------------------------------------------
    console.log("Measuring performance benchmarks...");
    const perfTargets = [
      { path: "/", op: null },
      { path: "/start", op: null },
      { path: "/dashboard", op: OPERATORS.r1_active },
      { path: "/learn/core-r0-ls-01", op: OPERATORS.r1_active },
      { path: "/labs/core-r0-ls-lab-01", op: OPERATORS.r1_active },
    ];

    for (const t of perfTargets) {
      const dPerf = await measurePerf(browser, `${BASE_URL}${t.path}`, "desktop", t.op);
      perfReports.push(dPerf);
      console.log(`Desktop Perf ${t.path}: LCP=${dPerf.lcpMs}ms, CLS=${dPerf.cls}, TBT=${dPerf.tbtMs}ms, JS=${dPerf.totalJsBytes}B`);

      const mPerf = await measurePerf(browser, `${BASE_URL}${t.path}`, "mobile", t.op);
      perfReports.push(mPerf);
      console.log(`Mobile Perf ${t.path}: LCP=${mPerf.lcpMs}ms, CLS=${mPerf.cls}, TBT=${mPerf.tbtMs}ms, JS=${mPerf.totalJsBytes}B`);
    }

    // -------------------------------------------------------------
    // 6. SAVE COMPLETE AUDIT REPORT
    // -------------------------------------------------------------
    const finalReport = {
      timestamp: new Date().toISOString(),
      axeReports,
      perfReports,
    };
    await fs.writeFile(
      path.join(OUT_DIR, "baseline-report.json"),
      JSON.stringify(finalReport, null, 2),
      "utf-8"
    );
    console.log("Baseline audit completed successfully!");
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error("Error in baseline audit script:", err);
  process.exit(1);
});
