import { expect, test } from "@playwright/test";
import { onboard } from "./helpers/rank0";

test.describe("certificates: earn → view → verify → revoked lifecycle", () => {
  test("full lifecycle: earn capstone, claim with display name, verify publicly, and handle revocation", async ({
    page,
  }) => {
    // 1. Onboard as fresh learner
    const handle = `cert_user_${Date.now() % 100000}`;
    await onboard(page, handle);

    // 2. Visit /certificates before earning any credentials
    await page.goto("/certificates");
    await expect(page.getByRole("heading", { name: "Certificates of Completion" })).toBeVisible();
    await expect(page.getByText("No Certificates Issued Yet")).toBeVisible();

    // 3. Complete capstone challenge 0 via server fixture
    const earnRes = await page.evaluate(async () => {
      const res = await fetch("/api/e2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pass-challenge", rank: 0 }),
      });
      return res.json();
    });
    expect(earnRes).toEqual({ ok: true, challengePassed: 0 });

    // 4. Reload /certificates: eligible banner should appear
    await page.reload();
    await expect(page.getByText("New Credential Eligible for Issuance!")).toBeVisible();

    // Open claim modal and enter custom recipient display name
    const claimBtn = page.getByRole("button", { name: /Claim.*Operator.*Certificate/i }).first();
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();

    const nameInput = page.getByLabel("Recipient Display Name");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Agent Sterling");

    await page.getByRole("button", { name: "Issue Certificate" }).click();

    // 5. Verify certificate appears in Issued Credentials
    await expect(page.getByText("Issued Credentials (1)")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Agent Sterling")).toBeVisible();
    await expect(page.getByText("Classification: Operator")).toBeVisible();

    // Verify presence of export, share, and QR elements
    await expect(page.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PNG" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add to LinkedIn" })).toBeVisible();
    await expect(page.locator("#cyberblade-certificate-chassis svg.certificate-svg-art, #cyberblade-certificate-chassis [aria-label='Verification QR code']")).toBeVisible();

    // Extract credential ID (format: cbl_<32 hex chars>)
    const credentialIdElem = page.locator("#cyberblade-certificate-chassis p.font-mono.select-all").first();
    const credentialId = (await credentialIdElem.textContent())?.trim();
    expect(credentialId).toMatch(/^cbl_[0-9a-f]{32}$/);

    // 6. Public verification page (/verify/[credentialId])
    await page.goto(`/verify/${credentialId}`);
    await expect(page).toHaveTitle(/Verify Certificate of Completion/i);

    // Check noindex meta tag for beta environment
    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute("content", "noindex, nofollow");

    // Check verified status and recipient information
    await expect(page.getByText(/REGISTRY STATUS: VERIFIED AUTHENTIC/i)).toBeVisible();
    await expect(page.getByText("Agent Sterling").first()).toBeVisible();
    await expect(page.getByText(/Shared Core/i).first()).toBeVisible();

    // 7. Revoke certificate via admin fixture and check revoked state
    const revokeRes = await page.evaluate(async (slug) => {
      const res = await fetch("/api/e2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke-certificate",
          credentialId: slug,
          reason: "Honor code violation in automated testing",
        }),
      });
      return res.json();
    }, credentialId);
    expect(revokeRes).toEqual({ ok: true, revoked: true });

    // Reload public verify page to observe revoked state
    await page.reload();
    await expect(page.getByText(/REGISTRY STATUS: REVOKED/i)).toBeVisible();
    await expect(page.getByText(/STATUS: CREDENTIAL REVOKED/i)).toBeVisible();
    await expect(page.getByText(/Honor code violation/i)).toBeVisible();
  });
});
