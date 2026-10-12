import { type Page } from "@playwright/test";

export type PacketRowData = {
  no: string;
  time: string;
  source: string;
  destination: string;
  protocol: string;
  length: string;
  info: string;
};

/** Applies a display filter in the packet lab filter bar. */
export async function applyFilter(page: Page, filterText: string): Promise<void> {
  const input = page.getByPlaceholder("Apply a display filter…");
  await input.fill(filterText);
  await page.getByRole("button", { name: "Apply" }).click();
}

/** Extracts structured packet row data from the visible packet table. */
export async function rows(page: Page): Promise<PacketRowData[]> {
  const trs = page.locator("table tbody tr");
  const count = await trs.count();
  const result: PacketRowData[] = [];
  for (let i = 0; i < count; i++) {
    const cells = trs.nth(i).locator("td");
    const texts = await cells.allInnerTexts();
    if (texts.length >= 7) {
      result.push({
        no: texts[0].trim(),
        time: texts[1].trim(),
        source: texts[2].trim(),
        destination: texts[3].trim(),
        protocol: texts[4].trim(),
        length: texts[5].trim(),
        info: texts[6].trim(),
      });
    }
  }
  return result;
}
