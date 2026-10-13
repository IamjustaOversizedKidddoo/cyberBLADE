import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";

test.describe("SOC Enrichment & Evidence Workbench (E2E & Accessibility)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `soc_analyst_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("opens enrichment workbench, executes lookups across tools, verifies zero external leaks, and passes axe check", async ({ page }) => {
    const outboundExternalRequests: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) {
        outboundExternalRequests.push(url);
      }
    });

    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify workspace rendered
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });

    // 2. Select first alert
    const firstRow = page.locator('[data-testid^="alert-row-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // 3. Open Enrichment Drawer via Quick Pivot or Investigate Button
    const investigateBtn = page.getByRole("button", { name: /Investigate/i }).first();
    if (await investigateBtn.isVisible()) {
      await investigateBtn.click();
    } else {
      // Open via Tools button in header
      const toolsBtn = page.getByRole("button", { name: /Tools/i });
      await toolsBtn.click();
    }

    // 4. Verify Investigation Workbench opened
    await expect(page.getByText("INVESTIGATION WORKBENCH")).toBeVisible({ timeout: 10_000 });

    // 5. Run Automated Axe WCAG 2.2 AA Accessibility Check on workbench
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".neon-glitch-copy")
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousOrCritical,
      `Enrichment Workbench has serious/critical axe violations: ${JSON.stringify(
        seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
        null,
        2,
      )}`,
    ).toHaveLength(0);

    // 6. Test Global Lookup Box with auto-detection
    const lookupInput = page.getByPlaceholder(/Enter indicator/i);
    await lookupInput.fill("198.51.100.24");

    const queryBtn = page.getByRole("button", { name: /Query Intel/i });
    await queryBtn.click();

    // Wait for reputation result to appear
    await expect(page.getByText(/198\[\.\]51\[\.\]100\[\.\]24/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Threat Intelligence Sources")).toBeVisible();

    // 7. Switch Tool Tabs: WHOIS / Registration
    const whoisTab = page.getByRole("button", { name: /WHOIS/i });
    await whoisTab.click();
    await expect(page.getByText(/WHOIS & Registration Records/i)).toBeVisible();

    // 8. Switch Tool Tabs: Passive DNS
    const pdnsTab = page.getByRole("button", { name: /pDNS/i });
    await pdnsTab.click();
    await expect(page.getByText(/Passive DNS Historical Resolutions/i)).toBeVisible();

    // 9. Switch Tool Tabs: Endpoint Timeline
    const epTab = page.getByRole("button", { name: /Endpoint/i });
    await epTab.click();
    await expect(page.getByText(/Endpoint Process Tree & Telemetry Timeline/i)).toBeVisible();

    // 10. Verify absolute zero external network requests
    expect(outboundExternalRequests).toHaveLength(0);
  });

  test("mobile bottom sheet displays tools cleanly at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    const firstRow = page.locator('[data-testid^="alert-row-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Open tools
    const toolsBtn = page.getByRole("button", { name: /Tools/i });
    await toolsBtn.click();

    await expect(page.getByText("INVESTIGATION WORKBENCH")).toBeVisible();
    const closeBtn = page.getByLabel("Close investigation workbench");
    await closeBtn.click();
    await expect(page.getByText("INVESTIGATION WORKBENCH")).not.toBeVisible();
  });
});
