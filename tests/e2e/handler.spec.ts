import { expect, test } from "@playwright/test";
import { onboard } from "./helpers/rank0";

test.describe("The Handler — Socratic AI Tutor", () => {
  test("operator can engage The Handler in a lesson for Socratic guidance", async ({ page }) => {
    await onboard(page);

    // Navigate to Lesson 1: core-r0-comp-hardware-01
    await page.goto("/learn/core-r0-comp-hardware-01");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Verify The Handler floating HUD button is present
    const handlerBtn = page.getByRole("button", { name: /THE HANDLER/i });
    await expect(handlerBtn).toBeVisible();

    // Open the drawer
    await handlerBtn.click();
    const drawer = page.locator("#handler-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("THE HANDLER", { exact: true })).toBeVisible();
    await expect(drawer.getByText("[ONLINE]")).toBeVisible();

    // Click "Simplify" chip
    const simplifyChip = drawer.getByRole("button", { name: "Simplify" });
    await expect(simplifyChip).toBeVisible();
    await simplifyChip.click();

    // Verify response from Handler appears
    await expect(drawer.getByText(/In Plain English \(No Jargon\)/i)).toBeVisible({ timeout: 10_000 });

    // Send a custom question via the input
    const input = drawer.getByPlaceholder(/Ask Handler/i);
    await input.fill("diagram");
    await drawer.getByRole("button", { name: "TRANSMIT" }).click();

    // Verify ASCII diagram response appears
    await expect(drawer.getByText(/Architecture Flow \/\/ ASCII Diagram/i)).toBeVisible({ timeout: 10_000 });

    // Close the drawer with close button
    await drawer.getByRole("button", { name: /Close Handler Panel/i }).click();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
  });

  test("operator can request progressive hints in a lab", async ({ page }) => {
    await onboard(page);

    // Open a Rank 0 lab
    await page.goto("/labs/core-r0-files-lab-01");
    await expect(page.getByRole("heading", { name: "objectives" })).toBeVisible();

    // Verify the first objective has a Request Hint button
    const firstObjective = page.locator("#objectives-heading ~ ol > li").first();
    const hintBtn = firstObjective.getByRole("button", { name: /Request Hint/i });
    await expect(hintBtn).toBeVisible();

    // Click to request Tier 1 hint
    await hintBtn.click();

    // Verify Tier 1 hint is displayed
    await expect(firstObjective.getByText(/HINT \/\/ TIER 1/i)).toBeVisible({ timeout: 5_000 });

    // Open Handler drawer in lab to confirm lab context
    const handlerBtn = page.getByRole("button", { name: /THE HANDLER/i });
    await handlerBtn.click();
    const drawer = page.locator("#handler-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/TARGET: Who Can Read What\?/i)).toBeVisible();
  });
});
