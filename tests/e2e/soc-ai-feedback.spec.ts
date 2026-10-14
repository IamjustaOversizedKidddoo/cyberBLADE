import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { onboard } from "./helpers/rank0";
import { submitReport } from "./helpers/soc-report";

// Server runs SOC_AI_GRADING_MODE=preview with the deterministic local mock (playwright.config.ts).

test.describe("SOC AI writing feedback (preview mode, mock model)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/start");
    await onboard(page, `soc_ai_${Date.now() % 1_000_000}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("shows preview feedback, verified evidence, review request and consent, and passes axe", async ({ page }, info) => {
    if (info.project.name === "chromium-mobile") await page.setViewportSize({ width: 390, height: 844 });
    await submitReport(page);

    const section = page.getByRole("region", { name: /Writing feedback/i });
    await expect(section).toBeVisible();
    await expect(section.getByText(/Preview: does not change your score/i)).toBeVisible();
    await expect(section.getByText(/· not yet calibrated/)).toBeVisible();

    // Async grading finishes (worker runs via after()); no criterion stays pending.
    await expect(section.getByText(/^Pending$/)).toHaveCount(0, { timeout: 30_000 });
    await expect(section.getByText(/^Preview$/).first()).toBeVisible();
    await expect(section.getByText(/Does not count/).first()).toBeVisible();

    // Evidence quotes are highlighted inside the learner's own text.
    const showEvidence = section.getByRole("button", { name: /Show the .*based on/ }).first();
    await showEvidence.click();
    await expect(section.getByRole("button", { name: /Hide the .*based on/ }).first()).toHaveAttribute("aria-expanded", "true");
    await expect(section.locator("mark").first()).toBeVisible();

    // Transparency panel.
    await section.getByText("How AI feedback works").click();
    await expect(section.getByText(/What the AI never sees/i)).toBeVisible();
    await expect(section.getByText(/Not yet calibrated against human graders/i)).toBeVisible();

    // Axe on the full results view with the panel open.
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".neon-glitch-copy").analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toHaveLength(0);

    // No horizontal scroll at this width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // ...and the section itself sits inside the viewport (inner scroll panes can overflow too).
    const box = await section.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);

    // One human-review request per submission.
    const reviewBtn = section.getByRole("button", { name: "Request human review" });
    await reviewBtn.click();
    await expect(section.getByText(/Human review requested\. A reviewer/)).toBeVisible();
    await expect(section.getByRole("button", { name: "Human review requested" })).toBeDisabled();

    // Calibration consent: off by default, keyboard-toggleable.
    const consent = section.getByLabel("Help check the AI against human graders");
    await expect(consent).not.toBeChecked();
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    await expect(section.getByText(/You can turn this off at any time/)).toBeVisible();
  });
});
