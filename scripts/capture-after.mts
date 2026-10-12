import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium, type Browser, type Page } from "playwright";

const PORT = 3108;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.join(os.tmpdir(), "cyberblade-p6", "after");
const DOCS_DIR = path.join(process.cwd(), "docs", "design", "screenshots");

const OPERATORS = {
  r0_fresh: "fresh-operator-r0",
  r1_active: "e5b6989b-df1f-4af8-992e-32ec5827daeb",
  r2_watcher: "08e7cb50-4878-4b41-9a5a-f47c3ab5e324",
  r3_hunter: "hunter-operator-r3",
};

async function waitForServer(url: string, timeoutMs = 35000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function capture(page: Page, filename: string, options: { fullPage?: boolean; copyToDocs?: boolean } = {}) {
  const filePath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: options.fullPage ?? true });
  console.log(`Saved screenshot: ${filename}`);

  if (options.copyToDocs) {
    const docsPath = path.join(DOCS_DIR, filename);
    await fs.copyFile(filePath, docsPath);
  }
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

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(DOCS_DIR, { recursive: true });
  console.log(`Output directory: ${OUT_DIR}`);
  console.log(`Docs directory: ${DOCS_DIR}`);

  // Start Next.js production server for fast and stable screenshots
  console.log("Starting Next.js server on port", PORT);
  const server: ChildProcess = spawn(
    "npx",
    ["next", "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CYBERBLADE_ALLOW_LOCAL_E2E: "true",
        CYBERBLADE_SHOW_DEV_UI: "true",
        NEON_DATA_DIR: ".data",
        NEON_SHOW_DRAFTS: "true",
      },
      shell: true,
      stdio: "pipe",
    }
  );

  const consoleErrors: string[] = [];

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    server.kill();
    throw new Error(`Server failed to start on ${BASE_URL}`);
  }
  console.log("Server is ready on", BASE_URL);

  const browser: Browser = await chromium.launch({ headless: true });

  try {
    for (const width of [1440, 1024]) {
      const height = width === 1440 ? 900 : 768;
      const context = await browser.newContext({
        viewport: { width, height },
      });
      const page = await context.newPage();

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(`[${page.url()}] ${msg.text()}`);
        }
      });

      page.on("pageerror", (err) => {
        consoleErrors.push(`[${page.url()}] PageError: ${err.message}`);
      });

      console.log(`\n=== Capturing After screenshots at ${width}px ===`);

      // 1. Dashboard (in-progress Rank 1)
      await setOperator(page, OPERATORS.r1_active);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
      await capture(page, `dashboard-${width}.png`, { copyToDocs: width === 1440 });

      // 1b. Dashboard (fresh Rank 0)
      await setOperator(page, OPERATORS.r0_fresh);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
      await capture(page, `dashboard-empty-fresh-${width}.png`, { copyToDocs: width === 1440 });

      // 1c. Dashboard (Rank 2 Watcher)
      await setOperator(page, OPERATORS.r2_watcher);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
      await capture(page, `dashboard-rank2-${width}.png`);

      // 2. /learn/core roadmap
      await setOperator(page, OPERATORS.r1_active);
      await page.goto(`${BASE_URL}/learn/core`, { waitUntil: "networkidle" });
      await capture(page, `learn-core-${width}.png`, { copyToDocs: width === 1440 });

      // 3. Rank 0 lesson: What a computer is
      await page.goto(`${BASE_URL}/learn/core-r0-comp-hardware-01`, { waitUntil: "networkidle" });
      await capture(page, `lesson-rank0-${width}.png`, { copyToDocs: width === 1440 });

      // 4. Rank 1 lesson with check questions: OSI layers
      await page.goto(`${BASE_URL}/learn/core-r1-net-osi-01`, { waitUntil: "networkidle" });
      await capture(page, `lesson-rank1-unanswered-${width}.png`);

      // Interact with check questions to see feedback state
      const checkRadios = page.locator('input[type="radio"]');
      if (await checkRadios.count() > 0) {
        await checkRadios.first().check();
        const submitBtn = page.getByRole("button", { name: /Submit Answer/i }).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(600);
          await capture(page, `lesson-rank1-answered-${width}.png`, { copyToDocs: width === 1440 });
        }
      }

      // 5. Rank 2 lesson: SQLi
      await setOperator(page, OPERATORS.r2_watcher);
      await page.goto(`${BASE_URL}/learn/core-r2-sqli-01`, { waitUntil: "networkidle" });
      await capture(page, `lesson-rank2-${width}.png`);

      // 6. /labs directory
      await setOperator(page, OPERATORS.r1_active);
      await page.goto(`${BASE_URL}/labs`, { waitUntil: "networkidle" });
      await capture(page, `labs-directory-${width}.png`, { copyToDocs: width === 1440 });

      // 6b. /labs filtered
      const filterInput = page.getByPlaceholder(/Search labs/i);
      if (await filterInput.isVisible()) {
        await filterInput.fill("packet");
        await page.waitForTimeout(300);
        await capture(page, `labs-directory-filtered-${width}.png`);
        await filterInput.fill("xyznonexistent");
        await page.waitForTimeout(300);
        await capture(page, `labs-directory-empty-${width}.png`);
      }

      // 7. Lab engines
      // 7a. Linux terminal lab
      await page.goto(`${BASE_URL}/labs/core-r1-linux-perms-lab-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500); // allow xterm to mount
      await capture(page, `lab-terminal-linux-${width}.png`, { copyToDocs: width === 1440 });

      // 7b. PowerShell terminal lab
      await page.goto(`${BASE_URL}/labs/core-r1-win-registry-lab-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await capture(page, `lab-terminal-powershell-${width}.png`, { copyToDocs: width === 1440 });

      // 7c. Packet lab
      await page.goto(`${BASE_URL}/labs/core-r1-pkt-http-lab-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, `lab-packet-${width}.png`, { copyToDocs: width === 1440 });

      // 7d. WebApp lab
      await setOperator(page, OPERATORS.r2_watcher);
      await page.goto(`${BASE_URL}/labs/core-r2-sqli-lab-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, `lab-webapp-${width}.png`, { copyToDocs: width === 1440 });

      // 7e. SIEM lab
      await setOperator(page, OPERATORS.r1_active);
      await page.goto(`${BASE_URL}/labs/core-r1-siem-log-analysis-01`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await capture(page, `lab-siem-${width}.png`, { copyToDocs: width === 1440 });

      // 8. /exam Readiness Hub
      await page.goto(`${BASE_URL}/exam`, { waitUntil: "networkidle" });
      await capture(page, `exam-hub-collapsed-${width}.png`, { copyToDocs: width === 1440 });

      // Expand a domain matrix table
      const viewMatrixBtn = page.getByRole("button", { name: "[View matrix]" }).first();
      if (await viewMatrixBtn.isVisible()) {
        await viewMatrixBtn.click();
        await page.waitForTimeout(400);
        await capture(page, `exam-hub-expanded-${width}.png`, { copyToDocs: width === 1440 });
      }

      // 9. Challenge arena
      await setOperator(page, OPERATORS.r0_fresh);
      await page.goto(`${BASE_URL}/challenge/0`, { waitUntil: "networkidle" });
      await capture(page, `challenge-rank0-before-${width}.png`, { copyToDocs: width === 1440 });

      await setOperator(page, OPERATORS.r1_active);
      await page.goto(`${BASE_URL}/challenge/1`, { waitUntil: "networkidle" });
      await capture(page, `challenge-rank1-${width}.png`);

      // 10. AppShell with each rank badge state
      for (const [key, opId] of Object.entries(OPERATORS)) {
        await setOperator(page, opId);
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
        const header = page.locator("header");
        if (await header.isVisible()) {
          await header.screenshot({
            path: path.join(OUT_DIR, `appshell-header-${key}-${width}.png`),
          });
        }
      }

      // 11. /dev/ui primitives showcase
      await page.goto(`${BASE_URL}/dev/ui`, { waitUntil: "networkidle" });
      await capture(page, `primitives-showcase-${width}.png`, { copyToDocs: width === 1440 });

      await context.close();
    }

    console.log("\n=== Quality Checks Summary ===");
    console.log(`Console Errors recorded: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.warn("Console Errors:", consoleErrors);
    }
  } finally {
    await browser.close();
    server.kill();
    console.log("Server stopped. After capture completed.");
  }
}

main().catch((err) => {
  console.error("After capture failed:", err);
  process.exit(1);
});
