import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";

test.describe("SOC Incident Report System (E2E & Accessibility)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `soc_reporter_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("drafts an incident report, lints, submits, and views scorecard & model comparison", async ({
    page,
  }) => {
    await page.goto("/labs/soc/soc-l1-noisy-shift");
    await page.waitForLoadState("domcontentloaded");

    // 1. Switch to Incident Report tab
    const reportTab = page.getByRole("button", { name: /Incident Report/i }).first();
    await expect(reportTab).toBeVisible({ timeout: 15_000 });
    await reportTab.click();

    // 2. Verify editor components rendered
    await expect(page.getByText(/Incident Report Editor/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Executive Summary/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Indicators of Compromise/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Timeline/i })).toBeVisible();

    // 3. Axe Accessibility Verification on Report Workspace
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".neon-glitch-copy")
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      seriousOrCritical,
      `Report workspace has serious/critical axe violations: ${JSON.stringify(
        seriousOrCritical.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
        null,
        2,
      )}`,
    ).toHaveLength(0);

    // 4. Fill Executive Summary
    const execSummaryInput = page.getByPlaceholder(/High-level synthesis for management/i);
    await execSummaryInput.fill(
      "During normal morning operations, multiple suspicious PowerShell download cradles and beaconing connections were observed originating from finance workstation ws-fin-01 toward known external C2 infrastructure.",
    );

    // 4b. Fill Verdict Justification
    const justificationInput = page.getByPlaceholder(/Explain why this disposition/i);
    await justificationInput.fill(
      "Confirmed malicious beaconing and unauthorized PowerShell cradle execution observed directly in sysmon telemetry.",
    );

    // 4c. Fill Scope & Affected Entities
    const assetsInput = page.getByPlaceholder(/ws-fin-01/i);
    await assetsInput.fill("ws-fin-01.corp.internal");

    // 5. Add an Indicator of Compromise
    const iocInput = page.getByPlaceholder(/Enter indicator/i);
    await iocInput.fill("198.51.100.24");
    const addIocBtn = page.getByRole("button", { name: /\+ Add Indicator/i });
    await addIocBtn.click();
    const indicatorValueInput = page.getByRole("textbox", { name: "Indicator Value", exact: true });
    await expect(indicatorValueInput).toHaveValue(/198.*51.*100.*24/);

    // Test defanged state
    await expect(indicatorValueInput).toHaveValue(/198\[\.\]51\[\.\]100\[\.\]24/);

    // 6. Add Timeline Events (2 required)
    const timelineDescInput = page.getByPlaceholder(/Describe adversary behavior/i);
    await timelineDescInput.fill("Initial encoded PowerShell execution observed on ws-fin-01.");
    const addEventBtn = page.getByRole("button", { name: /\+ Add Event/i });
    await addEventBtn.click();
    await expect(page.getByText("Initial encoded PowerShell execution observed on ws-fin-01.")).toBeVisible();

    await timelineDescInput.fill("Outbound HTTP beaconing traffic detected toward external C2 server.");
    await addEventBtn.click();
    await expect(page.getByText("Outbound HTTP beaconing traffic detected toward external C2 server.")).toBeVisible();

    // 6b. Fill Attack Narrative
    const narrativeInput = page.getByPlaceholder(/Chronological narrative of adversary actions/i);
    await narrativeInput.fill(
      "The adversary delivered an encoded PowerShell payload via email attachment to ws-fin-01. Upon execution, the payload established persistent scheduled tasks and initiated outbound beaconing to 198.51.100[.]24.",
    );

    // 6c. Fill Escalation Handoff Summary
    const handoffInput = page.getByPlaceholder(/Specific instructions and containment/i);
    await handoffInput.fill(
      "Please perform host memory dump and disk imaging on ws-fin-01, and block outbound traffic to 198.51.100[.]24 immediately.",
    );

    // 7. Open Pre-Submit Lint Modal
    const reviewSubmitBtn = page.getByRole("button", { name: /Pre-Submit Audit|Review & Submit/i });
    await expect(reviewSubmitBtn).toBeVisible();
    await reviewSubmitBtn.click();

    // Verify Lint Modal is visible
    await expect(page.getByText("Pre-Submission Audit")).toBeVisible();
    await expect(page.getByText("Irreversible One-Shot Policy")).toBeVisible();

    // 8. Submit Report
    const confirmSubmitBtn = page.getByRole("button", { name: /Submit Incident Report/i });
    await expect(confirmSubmitBtn).toBeEnabled();
    await confirmSubmitBtn.click();

    // 9. Verify Scorecard loaded
    await expect(page.getByText("Authoritative Evaluation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Rubric Criteria Performance")).toBeVisible();

    // 10. Compare with Model Report
    const compareBtn = page.getByRole("button", { name: /Compare with Model Report/i }).first();
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    await expect(page.getByText("Model Report Comparative Review")).toBeVisible();
    await expect(page.getByText("Your Submission")).toBeVisible();

    // Return to scorecard
    const backBtn = page.getByRole("button", { name: /Back to Scorecard/i });
    await backBtn.click();
    await expect(page.getByText("Authoritative Evaluation")).toBeVisible();
  });
});
