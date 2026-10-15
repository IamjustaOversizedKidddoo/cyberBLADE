import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { onboard } from "./helpers/rank0";

test.describe("SOC Enrichment & Evidence Workbench (E2E & Accessibility)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/start");
    // Random suffix: Date.now()-based handles collided when both projects started in the same ms.
    await onboard(page, `soc_${randomUUID().replace(/-/g, "").slice(0, 12)}`);
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

    // 3. Open the workbench with the header launcher. `.first()` on /Investigate/ used to match
    // either the header launcher or the alert panel's button (which runs its own lookup), so which
    // result rendered last depended on timing; the isVisible() branch did not wait at all.
    await page.getByTitle("Open Investigation Workbench (i)").click();

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
    const lookupInput = page.getByLabel("Indicator to investigate");
    await lookupInput.fill("198.51.100.24");

    const queryBtn = page
      .getByRole("dialog", { name: /Investigation Workbench/i })
      .getByRole("button", { name: /^Investigate$/i });
    await queryBtn.click();

    // Wait for reputation result to appear
    await expect(page.getByText(/198\[\.\]51\[\.\]100\[\.\]24/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Threat Intelligence Sources")).toBeVisible();

    // 7. Switch Tool Tabs: WHOIS / Registration
    const whoisTab = page.getByRole("button", { name: /WHOIS/i });
    await whoisTab.click();
    await expect(page.getByText(/Registration Record/i).first()).toBeVisible();

    // 8. Switch Tool Tabs: Passive DNS
    const pdnsTab = page.getByRole("button", { name: /pDNS/i });
    await pdnsTab.click();
    await expect(page.getByText(/Passive DNS Resolution History|No Historical DNS Resolutions Found/i).first()).toBeVisible();

    // 9. Switch Tool Tabs: Endpoint Timeline
    const epTab = page.getByRole("button", { name: /Endpoint/i });
    await epTab.click();
    await expect(page.getByText(/EDR Endpoint Forensics|No Endpoint/i).first()).toBeVisible();

    // 10. Verify absolute zero external network requests
    expect(outboundExternalRequests).toHaveLength(0);
  });

  test("mobile bottom sheet displays tools cleanly at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");
    // Wait for the session to start (same signal and budget as the first test); the alert row
    // used to be awaited with the 5 s default while the session-start action was still running.
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });

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
