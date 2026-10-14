import { expect, type Page } from "@playwright/test";

/** Fills a reasonable incident report on the static noisy-shift scenario and submits it. */
export async function submitReport(page: Page) {
  await page.goto("/labs/soc/soc-l1-noisy-shift");
  await page.getByRole("button", { name: /Incident Report/i }).first().click();
  await expect(page.getByText(/Incident Report Editor/i)).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder(/High-level synthesis for management/i).fill(
    "At 09:12 UTC a finance user on ws-fin-01 opened a lure because the invoice looked routine. The host then beaconed to 198.51.100[.]24 (alt-014), which shows active command and control. The host is isolated.",
  );
  await page.getByPlaceholder(/Explain why this disposition/i).fill(
    "True positive because alt-014 and alt-019 show the same host contacting 198.51.100[.]24 minutes after the encoded PowerShell run.",
  );
  await page.getByPlaceholder(/ws-fin-01/i).fill("ws-fin-01.corp.internal");
  await page.getByPlaceholder(/Enter indicator/i).fill("198.51.100.24");
  await page.getByRole("button", { name: /\+ Add Indicator/i }).click();
  const timeline = page.getByPlaceholder(/Describe adversary behavior/i);
  const addEvent = page.getByRole("button", { name: /\+ Add Event/i });
  await timeline.fill("Encoded PowerShell execution observed on ws-fin-01 (alt-011).");
  await addEvent.click();
  await timeline.fill("Outbound beaconing toward 198.51.100[.]24 detected (alt-014).");
  await addEvent.click();
  await page.getByPlaceholder(/Chronological narrative of adversary actions/i).fill(
    "The user opened an email attachment (alt-011) that ran encoded PowerShell. The payload created a scheduled task and then beaconed to 198.51.100[.]24 (alt-014), which confirms persistence and command and control.",
  );
  await page.getByPlaceholder(/Specific instructions and containment/i).fill(
    "ws-fin-01 is isolated and the beacon address is blocked. Open question: other hosts that received the same attachment. Request: image ws-fin-01 and search mail for the sender.",
  );
  await page.getByRole("button", { name: /Pre-Submit Audit|Review & Submit/i }).click();
  await page.getByRole("button", { name: /Submit Incident Report/i }).click();
  await expect(page.getByText("Authoritative Evaluation")).toBeVisible({ timeout: 15_000 });
}
