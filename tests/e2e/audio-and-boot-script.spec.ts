import { test, expect } from "@playwright/test";

test.describe("Runtime Error Validations (Boot Script & Audio Toggle Hydration)", () => {
  test("home page loads with zero hydration or script tag errors in browser console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Verify boot script rendered into head by next/script
    const bootScript = page.locator('head script#prefs-boot, head script[data-nscript="beforeInteractive"]');
    await expect(bootScript.first()).toBeAttached();

    // Verify no script tag error or hydration mismatch occurred
    const relevantErrors = consoleErrors.filter(
      (err) =>
        err.includes("Encountered a script tag") ||
        err.includes("Hydration failed") ||
        err.includes("did not match") ||
        err.includes("server rendered HTML didn't match"),
    );
    expect(relevantErrors).toEqual([]);
  });

  test("audio toggle switches state, persists to localStorage, and reloads without hydration mismatch", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    const audioToggle = page.getByRole("button", { name: /audio effects/i });
    await expect(audioToggle).toBeVisible();

    // Initial state: muted
    await expect(audioToggle).toHaveAttribute("aria-pressed", "false");
    await expect(audioToggle).toHaveAttribute("aria-label", "Enable audio effects");
    await expect(audioToggle).toContainText("AUDIO: MUTED");

    // Click toggle to enable audio
    await audioToggle.click();

    // Updated state: enabled
    await expect(audioToggle).toHaveAttribute("aria-pressed", "true");
    await expect(audioToggle).toHaveAttribute("aria-label", "Disable audio effects");
    await expect(audioToggle).toContainText("AUDIO: ON");

    // Check localStorage persistence
    const savedAudio = await page.evaluate(() => localStorage.getItem("cyberblade_audio"));
    expect(savedAudio).toBe("true");

    // Reload the page with cyberblade_audio="true" stored in localStorage
    await page.reload();

    // Audio toggle should cleanly reflect enabled state after mount
    const audioToggleAfterReload = page.getByRole("button", { name: /audio effects/i });
    await expect(audioToggleAfterReload).toBeVisible();
    await expect(audioToggleAfterReload).toHaveAttribute("aria-pressed", "true");
    await expect(audioToggleAfterReload).toHaveAttribute("aria-label", "Disable audio effects");
    await expect(audioToggleAfterReload).toContainText("AUDIO: ON");

    // Click again to mute
    await audioToggleAfterReload.click();
    await expect(audioToggleAfterReload).toHaveAttribute("aria-pressed", "false");
    await expect(audioToggleAfterReload).toHaveAttribute("aria-label", "Enable audio effects");
    await expect(audioToggleAfterReload).toContainText("AUDIO: MUTED");

    const savedAudioAfterMute = await page.evaluate(() => localStorage.getItem("cyberblade_audio"));
    expect(savedAudioAfterMute).toBe("false");

    // Confirm absolutely zero hydration errors occurred during reload with persisted preference
    const hydrationErrors = consoleErrors.filter(
      (err) =>
        err.includes("Hydration failed") ||
        err.includes("did not match") ||
        err.includes("server rendered HTML didn't match"),
    );
    expect(hydrationErrors).toEqual([]);
  });
});
