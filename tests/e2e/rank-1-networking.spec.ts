import { test, expect } from "@playwright/test";
import { answerAllChecks } from "./helpers/checks";
import { applyFilter, rows } from "./helpers/packet";
import { promoteToRank, submitObjective } from "./helpers/rank0";

test("a promoted Operator explores Rank 1 networking lessons and completes a packet lab", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "desktop journey");
  test.setTimeout(300_000);

  // 1. Promote to Rank 1 via Rank 0 journey
  await promoteToRank(page, 1);

  // 2. Visit learning map, check Rank 1 heading and 9 lessons
  await page.goto("/learn/core");
  await expect(page.getByRole("heading", { name: /rank_1 · Operator/ })).toBeVisible();

  const rank1LessonLinks = page.locator('#rank-1 ol a[href^="/learn/core-r1-"]');
  await expect(rank1LessonLinks).toHaveCount(20);

  // 3. Open lesson 4: TCP, UDP and Ports
  await page.goto("/learn/core-r1-net-tcpudp-01");
  await expect(page.getByRole("heading", { name: "TCP, UDP and Ports" })).toBeVisible();
  await answerAllChecks(page);

  // 4. Open packet lab
  const labLink = page.getByRole("link", { name: "Open the lab" });
  await expect(labLink).toBeVisible();
  await labLink.click();
  await expect(page).toHaveURL(/\/labs\/core-r1-pkt-scan-lab-01/);

  // Wait for packet table to render
  await expect(page.getByText(/Displayed:\s+\d+\s+of\s+\d+\s+packets/)).toBeVisible();

  // 5. Apply filter for initial probes: tcp.flags.syn == 1 && tcp.flags.ack == 0
  await applyFilter(page, "tcp.flags.syn == 1 && tcp.flags.ack == 0");
  const synRows = await rows(page);
  expect(synRows.length).toBeGreaterThan(0);

  // o1: scanner IP is the source of probe packets
  const scannerIp = synRows[0].source;
  await submitObjective(page, 0, scannerIp);

  // o3: number of probed ports
  const probedCount = String(synRows.length);
  await submitObjective(page, 2, probedCount);

  // o2: filter for open ports SYN-ACK: tcp.flags.syn == 1 && tcp.flags.ack == 1
  await applyFilter(page, "tcp.flags.syn == 1 && tcp.flags.ack == 1");
  const synAckRows = await rows(page);
  expect(synAckRows.length).toBeGreaterThan(0);

  // Parse open ports from Info column or source ports
  // Info formatted as: "<srcport> → <dstport> [SYN, ACK] ..."
  const openPortsList = synAckRows
    .map((r) => {
      const match = r.info.match(/^(\d+)\s+→/);
      return match ? Number(match[1]) : null;
    })
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  const openPorts = Array.from(new Set(openPortsList)).join(",");
  await submitObjective(page, 1, openPorts);

  // 6. Verify lab completion and continue link
  await expect(page.getByRole("status").filter({ hasText: "Lab complete" })).toBeVisible();
  const continueLink = page.getByRole("link", { name: /^Continue to next lesson:/ });
  await expect(continueLink).toBeVisible();
  await expect(continueLink).toContainText("DNS — The Internet's Phonebook");
});

test("packet lab has no horizontal page scroll on mobile", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mobile", "mobile viewport test");
  test.setTimeout(180_000);

  // Promote to Rank 1 to access the lab
  await promoteToRank(page, 1);

  await page.goto("/labs/core-r1-pkt-scan-lab-01");
  await expect(page.getByText(/Displayed:\s+\d+\s+of\s+\d+\s+packets/)).toBeVisible();

  // Verify the page itself has no horizontal overflow
  const pageOverflows = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(pageOverflows).toBe(false);

  // Table container has horizontal scroll enabled
  const tableContainer = page.locator(".overflow-x-auto");
  await expect(tableContainer).toBeVisible();
});
