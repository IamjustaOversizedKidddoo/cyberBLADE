import { expect, test } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { onboard } from "./helpers/rank0";

test.describe("Phase 2E — Exam Readiness Engine & Gamification", () => {
  test("dashboard displays operational streak, cert readiness matrix, and badges wall", async ({ page }) => {
    await onboard(page);

    // Dashboard should be active
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "RANK_0", exact: true })).toBeVisible();

    // 1. Verify Operational Streak widget initial state (standby prior to activity)
    await expect(page.getByText("OPERATIONAL STREAK", { exact: true })).toBeVisible();
    await expect(page.getByText("STANDBY", { exact: true })).toBeVisible();

    // 2. Verify Certification Readiness section
    const readinessHeading = page.getByRole("heading", { name: "certification_readiness" });
    await expect(readinessHeading).toBeVisible();
    await expect(page.getByText(/6 CERTIFICATIONS TRACKED/i)).toBeVisible();

    // Check specific certification cards
    await expect(page.getByText("CompTIA Security+")).toBeVisible();
    await expect(page.getByText("CompTIA Network+")).toBeVisible();
    await expect(page.getByText("CompTIA Linux+")).toBeVisible();
    await expect(page.getByText("ISC2 Certified in Cybersecurity")).toBeVisible();

    // Expand objective matrix details on the first card
    const viewMatrixBtn = page.getByRole("button", { name: "[View matrix]" }).first();
    await viewMatrixBtn.click();
    await expect(page.getByText(/Objective Audit Breakdown:/i)).toBeVisible();
    await page.keyboard.press("Escape");

    // 3. Verify Operational Badges wall initial state
    const badgesHeading = page.getByRole("heading", { name: "operational_badges" });
    await expect(badgesHeading).toBeVisible();
    await expect(page.getByText("Initiate Clearance")).toBeVisible();
    await expect(page.getByText("CLR-00")).toBeVisible();
    await expect(page.getByText(/✓ CLEARED/i).first()).toBeVisible();

    // 4. Complete a lesson check to activate daily operational streak and First Blood badge
    await page.goto("/learn/core-r0-comp-hardware-01");
    await answerAllChecks(page);

    // 5. Return to dashboard and verify streak activation and updated telemetry
    await page.goto("/dashboard");
    await expect(page.getByText("ACTIVE TODAY", { exact: true })).toBeVisible();
    await expect(page.getByText("DAY IN A ROW", { exact: true })).toBeVisible();
    await expect(page.getByText("First Blood")).toBeVisible();
  });
});
