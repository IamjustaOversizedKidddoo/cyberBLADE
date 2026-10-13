import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";

const ARTIFACT_DIR = "C:/Users/gone0/.gemini/antigravity-ide/brain/38f7ad68-40fc-481c-9e93-aeecccf25ad7";

test.describe("BladeQL Investigation Query Language & Log Search (E2E & Accessibility)", () => {
  test.beforeEach(async ({ page }) => {
    // Unique operator handle under 20 characters
    await onboard(page, `bql_${Date.now() % 1_000_000}`);
  });

  test("navigates to Log Search tab, executes queries, tests field sidebar, table interactions, CSV export, questions, and passes axe check", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop multi-pane layout test; mobile layout tested in dedicated mobile suite");
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify workspace rendered and switch to Log Search
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });

    const searchTabBtn = page.getByRole("button", { name: /Log Search/i });
    await expect(searchTabBtn).toBeVisible();
    await searchTabBtn.click();

    // Verify BladeQL Hunting Engine is mounted
    await expect(page.getByText("BladeQL Hunting Engine")).toBeVisible({ timeout: 10_000 });

    // Capture Desktop 1440px Screenshot
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "soc-search-desktop-1440.png"),
    });

    // 2. Automated Axe WCAG 2.2 AA Accessibility Check on initial search view
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".neon-glitch-copy")
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousOrCritical,
      `BladeQL Log Search Tab has serious/critical axe violations: ${JSON.stringify(
        seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
        null,
        2,
      )}`,
    ).toHaveLength(0);

    // 3. Inspect Editor & Execute Query via Search Button
    const editorTextarea = page.getByLabel("BladeQL Investigation Query Monospace Editor");
    await expect(editorTextarea).toBeVisible();

    // Run custom query
    await editorTextarea.fill('source="endpoint" | head 12');
    const searchBtn = page.getByRole("button", { name: "Search", exact: true });
    await searchBtn.click();

    // Verify results table updated
    await expect(page.getByText("12 results")).toBeVisible({ timeout: 10_000 });

    // 4. Test Keyboard Shortcut execution (Control+Enter)
    await editorTextarea.fill('source="firewall" | head 8');
    await editorTextarea.press("Control+Enter");

    await expect(page.getByText("8 results")).toBeVisible({ timeout: 10_000 });

    // 5. Test Field Sidebar Filter Insertion
    const fieldBtn = page.getByRole("button", { name: /^action\s/i }).first();
    if (await fieldBtn.isVisible()) {
      await fieldBtn.click();
      // Add filter via '+' button in the expanded field details
      const addFilterBtn = page.getByTitle("Add filter (match)").first();
      if (await addFilterBtn.isVisible()) {
        await addFilterBtn.click();
        // Check that query now contains where action=
        const updatedVal = await editorTextarea.inputValue();
        expect(updatedVal).toContain('action="');
      }
    }

    // 6. Test Results Table Interaction: Row Expansion & Raw View
    const firstRowCell = page.locator("tbody tr td").nth(1);
    await expect(firstRowCell).toBeVisible();
    await firstRowCell.click();

    // Verify expanded row details drawer appears
    await expect(page.getByText(/Event ID:/i)).toBeVisible({ timeout: 5_000 });

    // 7. Test Safe CSV Export
    const downloadPromise = page.waitForEvent("download");
    const exportCsvBtn = page.getByRole("button", { name: /Export CSV/i });
    await expect(exportCsvBtn).toBeEnabled();
    await exportCsvBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".csv");

    // 8. Test Explain Query Modal
    const explainBtn = page.getByRole("button", { name: "Explain", exact: true });
    await explainBtn.click();
    await expect(page.getByText("BladeQL Reference & Guidance")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Deterministic step-by-step breakdown")).toBeVisible();

    // Capture Explain Modal Screenshot
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "soc-search-explain-1440.png"),
    });

    // Close modal via Close button
    const closeBtn = page.locator('[role="dialog"]').getByRole("button", { name: "✕", exact: true });
    await closeBtn.click();
    await expect(page.getByText("BladeQL Reference & Guidance")).not.toBeVisible();

    // 9. Test Investigation Objectives Drawer
    await expect(page.getByText("INVESTIGATION OBJECTIVES")).toBeVisible();
    const submitBtn = page.getByRole("button", { name: /Submit Answer/i }).first();
    await expect(submitBtn).toBeVisible();

    // 10. Tablet Viewport Screenshot (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "soc-search-tablet-768.png"),
    });
  });

  test("mobile view at 390px allows switching between results, fields, and questions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    // Mobile tabs switch to Search
    const searchMobileTab = page.getByRole("button", { name: "Search", exact: true });
    await expect(searchMobileTab).toBeVisible();
    await searchMobileTab.click();

    // Verify search editor mounts
    await expect(page.getByLabel("BladeQL Investigation Query Monospace Editor")).toBeVisible({ timeout: 10_000 });

    // Capture Mobile 390px Screenshot
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "soc-search-mobile-390.png"),
    });

    // Switch mobile subtabs: Fields
    const fieldsSubTab = page.getByRole("button", { name: /Fields/i });
    await fieldsSubTab.click();
    await expect(page.getByText(/available/i)).toBeVisible();

    // Switch mobile subtabs: Questions
    const questionsSubTab = page.getByRole("button", { name: /Questions/i });
    await questionsSubTab.click();
    await expect(page.getByText("INVESTIGATION OBJECTIVES")).toBeVisible();

    // Switch back to Results
    const resultsSubTab = page.getByRole("button", { name: /Results/i });
    await resultsSubTab.click();
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeVisible();
  });
});
