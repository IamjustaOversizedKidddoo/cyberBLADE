import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";

test.describe("SOC Tier-1 Workspace Engine (E2E & Accessibility)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `soc_analyst_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("loads SOC workspace, navigates alerts, records decision, and passes axe check", async ({ page }) => {
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify workspace rendered
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("L1 Shift: A Noisy Morning Shift at Apex Dynamics")).toBeVisible();
    await expect(page.getByText(/48 Total/i)).toBeVisible();

    // 2. Automated Axe WCAG 2.2 AA Accessibility Check
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".neon-glitch-copy")
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousOrCritical,
      `SOC Workspace has serious/critical axe violations: ${JSON.stringify(
        seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
        null,
        2,
      )}`,
    ).toHaveLength(0);

    // 3. Test keyboard shortcuts modal via '?' button
    const helpBtn = page.getByRole("button", { name: "?" });
    await helpBtn.click();
    await expect(page.getByText("Keyboard Navigation Shortcuts")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Keyboard Navigation Shortcuts")).not.toBeVisible();

    // 4. Select the first alert from queue and inspect details
    const firstRow = page.locator('[data-testid^="alert-row-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Verify CMDB asset profile loaded
    await expect(page.getByText("CMDB Asset Profile")).toBeVisible();

    // 5. Assign Triage Decision
    const fpBtn = page.getByRole("button", { name: /^False Positive/i });
    await fpBtn.click();

    const rationaleInput = page.getByPlaceholder(/State: WHAT occurred/i);
    await rationaleInput.fill("Automated service account activity verified against scheduled backup window.");

    const saveBtn = page.getByRole("button", { name: /Save Decision/i });
    await saveBtn.click();
    await expect(page.getByText("Triaged ✓")).toBeVisible({ timeout: 10_000 });

    // 6. Case Creation
    // In mobile view (390px), panel 3 is under the Cases tab
    const casesTab = page.getByRole("button", { name: /Cases/i });
    if (await casesTab.isVisible()) {
      await casesTab.click();
    }

    const newCaseBtn = page.getByRole("button", { name: /\+ New Case/i });
    await newCaseBtn.click();

    const caseTitleInput = page.getByPlaceholder(/Case title/i);
    await caseTitleInput.fill("Incident Alpha: Financial Phishing Campaign");

    const createCaseBtn = page.getByRole("button", { name: "Create" });
    await createCaseBtn.click();

    await expect(page.getByRole("combobox", { name: "Active Case Selection" })).toContainText("Incident Alpha");

    // 7. Conclude Shift and Verify Scorecard
    const submitShiftBtn = page.getByRole("button", { name: /Submit Shift/i });
    await submitShiftBtn.click();

    await expect(page.getByText("Submit Shift Evaluation?")).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: /Confirm & Conclude Shift/i });
    await confirmBtn.click();

    // Results modal
    await expect(page.getByText("SHIFT DEBRIEF & SCORECARD")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Assessed Competencies")).toBeVisible();
  });

  test("mobile viewport (390px) supports tab navigation with preserved state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });

    // Verify mobile tabs exist
    const queueTab = page.getByRole("button", { name: /Queue \(48\)/i });
    const alertTab = page.getByRole("button", { name: /Alert/i });
    const casesTab = page.getByRole("button", { name: /Cases/i });

    await expect(queueTab).toBeVisible();
    await expect(alertTab).toBeVisible();
    await expect(casesTab).toBeVisible();

    // Switch to Cases tab
    await casesTab.click();
    await expect(page.getByText(/Case Investigations/i)).toBeVisible();

    // Switch to Alert tab
    await alertTab.click();
    await expect(page.getByText("CMDB Asset Profile")).toBeVisible();
  });

  test("starts a shift profile from UI, plays a slice, refreshes/resumes, and checks axe compliance", async ({ page }) => {
    await page.goto("/labs/soc/shift-quiet-day");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify shift workspace rendered with dynamic variant
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Quiet Day Shift/i)).toBeVisible();

    // 2. Select first alert
    const firstRow = page.locator('[data-testid^="alert-row-"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // 3. Make a decision
    const btpBtn = page.getByRole("button", { name: /^Benign True Positive/i });
    if (await btpBtn.isVisible()) {
      await btpBtn.click();
    } else {
      await page.getByRole("button", { name: /^False Positive/i }).click();
    }
    await page.getByPlaceholder(/State: WHAT occurred/i).fill("Verified baseline routine operational activity.");
    await page.getByRole("button", { name: /Save Decision/i }).click();
    await expect(page.getByText("Triaged ✓")).toBeVisible({ timeout: 10_000 });

    // 4. Refresh / Resume test: ensure session and decision persist
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("SOC//WORKSPACE")).toBeVisible({ timeout: 15_000 });
    // Persistence check: on mobile the decision form sits on a non-active tab after reload, so assert presence.
    await expect(page.getByText("Triaged ✓")).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, 0));

    // 5. Axe WCAG 2.2 AA Accessibility Check
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".neon-glitch-copy")
      .analyze();
    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(seriousOrCritical).toHaveLength(0);
  });
});
