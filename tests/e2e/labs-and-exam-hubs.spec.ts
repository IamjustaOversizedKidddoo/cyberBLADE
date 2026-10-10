import { test, expect } from "@playwright/test";
import { promoteToRank, submitObjective } from "./helpers/rank0";

test.describe("Tactical Labs Range and Exam Readiness Hubs", () => {
  test("operator can navigate between Dashboard, Labs Range, and Exam Readiness", async ({ page }) => {
    // 1. Sign up a fresh operator
    await page.goto("/start");
    await page.getByLabel("Choose your operator handle").fill(`nav_${Date.now() % 1_000_000}`);
    await page.getByLabel("I have read and agree to the ethical use agreement").check();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    // 2. Verify top navigation links are present in AppShell
    await expect(page.getByRole("link", { name: "[DASHBOARD]" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "[CURRICULUM]" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "[LABS]" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "[EXAM PREP]" }).first()).toBeVisible();

    // 3. Navigate to /labs
    await page.getByRole("link", { name: "[LABS]" }).first().click();
    await expect(page).toHaveURL(/\/labs$/);
    await expect(page.getByRole("heading", { name: /tactical_labs_range/i })).toBeVisible();

    // Filter by SIEM lab type
    await page.getByRole("button", { name: "Filter lab type: SIEM" }).click();
    await expect(page.getByText("SIEM Triage: Brute Force & Persistence Investigation")).toBeVisible();

    // Filter by ALL
    await page.getByRole("button", { name: "Filter lab type: ALL" }).click();
    await expect(page.getByText("First Terminal")).toBeVisible();

    // 4. Navigate to /exam
    await page.getByRole("link", { name: "[EXAM PREP]" }).first().click();
    await expect(page).toHaveURL(/\/exam$/);
    await expect(page.getByRole("heading", { name: /exam_readiness_engine/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CompTIA Security+" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CompTIA Network+" })).toBeVisible();

    // Expand an objective audit matrix
    const viewMatrixBtn = page.getByRole("button", { name: "[View matrix]" }).first();
    await viewMatrixBtn.click();
    await expect(page.getByText("Objective Audit Breakdown:")).toBeVisible();

    // 5. Navigate back to /dashboard
    await page.getByRole("link", { name: "[DASHBOARD]" }).first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("operator promotes to Rank 1, launches SIEM lab, inspects events, and solves objectives", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "desktop journey");
    test.setTimeout(180_000);

    // Promote to Rank 1 to access the SIEM lab
    await promoteToRank(page, 1);

    await page.goto("/labs/core-r1-siem-log-analysis-01");
    await expect(page.getByRole("heading", { name: "SIEM Triage: Brute Force & Persistence Investigation" })).toBeVisible();

    // Verify SIEM console loaded
    await expect(page.getByRole("heading", { name: /Operation Phantom Probe/i })).toBeVisible();
    const searchInput = page.getByPlaceholder(/Search events/);
    await expect(searchInput).toBeVisible();

    // Verify search query filters rows
    await searchInput.fill("4625");
    await expect(page.getByText(/4625/).first()).toBeVisible();

    // Search for 7045 service creation event to inspect the backdoor token
    await searchInput.fill("7045");
    await page.getByRole("row", { name: /7045/ }).first().click();

    // Verify Event Inspector drawer opened
    await expect(page.getByText(/EVENT DETAILS \/\//)).toBeVisible();
    await expect(page.getByText("RAW LOG STRING:")).toBeVisible();

    const flagElement = page.getByText(/FLAG\{siem_ir_[0-9a-f]{8}\}/).first();
    await expect(flagElement).toBeVisible();
    const rawLogText = await flagElement.textContent();
    expect(rawLogText).not.toBeNull();
    const flagMatch = rawLogText!.match(/FLAG\{siem_ir_[0-9a-f]{8}\}/);
    expect(flagMatch).not.toBeNull();
    const flag = flagMatch![0];

    // Submit Objective 5 with the extracted flag
    await submitObjective(page, 4, flag);
  });
});
